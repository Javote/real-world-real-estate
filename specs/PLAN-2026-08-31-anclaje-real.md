# PLAN 2026-08-31 — encender el anclaje real en la instancia desplegada

Acordado con el dueño el 2026-08-31. Es el próximo trabajo del proyecto: primero pasar la instancia
desplegada a `ANCHOR_MODE=real`, después publicar el validador como reference script.

Vive acá y no en una memoria porque es una secuencia operativa con pasos 🔴 que ejecuta el dueño y
pasos que dejan rastro en el repo: quien retome el trabajo tiene que poder leerla sin el chat.

## Por qué ahora

La instancia desplegada corre en `simulated` contra la base de producción, y eso no es neutral: el
simulador escribe TXIDs bien formados marcados `Confirmed` que la base no distingue de los reales
(`packages/cardano/src/simulated.ts:134` · `apps/api/src/domain/anchoring.ts` no registra el modo en
ningún lado). El 2026-08-31 se encontró en Turso un `OnChainEvent` `EVIDENCE_ANCHOR` `Confirmed`
con txid `44b9dd2d…44f73`, creado el 2026-08-27, **que no existe en Preprod** — consultado contra
Koios. Producción estaba afirmando una prueba inexistente, que es exactamente lo que prohíben la
regla 17 y D-026.

**No falla: miente.** Mismo modo de falla que el push contra un servicio suspendido (RUNBOOK §2).

### Cómo se probó que ese TXID es falso

Verificado dos veces el 2026-08-31, y la segunda prueba no depende de ningún tercero.

**1. La transacción no existe en la cadena.** Koios Preprod devuelve `[]` en `tx_info` y
`num_confirmations: null` en `tx_status`; mainnet, por las dudas, también `null`. **El control del
método importa tanto como el resultado**: la misma consulta con una transacción real tomada de un
bloque reciente de Preprod devuelve `num_confirmations: 0`, así que el endpoint sabe distinguir
"no existe" de "no sé".

**2. La generó el simulador — y esto se reproduce sin salir de la máquina.** El TXID del simulador
es determinístico: `sha256("evidence:" + payload canónico)` (`simulated.ts:134` · `txidOf`,
`canonical`). Recomputándolo con el `sha256Hash` real de la evidencia y el `referenceId` real de la
fila (`rzjfat31fw1gzpq4o6lvr1l9`, **no** el `evidenceId`, que da otro hash) sale exactamente
`44b9dd2d…43544f73`.

Que sea reproducible es lo que cierra la pregunta para siempre: no hay que confiar en que un
explorador esté sincronizado ni en que la red sea la correcta. **Sirve como método general** —
frente a un TXID sospechoso, recomputar el del simulador es más barato y más concluyente que
consultar la cadena. Y mientras no exista la columna `anchorMode` (paso 9), es lo único que
distingue un anclaje real de uno inventado.

## Ya está hecho — verificado contra el código y contra la cadena

- El factory cablea `ANCHOR_MODE=real` sin defaults inseguros.
- El puerto se arma **antes** de `listen` (`apps/api/src/lib/anchor.ts:84`): una seed inválida
  impide arrancar y se ve en los logs de Render, que es lo único que hay (D-042).
- El camino de **metadata** (evidencia, label 1904) está probado contra Preprod de verdad.
- El bloqueo del Merkle root está cerrado: `stage-transition.ts:205` usa `rootDelStage`.
- La wallet de servicio existe y está fondeada.

## Los nueve pasos, en este orden

| # | Paso | Nivel |
|---|---|---|
| 1 | ~~Borrar el anclaje simulado de la base de producción~~ | 🔴 **hecho 2026-08-31** |
| 2 | Probar el camino del hilo en local contra Preprod | 🟡 |
| 3 | ~~Defensa 1: la API se niega a simular contra una base remota~~ | 🟢 **hecho 2026-08-31** |
| 4 | **Cargar los dos secretos en el dashboard de Render** — antes del push | 🔴 dueño |
| 5 | Commit de `render.yaml` (el push dispara el deploy que los consume) | 🟢 |
| 6 | Verificar el arranque en los logs | 🟢 |
| 7 | Un anclaje real de punta a punta | 🟢 |
| 8 | Reconciliación por demanda, sin cron | 🟢 |
| 9 | Defensa 2 (columna `anchorMode`) y defensa 3 (el simulador devuelve `Pending`) | 🟡 decide el dueño |

**1. Borrar el anclaje simulado de la base de producción.** ✅ **Hecho el 2026-08-31 por el dueño.**
`OnChainEvent` quedó en 0 filas y `Evidence` intacta en 1 — el `ON DELETE set null` va en la otra
dirección, así que la evidencia no se toca. La fila respaldada quedó fuera del repo. **Producción ya
no afirma ninguna prueba**, que era la condición para encender el modo real.

Se deja el procedimiento porque vuelve a hacer falta si el Blueprint devuelve la API a `simulated`
(paso 4) antes de que exista la defensa 1. Era un borrado en producción, y lo hace el dueño.

Es **la única fila** de `OnChainEvent` (`count = 1`) y **ninguna tabla la referencia** — se verificó
que no hay FKs entrantes hacia `OnChainEvent`, así que el borrado no arrastra nada. Se apunta al
`id`, no al `txid`:

```bash
# respaldo de la fila, fuera del repo
turso db shell propnexus "select * from OnChainEvent" > ~/propnexus-onchainevent-backup-2026-08-31.txt

turso db shell propnexus "delete from OnChainEvent where id = 'bdnzit9h0lssceciet814leu'"

turso db shell propnexus "select count(*) as n from OnChainEvent"   # → 0
```

La evidencia `jvv2gqwskp210ub6amd6ta8f` vuelve entonces a mostrarse sin anclaje, que es la verdad, y
queda disponible para ser el primer anclaje real del paso 7.

**Las tablas de Turso están en PascalCase singular** (`OnChainEvent`, `Evidence`), no en
snake_case plural. Y el free tier no da shell remota: todo se inspecciona con
`turso db shell propnexus "<sql>"` desde la máquina de uno.

**2. Probar el camino del hilo en local contra Preprod.** Es el único pedazo que **nunca corrió
contra Preprod** —solo contra el `Emulator` y yaci-devkit local— y el de más riesgo: cada
transacción **adjunta el validador entero** (`packages/cardano/src/real.ts:139`), así que ahí pegan
los límites de tamaño reales. Se levanta la API local con `ANCHOR_MODE=real` (RUNBOOK §1.5 paso 4)
y se dispara `PATCH /api/v1/stages/:id/state`. **Si esto falla, no se sigue.**

**3. Defensa 1 — la API se niega a simular contra una base remota.** Si `ANCHOR_MODE=simulated` y
la `DATABASE_URL` es de Turso, el proceso no levanta; mismo criterio que D-042. Simular contra Turso
no tiene caso de uso legítimo, así que no lleva escotilla de escape. **Convierte en ruidosa la falla
que hoy es silenciosa**, y esa falla tiene un camino de vuelta conocido (paso 5).

Va **antes** de `createAnchorPort` en `initAnchorPort` (`apps/api/src/lib/anchor.ts`) y no adentro
del factory: el factory no sabe qué base hay del otro lado, y el arranque es el único momento en que
fallar sirve de algo. Mirar el **host** además del esquema — `https://…turso.io` también llega a
Turso, no solo `libsql://`. Y el rechazo tiene que ocurrir antes de reemplazar el puerto vigente.

✅ **Hecho el 2026-08-31.** `rechazarSimuladoContraBaseRemota()` en
`apps/api/src/lib/anchor.ts`, con `apps/api/test/anchor-mode-guard.test.ts` fijando los dos
esquemas de Turso, el default implícito de `ANCHOR_MODE` y que el rechazo ocurra antes de
reemplazar el puerto vigente. Se recuperó de `7d046a3`, que lo había escrito junto con el paso 5;
acá va solo el guard, porque `render.yaml` no se toca hasta que estén cargados los secretos.

**Se adelantó al paso 2 a propósito:** no depende de él, y conviene que el guard exista antes de
que `render.yaml` pueda volver a `simulated` en un re-sync.

⚠ **No pushear este commit solo.** El guard rechaza justo la configuración que la instancia
desplegada tiene hoy: `render.yaml:132` declara `ANCHOR_MODE: simulated` y `DATABASE_URL` es de
Turso. Un push dispara deploy —el `buildFilter` no filtra, verificado el 2026-08-27— y la API no
levanta: **producción sin API**, no un anclaje que falla. El guard viaja al remoto recién en el
push del paso 5, después de los secretos del paso 4 y con `ANCHOR_MODE: real` en el mismo commit.
Hasta entonces queda local, protegiendo al desarrollo.

**4. Cargar los dos secretos en el dashboard de Render.** 🔴 lo hace el dueño, **antes** del paso 5.

**Este orden se aprendió rompiéndolo el 2026-08-31.** El plan original ponía el commit primero, y
eso deja producción caída: pushear `render.yaml` dispara un deploy, el deploy arranca con
`ANCHOR_MODE=real`, y como el puerto se construye **antes** de `listen` (D-042), sin
`BLOCKFROST_API_KEY` ni `SERVICE_WALLET_SEED` la API no levanta — no falla el primer anclaje: no
hay API. La ventana dura lo que tarde alguien en cargar los secretos a mano.

Las variables `sync: false` **se pueden cargar antes de que el Blueprint las declare**: quedan
guardadas esperando, y el deploy siguiente las encuentra. Por eso el orden correcto es secretos
primero, push después, y así producción no se cae ni un minuto.

⚠ **La seed no se rota.** La dirección del admin del validador se deriva de ella: reemplazarla
dejaría inalcanzables los hilos ya anclados, sin ningún error visible.

**5. Commit de `render.yaml`.** Tres cosas juntas:
- `ANCHOR_MODE` a `value: real` — **en el YAML, no solo en el dashboard**. Las variables declaradas
  con `value:` las gobierna el Blueprint: un re-sync pisa cualquier cambio hecho a mano en el
  dashboard y devuelve la API a `simulated` **en silencio**, sin romper nada y sin log de error.
  Ese es el camino por el que el TXID falso vuelve a aparecer, y empeora con el modo real
  encendido: conviven TXIDs reales y falsos en la misma columna sin nada que los separe.
- Agregar `BLOCKFROST_API_KEY` y `SERVICE_WALLET_SEED` como `sync: false`.
- **Corregir los comentarios de las líneas 124-128**, que afirman dos cosas falsas desde `ca610e5`:
  que `simulated` es el único modo válido hoy (el adaptador real ya existe y arranca) y que
  `CARDANO_NETWORK` no lo lee nadie (lo lee `apps/api/src/lib/anchor.ts:89`).

**Antes de pushear, mirá si el paso 2 está hecho.** Con `render.yaml` en `real`, la instancia
desplegada empieza a intentar transacciones de **hilo** reales, y ese es justamente el camino que
nunca corrió contra Preprod. El de evidencia (metadata) sí está probado. No corrompe nada —una
transición que falla devuelve error— pero es la diferencia entre descubrirlo en tu máquina y
descubrirlo en la demo.

**6. Verificar el arranque.** `render logs` hasta ver `AnchorPort listo en modo "real"`
(`apps/api/src/server.ts:28`).

**7. Un anclaje real de punta a punta**, verificado contra Koios, y reconciliado a mano con
`POST /api/v1/evidence/reconcile`.

**8. Reconciliación por demanda, sin cron.** Se descartó el cron de reconciliación, así que hasta
que exista este paso ese `curl` a mano es **lo único** que mueve `Pending` → `Confirmed`: con el
modo real encendido y sin correrlo, la evidencia queda anclada de verdad y la UI dice "Pendiente"
para siempre. Hoy no se nota porque en `simulated` el estado llega `Confirmed` directo.

La forma acordada: cuando una lectura devuelve un `OnChainEvent` `Pending` **que tiene txid**,
consultar la cadena para ese evento antes de responder. La confirmación llega en el momento en que
alguien la mira, que es el único en que importa; el `POST /reconcile` queda para barridos a mano.
La alternativa barata —enganchar `reconciliarAnclajes()` al final de cada anclaje nuevo— no cuesta
requests, pero deja sin confirmar el anclaje solitario hasta que llegue el siguiente.
El comentario de `apps/api/src/domain/reconcile.ts:14-17` todavía propone un cron de GitHub
Actions: se corrige en el mismo commit.

**9. Las otras dos defensas.** Van después del encendido, no antes:
- **Columna `anchorMode` en `OnChainEvent`**, escrita desde `anchorPort().mode` (el puerto ya lo
  expone en `port.ts:78`). Es la defensa estructural. Con Turso vivo, D-063 exige una **migración
  nueva** en vez de editar `0000_init.sql`: `migrate.ts:56` lee `migrations/*.sql` ordenados y
  trackea en `_migrations`, así que el mecanismo lo soporta, pero rompe el "una sola migración" del
  stack — **esa decisión es del dueño**. 🟡
- **Que el simulador devuelva `Pending` y no `Confirmed`**, alineándolo con el adaptador real, para
  que `Confirmed` signifique sin excepción *algo consultó la cadena*. Opcional una vez que existe
  la columna; toca tests que hoy esperan `Confirmed` directo.

## Qué queda después

Publicar el validador como reference script — hoy cada transacción lo adjunta entero.
