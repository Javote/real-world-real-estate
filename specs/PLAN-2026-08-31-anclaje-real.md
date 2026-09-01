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
| 2 | ~~Probar el camino del hilo en local contra Preprod~~ | 🟡 **hecho 2026-08-31** |
| 3 | ~~Defensa 1: la API se niega a simular contra una base remota~~ | 🟢 **hecho 2026-08-31** |
| 4 | ~~Secretos en el dashboard + probar el modo real desde ahí~~ | 🔴 **hecho 2026-08-31** |
| 5 | ~~Commit de `render.yaml`~~ | 🟢 **hecho 2026-08-31** |
| 6 | ~~Verificar el arranque en los logs~~ | 🟢 **hecho** — `AnchorPort listo en modo "real"` en Render |
| 7 | Un anclaje real de punta a punta | 🟢 **lo único que falta de este plan** — `OnChainEvent` sigue en 0 filas |
| 8 | ~~Reconciliación por demanda, sin cron~~ | 🟢 **hecho 2026-08-31** |
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
contra Preprod** —solo contra el `Emulator` y yaci-devkit local— y el de más riesgo: en ese momento
cada transacción **adjuntaba el validador entero**, así que ahí pegaban los límites de tamaño
reales. **Si esto falla, no se sigue.** (Desde el 2026-09-01 el validador puede viajar por
referencia — D-083 — y la transacción es cuatro veces más chica.)

**El hilo NO se abre en el `PATCH`**, y esta versión del plan decía que sí. `transitionStage()`
llama a `anchorEvent(evento, stage, existing)` con `existing` siempre presente, así que siempre cae
en `advanceThread`. El único `openThread` del código está en `projects-obra.routes.ts:96`, al
**crear** el stage. Un stage sembrado directo en la base no tiene hilo: pegarle un `PATCH` llama a
`advanceThread` con `outputRef: ""` y sale `BAD_OUTPUT_REF`. La prueba son dos requests, en orden:

1. `POST /api/v1/projects/:id/stages` → `STAGE_CREATED` → **`openThread`** (mint del thread token).
2. Esperar confirmación en la cadena, y recién ahí
   `PATCH /api/v1/stages/:id/state` → **`advanceThread`** (gasta el UTxO del script).

**La espera entre las dos era obligatoria, y desde el 2026-09-01 no lo es** (D-082). `advanceThread`
necesitaba que el UTxO del hilo existiera **para el proveedor**, y Blockfrost no lo reporta hasta que
entra en un bloque (~20 s en Preprod). Era el mismo motivo por el que dos anclajes seguidos chocaban
—el UTxO único de la wallet— y se arregló de una sola vez: el adaptador encadena sobre lo que él
mismo envió. Si repetís la prueba hoy, las dos requests salen seguidas.

✅ **Hecho el 2026-08-31, y encontró un bug real.** El validador corrió en Preprod por primera vez:

| | txid | bloque |
|---|---|---|
| `openThread` (mint del hilo) | `555b2a65…14ff` | 5123378 |
| `advanceThread` (`Pending → InProgress`) | `def11af5…e536` | 5123398 |

El thread token —policy `345116608fb4…`, asset name = el id del stage, según D-058— pasó del UTxO
viejo del script al nuevo, verificado con `tx_info` de Koios. Fee del avance: 0,307 tADA.

**El primer intento falló, y no por el tamaño del validador.** Salió
`OutsideValidityIntervalUTxO`: la transacción declaraba `invalidBefore = 132536176`, el nodo validó
en el slot `132536159` y el tip en ese momento era el bloque 5123377 en el slot `132536158`. **El
nodo valida contra el slot del último bloque, no contra su reloj**, y `advanceThread` ponía
`validFrom = now - 1000`. En Preprod los bloques salen cada 13–48 s, así que ese borde está en el
futuro casi siempre. Se arregló con `TIP_LAG_MARGIN_MS = 2 min` (`real.ts`); el detalle y el
compromiso que implica están en la constante.

**Por qué el `Emulator` y yaci no lo agarraron**, que es la parte que importa para no repetirlo: el
`Emulator` mueve los slots con su propio reloj y yaci-devkit hace bloques de ~1 s, así que en
ninguno de los dos existe el retraso del tip. Y el camino de metadata —el único que ya había
corrido contra Preprod— no declara ventana de validez. **Ningún entorno de prueba reproducía la
condición**: por eso el paso 2 existía.

**3. Defensa 1 — el simulador no ancla contra una base remota.** Si `ANCHOR_MODE=simulated` y la
`DATABASE_URL` es de Turso, el puerto queda **inhabilitado**: la API arranca, pero no produce ni un
TXID. Simular contra Turso no tiene caso de uso legítimo, así que no lleva escotilla de escape.
**Convierte en ruidosa la falla que hoy es silenciosa**, y esa falla tiene un camino de vuelta
conocido (paso 5).

Va **antes** de `createAnchorPort` en `initAnchorPort` (`apps/api/src/lib/anchor.ts`) y no adentro
del factory: el factory no sabe qué base hay del otro lado. Mira el **host** además del esquema —
`https://…turso.io` también llega a Turso, no solo `libsql://`.

✅ **Hecho el 2026-08-31.** `motivoParaNoAnclar()` + `inhabilitar()` en
`apps/api/src/lib/anchor.ts`, `DisabledAnchorAdapter` en `packages/cardano/src/disabled.ts`, con
tests en los dos lados. Se recuperó de `7d046a3`, que lo había escrito junto con el paso 5; acá va
solo el guard, porque el `render.yaml` del paso 5 depende de los secretos del paso 4.

**Se adelantó al paso 2 a propósito:** no depende de él, y conviene que el guard exista antes de
que `render.yaml` pueda volver a `simulated` en un re-sync.

**El guard se escribió primero como `throw`, y eso lo volvía impusheable.** Rechazaba justo la
configuración que la instancia tiene hoy (`render.yaml:132` en `simulated`, `DATABASE_URL` de
Turso), y como el `buildFilter` de Render no filtra —verificado el 2026-08-27—, cualquier push
disparaba un deploy que no levantaba: **producción sin API**. El plan pasaba a depender de un orden
que nadie podía olvidarse.

**Eso se arregló en el código, no en el orden** (D-075): ahora el guard inhabilita el puerto y la
API arranca igual. El paso 3 se puede pushear cuando sea, y el paso 5 dejó de poder tirar nada.

**4. Cargar los dos secretos en el dashboard de Render, y probar el modo real desde ahí.** 🔴 lo
hace el dueño, **antes** del paso 5.

**Ya no es una precaución contra la caída** —D-075 se la llevó: si los secretos no están, la API
arranca con el anclaje inhabilitado y el resto del producto anda—. Sigue siendo el orden bueno por
otra razón, más barata: **probar el arranque en real donde deshacerlo es un restart y no un
revert.**

1. Cargar `BLOCKFROST_API_KEY` y `SERVICE_WALLET_PRIVATE_KEY` en el dashboard (D-078). No cambia
   nada todavía:
   la API sigue en `simulated`.
2. Poner `ANCHOR_MODE=real` **en el dashboard** y reiniciar. Mirar los logs (paso 6).
   - `AnchorPort listo en modo "real"` → verde, se sigue al paso 5.
   - Arranca `disabled` → falta o está mal alguno de los dos secretos, y el motivo está en la
     misma línea del log. Se corrige en el dashboard y se reinicia. **El resto de la API estuvo
     funcionando todo el tiempo.**
3. Recién con ese verde, el push del paso 5.

Que `ANCHOR_MODE` esté declarado con `value:` no impide el paso 2 de esta lista: el dashboard pisa
al Blueprint hasta el próximo re-sync. Esa precedencia es justamente el bug que el paso 5 cierra,
pero acá juega a favor —el cambio es temporal y reversible— y por eso se aprovecha antes de
volverla permanente en el YAML.

**Este orden se aprendió rompiéndolo el 2026-08-31, y después dejó de ser obligatorio.** El plan
original ponía el commit primero, y con el comportamiento de entonces eso dejaba producción caída:
pushear `render.yaml` disparaba un deploy que arrancaba en `ANCHOR_MODE=real`, y como el puerto se
construía **antes** de `listen`, sin los dos secretos la API no levantaba — no fallaba el primer
anclaje: no había API. **D-075 quitó ese filo**: hoy el peor caso es el anclaje inhabilitado. El
orden se conserva porque sigue siendo el más barato, no porque el otro sea catastrófico.

Las variables `sync: false` **se pueden cargar antes de que el Blueprint las declare**: quedan
guardadas esperando, y el deploy siguiente las encuentra. Por eso el orden correcto es secretos
primero, push después, y así producción no se cae ni un minuto.

⚠ **La clave no se rota.** El admin del validador es su hash: reemplazarla dejaría inalcanzables
los hilos ya anclados, sin ningún error visible.

**La wallet se rehízo el 2026-08-31** (D-078). La original había nacido de una seed y quedó fondeada
en su dirección *base*; con una sola clave de pago la dirección es *enterprise*, que es otra. En vez
de mudar fondos o escribir un adaptador para conservar la vieja, se generó una wallet nueva y se
fondeó la dirección que el servicio realmente mira. Las tADA de la anterior quedaron ahí y no
importan.

**5. Commit de `render.yaml`.** ✅ **Hecho el 2026-08-31**, y **antes** del paso 4: con D-075 el
orden dejó de importar. Si los secretos no están cuando el deploy arranca, el puerto queda
inhabilitado y el resto de la API sigue sirviendo — el mismo estado en que ya estaba. Lo que
cambia es que ahora el Blueprint dice `real`, así que un re-sync no puede devolverla al simulador.

Verificado en producción el 2026-08-31: con el Blueprint todavía en `simulated`, el arranque dejó
en los logs `AnchorPort listo en modo "disabled"` más el motivo, y `API listening` en la línea
siguiente. La degradación no es teórica.

Tres cosas juntas:
- `ANCHOR_MODE` a `value: real` — **en el YAML, no solo en el dashboard**. Las variables declaradas
  con `value:` las gobierna el Blueprint: un re-sync pisa cualquier cambio hecho a mano en el
  dashboard y devuelve la API a `simulated` **en silencio**, sin romper nada y sin log de error.
  Ese es el camino por el que el TXID falso vuelve a aparecer, y empeora con el modo real
  encendido: conviven TXIDs reales y falsos en la misma columna sin nada que los separe.
- Agregar `BLOCKFROST_API_KEY` y `SERVICE_WALLET_PRIVATE_KEY` como `sync: false`.
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

**8. Reconciliación por demanda, sin cron.** ✅ **Hecho el 2026-08-31** — D-077.

**8. Reconciliación por demanda, sin cron.** Se descartó el cron de reconciliación, así que hasta
que exista este paso ese `curl` a mano es **lo único** que mueve `Pending` → `Confirmed`: con el
modo real encendido y sin correrlo, la evidencia queda anclada de verdad y la UI dice "Pendiente"
para siempre. Hoy no se nota porque en `simulated` el estado llega `Confirmed` directo.

La forma acordada: cuando una lectura devuelve un `OnChainEvent` `Pending` **que tiene txid**,
consultar la cadena para ese evento antes de responder. La confirmación llega en el momento en que
alguien la mira, que es el único en que importa; el `POST /reconcile` queda para barridos a mano.
La alternativa barata —enganchar `reconciliarAnclajes()` al final de cada anclaje nuevo— no cuesta
requests, pero deja sin confirmar el anclaje solitario hasta que llegue el siguiente.
El comentario de `reconcile.ts` que proponía un cron de GitHub Actions se corrigió en el mismo
commit.

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

Nada de este plan. ✅ **El reference script se publicó como capacidad el 2026-09-01** (D-083): el
adaptador referencia el validador en vez de adjuntarlo, y `pnpm --filter @plataforma/cardano
ref:publish` lo publica una vez por red. Queda como paso operativo en el runbook §1.5, no como
trabajo pendiente.
