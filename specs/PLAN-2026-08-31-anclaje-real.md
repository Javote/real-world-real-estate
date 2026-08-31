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
| 1 | Borrar el anclaje simulado de la base de producción | 🔴 dueño |
| 2 | Probar el camino del hilo en local contra Preprod | 🟡 |
| 3 | Defensa 1: la API se niega a simular contra una base remota | 🟢 |
| 4 | Commit de `render.yaml` | 🟢 |
| 5 | Cargar los dos secretos en el dashboard de Render | 🔴 dueño |
| 6 | Verificar el arranque en los logs | 🟢 |
| 7 | Un anclaje real de punta a punta | 🟢 |
| 8 | Reconciliación por demanda, sin cron | 🟢 |
| 9 | Defensa 2 (columna `anchorMode`) y defensa 3 (el simulador devuelve `Pending`) | 🟡 decide el dueño |

**1. Borrar el anclaje simulado de la base de producción.** Antes de encender nada, o queda
indistinguible para siempre. Es una fila y nada la referencia. Lo hace el dueño: es un borrado en
producción.

**2. Probar el camino del hilo en local contra Preprod.** Es el único pedazo que **nunca corrió
contra Preprod** —solo contra el `Emulator` y yaci-devkit local— y el de más riesgo: cada
transacción **adjunta el validador entero** (`packages/cardano/src/real.ts:139`), así que ahí pegan
los límites de tamaño reales. Se levanta la API local con `ANCHOR_MODE=real` (RUNBOOK §1.5 paso 4)
y se dispara `PATCH /api/v1/stages/:id/state`. **Si esto falla, no se sigue.**

**3. Defensa 1 — la API se niega a simular contra una base remota.** Si `ANCHOR_MODE=simulated` y
`DATABASE_URL` empieza con `libsql://`, el proceso no levanta; mismo criterio que D-042. Simular
contra Turso no tiene caso de uso legítimo. ~10 líneas, sin tocar esquema ni tests. Va en el mismo
commit que el paso 4: **convierte en ruidosa la falla que hoy es silenciosa**, y esa falla tiene un
camino de vuelta conocido (abajo).

**4. Commit de `render.yaml`.** Tres cosas juntas:
- `ANCHOR_MODE` a `value: real` — **en el YAML, no solo en el dashboard**. Las variables declaradas
  con `value:` las gobierna el Blueprint: un re-sync pisa cualquier cambio hecho a mano en el
  dashboard y devuelve la API a `simulated` **en silencio**, sin romper nada y sin log de error.
  Ese es el camino por el que el TXID falso vuelve a aparecer, y empeora con el modo real
  encendido: conviven TXIDs reales y falsos en la misma columna sin nada que los separe.
- Agregar `BLOCKFROST_API_KEY` y `SERVICE_WALLET_SEED` como `sync: false`.
- **Corregir los comentarios de las líneas 124-128**, que afirman dos cosas falsas desde `ca610e5`:
  que `simulated` es el único modo válido hoy (el adaptador real ya existe y arranca) y que
  `CARDANO_NETWORK` no lo lee nadie (lo lee `apps/api/src/lib/anchor.ts:89`).

**5. Cargar los dos secretos en el dashboard de Render.** 🔴 lo hace el dueño.
⚠ **La seed no se rota.** La dirección del admin del validador se deriva de ella: reemplazarla
dejaría inalcanzables los hilos ya anclados, sin ningún error visible.

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
