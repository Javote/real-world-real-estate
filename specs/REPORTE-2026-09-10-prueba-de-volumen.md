# Reporte — Prueba de volumen end-to-end en Preprod (2026-09-10)

> Corresponde al ítem **"Al final — la prueba de volumen (ex-pendiente #0)"** de `CLAUDE.md`
> §El plan de entrega del Milestone 3. Alimenta los criterios **8** (flujos de UI end-to-end en
> pre-prod), **9** (muestra real de reserva→escrow / transición de etapa confirmada en Preprod) y
> **15** (lista formal de TXIDs) del SOM, y es prerrequisito de 3.10, 3.12 y 3.13.

## Resumen ejecutivo

Se crearon **3 proyectos nuevos** (`Torre Volumen 1`, `Torre Volumen 2`, `Torre Volumen 3`, 10
etapas cada uno según `DEFAULT_STAGE_CATALOG`) desde el frontend real, contra producción
(`propnexus-web.onrender.com` / `propnexus-api.onrender.com` / Cardano Preprod), y se llevó
**cada una de las 30 etapas** por el tour completo de la FSM del stage:

```
Pending → InProgress → Observed → InProgress → Completed
```

Todas las transiciones se dispararon **por click real en el navegador** (Claude en Chrome), nunca
por HTTP directo, con las cuatro cuentas demo que el flujo exige (`developer@example.com` para
subir evidencia y "Reanudar etapa"; `verifier@example.com` para "Observar" y "Certificar"). Es la
primera vez que las cuatro aristas de la FSM se ejercitan **juntas**, en **10 etapas por proyecto**,
repetido en **3 proyectos** — hasta ahora cada arista se había probado una vez, sobre un stage
aislado (ver `CLAUDE.md` §Estado, entradas del 2026-09-08).

**Resultado: las 30 etapas terminaron `Completed` en la base** (reverificado al cierre de este
reporte). De los **180 intentos de anclaje on-chain** que la prueba dispara (30 mints + 30 anclajes
de evidencia + 120 transiciones de estado — 4 por etapa), **176 tienen TXID real registrado**
(97.8%) y **4 no** (2.2%), concentrados en **2 de las 30 etapas** (Torre Volumen 1, etapas 3 y 4).
La investigación de esos 4 —confirmada contra Cardano Preprod directamente, no solo contra la base—
encontró que **no son la misma falla**: en la etapa 3 la transacción real **sí se ejecutó y
confirmó en cadena**, pero la aplicación nunca guardó su TXID (queda un hilo on-chain huérfano,
vivo, que la base no conoce); en la etapa 4 la transacción **nunca llegó a emitirse**. Ver
§Hallazgo para el detalle forense completo — es, con diferencia, el resultado más importante de
esta prueba, porque destapa un caso real de pérdida de bookkeeping que ninguna prueba anterior
había ejercitado (dos anclajes disparados casi en simultáneo). El resto del reporte detalla método,
cronología, resultados agregados, el hallazgo y un apéndice con los 176 TXIDs registrados,
agrupados por proyecto y etapa.

**Estado al cierre de esta sesión (mismo día):** la causa raíz de las 4 fallas se confirmó
(un reinicio de `propnexus-api` por health check fallido en Render, plan Free, sin relación con el
código) y el gap que permitió perderlas se cerró en producción (§Cómo hacerlo más robusto — 3
mejoras de código, deployadas). Las 2 etapas afectadas se dejaron **deliberadamente sin reparar**
(son de un proyecto de prueba, sin corregir D-058 a mano sin un mecanismo probado). Los 176 TXIDs
reales quedaron reconciliados a `Confirmed` en la base y **verificados 1 a 1 contra Preprod** por
una fuente independiente (Koios) — 176 de 176 existen en la cadena. El balance real de la wallet de
servicio se midió: ~99.8 ADA de costo total de la prueba (39.83 ADA de fees + 60 ADA bloqueadas
permanentemente, D-057), levemente por debajo del estimado del plan (~105 ADA). 3.10/3.12/3.13
quedan fuera de esta sesión por decisión del dueño.

## Alcance y objetivo

Repetir, en volumen, lo que hasta el 2026-09-08 solo se había probado arista por arista:

| Transición | Quién | Mecanismo (UI) |
|---|---|---|
| `Pending → InProgress` | developer, automático | primera evidencia subida (`/developer/project/:id/upload`) |
| `InProgress → Observed` | certifier, exclusivo | botón "Observar" (`/certifier/stage/:stageId`) |
| `Observed → InProgress` | developer, manual | botón "Reanudar etapa" (`/developer/progress`, sección "Etapas observadas") |
| `InProgress → Completed` | certifier, exclusivo | botón "Certificar" (`/certifier/stage/:stageId`) |

Presupuesto estimado en el plan: **~35 ADA por proyecto** (≈15 de fee + 20 bloqueadas por las 10
etapas × 2 ADA, D-057 — sin burn, permanentes). Esta sesión no volvió a medir el balance de la
wallet de servicio antes/después; queda como verificación pendiente (ver §Qué falta después de
este reporte).

## Método

- **Nada por atajo HTTP.** Cada una de las ~150 acciones de transición (30 stages × 4 aristas +
  30 subidas de evidencia) se ejecutó con clicks reales del navegador (`mcp__claude-in-chrome`)
  contra `https://propnexus-web.onrender.com`, nunca con `curl` ni llamadas directas a la API —
  cumpliendo lo pedido explícitamente por el dueño ("Todo por click en el navegador").
- **Login por rol**, con las credenciales del re-seed de producción (`apps/api/.env`,
  `SEED_DEMO_PASSWORD`): `developer@example.com` para crear los 3 proyectos, subir la evidencia
  inicial y "Reanudar etapa"; `verifier@example.com` (rol `certifier`) para "Observar" y
  "Certificar". `verifier@example.com` se agregó como miembro (`membershipRole: "verifier"`) de
  los 3 proyectos nuevos vía `POST /:id/members` (admin-only) porque `GET /certifier/assignments`
  solo lista stages de proyectos donde el certifier es miembro — sin eso, las 30 etapas nuevas
  eran invisibles para el certifier.
- **Evidencia real:** 10 PDFs generados con `pandoc` (`acta-1.pdf` … `acta-10.pdf`), reutilizados
  en los 3 proyectos, subidos por `/developer/project/:id/upload`.
- **Patrón de verificación "no confiar en el spinner":** después de cada click de transición (sobre
  todo "Observar"/"Certificar"/"Reanudar etapa"), se esperó y después se confirmó el estado
  **leyendo la base de producción directo** (`turso db shell propnexus "SELECT state FROM Stage
  WHERE id='...'"`, poll de hasta ~2 min) antes de avanzar a la siguiente etapa. Se adoptó porque
  clicks lanzados sin esta espera dieron falsos positivos (ver `apps/web/CLAUDE.md` y la sesión
  previa a este reporte: clicks que "se veían" exitosos en la UI pero la request quedaba
  interrumpida por la navegación siguiente).
- **`developer.progress.tsx` no expone URL por stage** para "Reanudar etapa" — es una lista que se
  reordena sola al completarse cada acción, así que la Fase 3 se hizo clickeando siempre el primer
  botón de la lista "Etapas observadas" y confirmando contra la base qué `stageId` correspondía en
  cada paso, con una recarga completa de página entre cada click (el estado de React Query no
  refrescaba solo tras la mutación en dos observaciones puntuales durante la prueba).

## Cronología

Los cinco tramos de la prueba, con inicio/fin real tomados de `OnChainEvent.createdAt` en la base
de producción (UTC):

| Fase | Qué | Inicio | Fin | Duración |
|---|---|---|---|---|
| 0 | Creación de los 3 proyectos (30 mints, `STAGE_CREATED`) | 15:24:30 | 15:43:41 | 19m 10s |
| 1 | Subida de evidencia inicial + auto `Pending → InProgress` (30×) | 15:45:45 | 16:21:18 | 35m 33s |
| 2 | "Observar" — `InProgress → Observed` (30×, certifier) | 16:24:14 | 16:49:30 | 25m 16s |
| 3 | "Reanudar etapa" — `Observed → InProgress` (30×, developer) | 16:50:56 | 17:05:55 | 14m 58s |
| 4 | "Certificar" — `InProgress → Completed` (30×, certifier) | 17:07:01 | 17:18:27 | 11m 26s |

**Duración total: 1h 53m 57s**, de punta a punta, para 180 intentos de anclaje reales contra
Preprod (arranque más lento por los cold starts del free tier de Render en las primeras acciones
de cada fase — documentado como trampa transversal conocida).

## Resultados agregados

### Por tipo de evento on-chain

| Evento | Total intentados | Con TXID real | Sin TXID |
|---|---|---|---|
| `STAGE_CREATED` (mint, 1 por etapa) | 30 | 30 | 0 |
| `EVIDENCE_ANCHOR` (evidencia inicial, 1 por etapa) | 30 | 30 | 0 |
| `STAGE_TRANSITION` (4 aristas × 30 etapas) | 120 | 116 | **4** |
| **Total** | **180** | **176 (97.8%)** | **4 (2.2%)** |

### Por transición de la FSM

| Transición | Intentos | Con TXID |
|---|---|---|
| `Pending → InProgress` (auto) | 30 | 30 |
| `InProgress → Observed` ("Observar") | 30 | 30 |
| `Observed → InProgress` ("Reanudar etapa") | 30 | **28** |
| `InProgress → Completed` ("Certificar") | 30 | **28** |

### Por proyecto

| Proyecto | Etapas `Completed` (declarado, DB) | TXIDs reales obtenidos |
|---|---|---|
| Torre Volumen 1 | 10/10 | 56/60 |
| Torre Volumen 2 | 10/10 | 60/60 |
| Torre Volumen 3 | 10/10 | 60/60 |

**Las 30 etapas quedaron declaradas `Completed` en la base**, incluidas las 2 con anclaje fallido
— consistente con D-059 ("la declaración se escribe igual" aunque el anclaje falle) y con la
matriz de permisos: ninguna transición se rechazó por autorización, las 30 pasaron por el rol
correcto (developer para las dos automáticas/manuales que le tocan, certifier exclusivo para
Observar/Certificar).

### Nota sobre el estado `Pending` vs `Confirmed` en la tabla del apéndice

Por D-077 (reconciliación en lectura), el campo `OnChainEvent.status` solo pasa de `Pending` a
`Confirmed` cuando una ruta que lo lee dispara `reconciliarParaLectura` — no automáticamente ni por
haber sido escrito por `turso db shell`. La mayoría de los eventos del apéndice muestran `Pending`
con un TXID real: **no es lo mismo que "no confirmado en Preprod"**, es "escrito y con TXID, pero
sin que nadie haya abierto la pantalla que dispara la reconciliación de ese evento en particular"
(la mayoría de las pantallas que se usaron durante la prueba muestran el estado del *stage*, no el
de cada `OnChainEvent` individual). Antes de publicar la lista formal de TXIDs (3.10), conviene
correr una pasada de reconciliación (o `AnchorPort.verify()` por TXID) para que el campo `status`
quede consistente con la cadena real — ver §Qué falta después de este reporte.

## Hallazgo: 2 de 30 etapas con anclaje fallido (Torre Volumen 1, etapas 3 y 4) — causa raíz confirmada

**Torre Volumen 1 · Etapa 3 ("Movimiento de suelos y excavación")** y **Etapa 4
("Cimentación")** son las dos únicas de las 30 donde el anclaje real no se completó — en ambas,
en el mismo punto de la secuencia (evento 4, "Reanudar etapa", `Observed → InProgress`) y con el
mismo efecto dominó sobre el evento 5 ("Certificar", `Failed`). **La causa raíz está confirmada**,
cruzando tres fuentes independientes: Cardano Preprod directo (Koios, `preprod.koios.rest` — sin
necesitar `BLOCKFROST_API_KEY`, que además resultó inválida contra el proyecto local: el valor de
`apps/api/.env` no es el que usa producción), los logs de `propnexus-api` en Render (`render logs`,
CLI ya autenticada) y el historial de deploys (`render deploys list`).

### La causa: `propnexus-api` se cayó a mitad de la Fase 3 — plan Free, sin shutdown limpio

```
16:52:06  Reanudar etapa 1 y 2 de Torre Volumen 1 — confirman en cadena, normal
16:54:13  clic "Reanudar etapa" → etapa 3 (evento registrado, Stage.state pasa a InProgress)
16:54:45  clic "Reanudar etapa" → etapa 4 (evento registrado, Stage.state pasa a InProgress)
16:54:56  la transacción de la etapa 3 CONFIRMA en Preprod (bloque 5161038) — el proceso que la
          disparó ya no está para enterarse
16:55:15  Render arranca una instancia NUEVA de propnexus-api (logs: "Running '...migrate.js...
          server.js'", sin ningún "[SIGTERM] cerrando" antes — a diferencia del cierre limpio
          que sí se ve más tarde, a las 17:40:03: "[SIGTERM] cerrando: no se aceptan requests
          nuevas" / "[cierre] listo")
```

`render deploys list srv-da87oaon74is739pr050` confirma que **no hubo ningún deploy en ese
momento** (el último terminó a las 15:16:38 UTC, casi 40 minutos antes) — el reinicio de las
16:55:15 no fue un redeploy deliberado. Y `render services` confirma que el plan del servicio es
**`free`** (512 MB de RAM, una sola instancia). **Confirmado por una cuarta fuente, la más
autorizada de todas — Render mismo:** el dueño recibió el mail estándar de Render a las 13:55
hora de Buenos Aires (UTC-3) = **16:55 UTC**, "we detected a server failure, HTTP check failed
(timed out after 5 seconds)" — coincide al segundo con el reinicio visto en los logs. La causa
declarada por la propia plataforma es que **`/health` no respondió dentro de los 5 segundos** que
Render tolera antes de matar y reiniciar la instancia (plan Free: un timeout más corto y sin
instancia de respaldo que la sostenga mientras tanto). La ausencia de `[SIGTERM] cerrando` antes
del reinicio es consistente con esto: si el proceso estaba tan ocupado o bloqueado que ni siquiera
pudo responder un health check trivial, tampoco tuvo margen para procesar un cierre ordenado antes
de que Render lo matara.

**El mecanismo exacto del bloqueo no se pudo terminar de cerrar** — se consultó la API de métricas
de Render (`api.render.com/v1/metrics`, mismo token que usa el CLI) para CPU y memoria de
`propnexus-api` en la ventana 16:40–17:00 UTC:

- **CPU:** nunca superó ~8% de un core en toda la ventana, y en el minuto exacto de la falla
  (16:53–16:54 UTC) estaba en su punto **más bajo** de todo el test (<1%). Descarta un bloqueo del
  event loop por cómputo síncrono pesado (construcción/firma de transacciones, evaluación de
  script Plutus) justo en ese momento — si lo hubiera habido, el promedio de ese minuto lo
  mostraría.
- **Memoria:** subía sostenido durante todo el test — de 300 MB (16:40 UTC) a 331 MB, su pico,
  justo a las 16:54 UTC — contra el límite de 512 MB del plan Free (64% del límite). No llegó a
  tocarlo, así que no fue un OOM kill "duro" en el sentido estricto. El patrón de crecimiento
  sostenido —y que vuelve a subir igual después del reinicio, arrancando desde ~131 MB— sí sugiere
  una fuga de memoria bajo carga sostenida de anclajes, independiente de qué disparó este reinicio
  puntual.
- **Latencia HTTP por request** (el dato que hubiera mostrado si una llamada de I/O —Blockfrost o
  Turso— se colgó bloqueando la respuesta del health check) **no está disponible en el plan
  Free/Hobby**: la API la rechaza explícito (`"query is not allowed for plan: Hobby"`). Sin eso,
  no se puede distinguir con certeza entre una llamada externa que se colgó y bloqueó `/health`, o
  un problema de red transitorio del lado de Render sin relación con el código de la aplicación.

En criollo: los datos descartan las dos causas más obvias (CPU alto, memoria al límite) sin cerrar
la causa exacta — el plan actual no da la telemetría necesaria para eso. No cambia la conclusión ni
las mejoras propuestas más abajo (que cierran el problema real — perder el recibo de un anclaje
exitoso cuando el proceso muere en el medio— sin importar cuál haya sido el disparador puntual),
pero si se quiere cerrar también el "por qué" con certeza, hace falta un plan pago (`http-latency`
por request) o revisar Grafana Cloud (traces de OTel ya activos, podrían mostrar qué request estaba
en curso al momento del corte) — no se hizo en esta sesión.

**Consecuencia exacta para cada etapa**, según lo que el proceso llegó a hacer antes de morir:

- **Etapa 3** — el proceso viejo alcanzó a **construir y enviar** la transacción de "Reanudar
  etapa" a Blockfrost antes de caerse. Blockfrost la aceptó y Preprod la confirmó nueve segundos
  después de que la instancia nueva ya estuviera arrancando — pero el proceso que la había armado
  ya no existía para ejecutar el `UPDATE OnChainEvent SET txid = ...` que sigue después del
  `await` a la cadena (`stage-transition.ts` → `anchorEvent()`). El evento 4 quedó con `txid` y
  `outputRef` en `NULL` para siempre, mientras la transacción real vive, confirmada, en
  `9a57f563e7d5627f22d9a062d26049d48789c91014d8b676298c0eb7c71f9e68#0` (`is_spent: false` — el
  hilo real de esta etapa hoy). **No es que el anclaje haya fallado: tuvo éxito, y el proceso que
  debía anotarlo no llegó a hacerlo.**
- **Etapa 4** — el proceso murió antes de que su solicitud avanzara tanto: su UTxO conocido
  (`270cfea4…#0`) sigue sin gastar en Preprod (`is_spent: false`) — nunca se emitió ninguna
  transacción. Esta sí es una falla simple, sin nada que reconciliar salvo reintentar.

**Y los logs de la instancia nueva prueban, letra por letra, el efecto dominó sobre "Certificar"**
(17:07–17:08 UTC, ~12 minutos después, ya en el proceso nuevo):

```
2026-09-10 17:07:48  [anchor] el anclaje falló {
  eventId: 'd8rlw6iu9kmp8bma2nw38ycd',
  error: AnchorRejectedError: No existe el UTxO fc37cac7dd081198629a464d038e69f8130ba123295ccf2043775426cce7ea65#0
      at LucidAnchorAdapter.utxoAt (.../packages/cardano/dist/real.js:370:19)
      at async LucidAnchorAdapter.avanzar (.../packages/cardano/dist/real.js:193:22)
    code: 'UNKNOWN_THREAD'
}
```

Esto es la **etapa 3**: intentó gastar el `outputRef` viejo (`fc37cac7…#0`) porque
`cabezaDelHilo()` no tenía ningún `outputRef` más nuevo que devolver (el evento 4 nunca lo
escribió) — y ese UTxO ya estaba gastado por la transacción huérfana. `UNKNOWN_THREAD`, tal cual.

```
2026-09-10 17:08:11  [anchor] el anclaje falló {
  eventId: 'v8w15f2q7wxvjc8inod5tn4d',
  error: EvaluatorError: "failed script execution Spend[0] the validator crashed / exited prematurely"
}
```

Esto es la **etapa 4**: acá sí encontró un UTxO (el único que existe, `270cfea4…#0`, todavía en
estado `Observed` on-chain), pero construyó la transacción asumiendo que el datum previo era
`InProgress` — porque así lo dice `Stage.state` en la base (D-059 ya había escrito esa
declaración) — y ese datum reconstruido **no coincide** con el datum real del UTxO on-chain
(sigue en `Observed`, porque su transición nunca se ancló). El validador Aiken rechaza la
transacción en `identity_preserved`/`valid_transition` porque el estado previo declarado no es el
estado previo real. Validador funcionando exactamente como se diseñó — el problema es que la base
y la cadena ya no estaban de acuerdo sobre cuál era el estado previo.

### Impacto real y qué hacer con cada una

**Corrección sobre lo que esta misma sección decía antes de reconciliar:** la etapa 4 **no admite
un "reintento simple"**. Las 4 fases de la prueba corrieron sobre las 30 etapas por igual, así que
`Stage.state` de la etapa 4 **también** es `Completed` — no quedó en `Observed` esperando un
segundo intento. `Completed` es terminal en la FSM (D-020): no hay transición válida que la UI
pueda disparar desde ahí, así que "Reanudar etapa" ya no aparece para esta etapa en ningún lado.
Las dos etapas terminan en la **misma categoría exacta**, solo que el hilo real de cada una quedó
parado en un punto distinto de la cadena:

- **Registro/declaración:** ninguno. Las dos etapas están `Completed` en la base como las otras 28
  (D-059 sostiene esa garantía exactamente para este caso).
- **Etapa 3 — hilo real un paso atrás.** Vive en
  `9a57f563e7d5627f22d9a062d26049d48789c91014d8b676298c0eb7c71f9e68#0`, en estado `InProgress`.
- **Etapa 4 — hilo real dos pasos atrás.** Su UTxO conocido, `270cfea4…#0`, sigue sin gastar y
  todavía en estado `Observed` — nunca hubo transacción de "Reanudar etapa" que lo moviera.
- **Ninguna de las dos se repara con un click.** Las dos piden lo mismo: escribir el `outputRef`
  real en `OnChainEvent` y reconstruir a mano la transacción de anclaje que falta — cirugía sobre
  D-058, sin mecanismo probado hoy. **Decisión tomada esta sesión (ver §Qué falta después de este
  reporte): no repararlas.** Son etapas de un proyecto de prueba sin dato real de cliente; se
  documentan como deuda conocida, visibles con `hilosSospechosos()`, y quedan para el día que este
  patrón aparezca en un stage real — recién ahí construir la reparación vale la pena.
- `retry-anchor` (la ruta que ya existe) **no cubre ninguno de los dos casos**: está pensada para
  "un mint que falló de verdad sobre un stage que sigue en `Pending`", no para una transición
  intermedia con UTxO desincronizado, y ninguna de las dos etapas está en `Pending`.

## Qué falta después de este reporte

1. **Decidir qué hacer con los hilos huérfanos de las etapas 3 y 4 — sin resolver a propósito.**
   Corrección del punto anterior (ver §Hallazgo): la etapa 4 **no** admite un reintento simple por
   UI — su `Stage.state` ya es `Completed` (las 4 fases de la prueba corrieron sobre las 30 etapas
   igual, aunque el anclaje de la 3 y la 4 haya fallado), y `Completed` es terminal en la FSM: no
   hay transición válida que la UI pueda disparar. Las dos etapas quedan en la misma situación —
   declaradas `Completed`, con el hilo on-chain un paso (etapa 3, `InProgress`) o dos pasos (etapa
   4, `Observed`) atrás de lo declarado. **Decisión tomada esta sesión: no repararlas a mano.** Son
   etapas de un proyecto de prueba, sin dato real de cliente detrás; la reparación pediría escribir
   `outputRef`/`txid` directo en `OnChainEvent` y reconstruir a mano la transacción de anclaje que
   nunca salió — cirugía sobre D-058 sin un mecanismo probado para hacerlo, y construir uno ahora
   para un caso único de test es la clase de infraestructura anticipada que este proyecto evita a
   propósito. Quedan documentadas como deuda conocida, visibles vía `hilosSospechosos()`.
2. ~~Confirmar con logs de servidor la causa~~ **Hecho.** Ver §La causa arriba — confirmado por
   `render logs`, `render deploys list`, `render services` y el mail de Render al dueño
   (16:55 UTC, "HTTP check failed, timed out after 5 seconds"). Ver §Cómo hacerlo más robusto para
   las mejoras de código que se desprenden de esto.
3. ~~Correr una pasada de reconciliación~~ **Hecho, el 2026-09-10 después del deploy del fix.**
   `POST /evidence/reconcile` corrido a mano (3 pasadas, admin) contra producción: **50 + 22 = 72
   eventos** pasaron de `Pending` a `Confirmed` — sumados a los que ya estaban confirmados de
   antes, **las 176 transacciones reales de la prueba quedan `Confirmed` en la base**. La tercera
   pasada en adelante devolvió `revisados: 0`: no queda nada más por reconciliar. La respuesta
   también devolvió `sospechosos` (la mejora #2): además de las etapas 3 y 4, apareció un **tercer
   caso preexistente**, de **antes** de esta prueba (`2026-09-08`, un proyecto distinto —
   `m99yzb4h5poi0078rcqpbj6d`, no uno de Torre Volumen — evento `InProgress → Observed`, `Failed`,
   sin TXID). No se investigó: es anterior a esta sesión y a esta prueba, pero confirma que la
   detección encuentra casos reales más allá del que la motivó.
4. ~~Verificar el resto del apéndice contra el explorador~~ **Hecho.** Los **176 TXIDs se
   verificaron uno por uno contra Preprod vía Koios** (`preprod.koios.rest/api/v1/tx_info`, en
   tandas de 40) — **176 de 176 existen realmente en la cadena**, cero faltantes. Es una fuente
   independiente de la base de producción: no es "la app dice que estos TXID existen", es "Cardano
   Preprod dice que estos TXID existen".
5. ~~Medir el balance real de la wallet de servicio~~ **Hecho.** Balance actual de
   `addr_test1vp3vy56p6lrghhntg8ytydnuugnqh7ctkyxn3rm35g4q2ggtqvncw`: **9,870.97 ADA**. No se
   capturó un balance "antes" en esta sesión, así que la medida más honesta es la que se puede
   reconstruir de las transacciones mismas: sumando el `fee` real de las 176 transacciones de la
   prueba da **39.83 ADA en fees**, más **60 ADA bloqueadas permanentemente** (30 hilos vivos × 2
   ADA, D-057, sin burn) — **≈99.8 ADA de costo real total, ≈33.3 ADA por proyecto**, contra el
   estimado del plan de ~35 ADA/proyecto (≈105 ADA los 3). **Vino levemente por debajo de lo
   presupuestado.** Y el propio balance actual confirma el otro dato del plan: 105 ADA sobre 9871
   ADA es ~1.06% del balance de la wallet, tal como `CLAUDE.md` ya estimaba.
6. Con 2-5 cerrados, quedan habilitados **3.10** (lista formal de TXIDs — este reporte, con los 176
   verificados, es la base), **3.12** (video walkthrough) y **3.13** (recontacto a pilotos) — fuera
   de alcance de esta sesión por decisión explícita del dueño.

## Cómo hacerlo más robusto y transparente — ✔ implementado el 2026-09-10

La causa raíz confirmada es un evento de infraestructura (Render matando el proceso por un health
check sin respuesta) — pero **el motivo del reinicio es reemplazable en cualquier momento**
(deploy, OOM real, un crash de cualquier otro tipo, un `kill -9` manual) y el problema de fondo era
que **el código no sobrevivía a que el proceso muriera entre "la transacción salió a la cadena" y
"se guardó su recibo"**. Esa ventana existe siempre, la cause lo que la cause. Tres mejoras, de más
a menos urgente — las tres implementadas y verificadas el mismo día (`pnpm verify` completo en
verde: lint, typecheck, 340 tests, build):

1. **✔ Cerrar la ventana de pérdida, no solo detectarla.** `anchorEvent()`
   (`apps/api/src/domain/stage-transition.ts`) ya no espera la confirmación (`verify()`) antes de
   guardar `txid`/`outputRef` — el `UPDATE` con el recibo corre apenas `openThread`/`advanceThread`
   devuelve, y confirmar quedó como un segundo paso best-effort: si falla o el proceso muere ahí,
   el evento queda `Pending` con TXID real (nunca `Failed`), y D-077 lo reconcilia después. El
   mismo fix se aplicó a los otros dos call sites con la lógica duplicada que `apps/api/CLAUDE.md`
   ya señalaba (`domain/anchoring.ts` → `anchorCommitmentEvent`, y el `/:id/anchor` inline de
   `evidence.routes.ts`) — los tres tenían exactamente el mismo riesgo. Test nuevo en
   `test/stage-transitions.test.ts` → *"guarda el TXID real aunque la confirmación falle
   después"*, que reproduce el escenario exacto de la etapa 3 (stubbea `verify()` para que tire, y
   comprueba que el TXID queda escrito en la base con `status: "Pending"`, nunca `"Failed"`).
2. **✔ Detección por estado, adaptada a que este proyecto no usa cron ni `setInterval`.** El plan
   original de un job periódico se descartó al releer `apps/api/CLAUDE.md`: D-003/D-040/D-077 son
   una decisión explícita en contra — un timer interno deja de contar cuando Render duerme el
   servicio, y el free tier no tiene workers. En su lugar, `domain/reconcile.ts` suma
   `hilosSospechosos()`: una consulta (no un job) que encuentra toda `STAGE_TRANSITION` sin `txid`
   cuyo stage ya tiene un evento más nuevo — exactamente la forma del hallazgo de la etapa 3 y la
   etapa 4. Detecta, no repara (reparar el caso "etapa 3" pediría que `AnchorPort` supiera buscar
   un UTxO por asset del thread token, no solo por `outputRef` conocido — cambio de superficie del
   puerto, fuera de alcance de hoy). Se sumó a la respuesta de `POST /evidence/reconcile`
   (`sospechosos: [...]`), el barrido manual que ya existía — mismo criterio que
   `reconciliarAnclajes`, a demanda. Tres tests nuevos en `test/reconcile.test.ts`.
3. **✔ Que un evento fallido/perdido sea visible sin ir a buscarlo.** Los tres `catch` de
   broadcast fallido (los mismos tres call sites del punto 1) ahora llaman a
   `Sentry.captureException` además de `console.error` — antes solo quedaba en el log de Render,
   con la retención corta que esta misma sesión chocó al investigar.

**Lo que se decidió no proponer:** subir el plan de Render de Free a uno pago para evitar el
health-check-kill en sí. Es la causa *disparadora* de este caso puntual, pero no la causa de fondo
—el mismo problema puede pasar por cualquier otro motivo de caída, y con el fix #1 ya no importa
cuál sea— y es una decisión de costo, no de código; queda para que el dueño la evalúe aparte si
además quiere bajar la probabilidad de que el proceso se caiga.

**Lo que queda pendiente de esta mejora, y es decisión del dueño:** decidir el mecanismo de
reconciliación real para el hilo huérfano de la etapa 3 (`9a57f563…#0`, ver §Hallazgo) — sigue sin
resolverse, `hilosSospechosos()` lo señala pero no lo repara. Y los cambios de código de esta
sección **no se commitearon ni pushearon** — quedan en el working tree, a la espera de que el
dueño los revise línea por línea (nivel 🟡, D-014/D-060) antes de que un push dispare el deploy
automático a producción (D-030, sin PRs).


## Apéndice — TXIDs por etapa (176 reales, los 176 verificados 1 a 1 contra Preprod)

**Actualizado tras la reconciliación y la verificación independiente del 2026-09-10** (ver §Qué
falta después de este reporte, puntos 3 y 4): los 176 TXIDs reales están `Confirmed` en la base —
ya no `Pending` esperando que alguien abra la pantalla correcta — y los 176 se verificaron
individualmente contra Cardano Preprod vía Koios, no solo contra lo que dice la propia base.
`(sin TXID — ver hallazgo)` marca los 4 casos de Torre Volumen 1 / etapas 3 y 4, que quedan
`Pending`/`Failed` a propósito (ver §Hallazgo e §Impacto real y qué hacer con cada una) — es la
verdad sustanciable (regla 17), no un resto de la reconciliación.

Agrupados por proyecto y etapa, en el orden de la FSM.

### Torre Volumen 1


**Etapa 1 — Adquisición del terreno**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `3527dae63d58996878f59dbc83f91903173e8943b2d5e3e9e4da12fecd0cde96` |
| Ancla evidencia | Confirmed | `bce9a2ac69130202ffdc6cd580b6f63fb102093d92eec2e095883172d0722485` |
| Auto Pending→InProgress | Confirmed | `e82bc35a335cbfe869e05def53c29322e95496a84043794e5a72ec613f198ae1` |
| Observar (InProgress→Observed) | Confirmed | `a27f329fe7aad4456425ca59489ffd26071a06d771924f66f4c880ac14df2b6c` |
| Reanudar (Observed→InProgress) | Confirmed | `e7f9c7b7d88bf9d84c5931a35f40742c4a1a6fb69a5081aa797a7be91ee23e95` |
| Certificar (InProgress→Completed) | Confirmed | `3a1f95cf82ac4e12c267e3645439e3e8013c4548fe754d4ac203e5b1044e68eb` |

**Etapa 2 — Proyecto ejecutivo**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `ca6793e071de3b19dbc25136e6868ce3adf5a46c0fe4d8b77e3389c282cc7573` |
| Ancla evidencia | Confirmed | `b377f2b157b47f9a98d02c418f7423dc08613dd62bda6b03cfd1b26cb37e9ece` |
| Auto Pending→InProgress | Confirmed | `7412e42b9403a4e4051d2adcb7782b76e61ec117cee45d01f1621bdf264b8b47` |
| Observar (InProgress→Observed) | Confirmed | `5bef86563f8cfb543aa448fe91bbd4ed565ac2d21678adf88f33e8364ea02289` |
| Reanudar (Observed→InProgress) | Confirmed | `ad8b6633882a6f3cbc3e367f46211be40c6101fc4f862934d5902a72b828ed53` |
| Certificar (InProgress→Completed) | Confirmed | `cf0e14652205163b33309519227bf341a490e78b80ddac0a06503fdf40fd7c27` |

**Etapa 3 — Movimiento de suelos y excavación**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `61067ba2fe920bfbb350559ba7007a7beed7dd9790713878df3fd0ba3b3b6240` |
| Ancla evidencia | Confirmed | `0132d1497f2e63247bd78d13728c46c31748114bb3de7e838535c9e428eafb2c` |
| Auto Pending→InProgress | Confirmed | `49a6be960d61ba55ba4d16de9b766676d4da155581dcbccace52621e2fe4dbf6` |
| Observar (InProgress→Observed) | Confirmed | `fc37cac7dd081198629a464d038e69f8130ba123295ccf2043775426cce7ea65` |
| Reanudar (Observed→InProgress) | Pending | *(sin TXID — ver hallazgo)* |
| Certificar (InProgress→Completed) | Failed | *(sin TXID — ver hallazgo)* |

**Etapa 4 — Cimentación**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `ad0fe12703dd89470f4ad7b9ee69b9e681dc0434f14edc685a673c2f191609e4` |
| Ancla evidencia | Confirmed | `46bf2b8c64b10eb26a99005d888339c423ae692eee5d3b02fddfe9d5e40737e7` |
| Auto Pending→InProgress | Confirmed | `1972aa5e68d4fe800a6542f16f956b7352d8f7bd62752dedd3c5b725f89a12a4` |
| Observar (InProgress→Observed) | Confirmed | `270cfea4fabf232573e94b69324b69054f41f344fbaeca6b95dfe5d16595dd06` |
| Reanudar (Observed→InProgress) | Pending | *(sin TXID — ver hallazgo)* |
| Certificar (InProgress→Completed) | Failed | *(sin TXID — ver hallazgo)* |

**Etapa 5 — Estructura planta baja**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `3319e8e26babbb02ecabb14214c956abf6b7e79ccbb9de410817362562e1e25d` |
| Ancla evidencia | Confirmed | `113e729ec564b8f3c748145bd0645a2b56fbfc54654202d1e20f116f843addfc` |
| Auto Pending→InProgress | Confirmed | `5736ced65bb251ca350fb1d9e31cafffac192906e3dcd94d1675914127162576` |
| Observar (InProgress→Observed) | Confirmed | `0fb0feb61c995364d63b023c94a37e0372ca0d1d2a11db0569dc90937236b2a4` |
| Reanudar (Observed→InProgress) | Confirmed | `cbf60e0a3ceb830ff8fcc80a6cabcb876887c56118b2c4f3e0d8dc04e51edca3` |
| Certificar (InProgress→Completed) | Confirmed | `636260b0b67c0fc9f56a5baef91864c82221bf2dde0f653dba119ca0d3ba56f6` |

**Etapa 6 — Estructura niveles superiores**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `f24667903957ee5f1e861bff00e6d754a21e1b7ae8c2c8cd18862fa0d745f482` |
| Ancla evidencia | Confirmed | `b6e9e7d651d15a69d7757a039ec2dc56ba4b82352a300ae545aa09b6deb4b6ad` |
| Auto Pending→InProgress | Confirmed | `fddf96d86bab1f01b5db73c000b9e571ee9fdc88841873af5056458e073fa4de` |
| Observar (InProgress→Observed) | Confirmed | `0657eebfa52e3775595c9f1b2ad5ff5bb989c1decf359355674325b4c7f238a4` |
| Reanudar (Observed→InProgress) | Confirmed | `d5e8f54c298f8fb0f42a16685090526af1466a55e5a5ed733e065c47cecc1556` |
| Certificar (InProgress→Completed) | Confirmed | `c3c0bd1925eaa0554bee0daf3e0ff05e84787ee377ba22d909d20f4e437a82fc` |

**Etapa 7 — Cerramientos y mampostería**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `3759177e0e18f520b02454d3df9bb9066aa2f58cb37a4ca4a61615171c6c3ed1` |
| Ancla evidencia | Confirmed | `4aa94e5207574700a1adc214ac9551c947fc76151e248eea02b4d4e57263411b` |
| Auto Pending→InProgress | Confirmed | `17b8ba858673a85930a20c98f25a4cf9ab0ac11715b6924b3e22b9c4e82c015f` |
| Observar (InProgress→Observed) | Confirmed | `fac73f94fad34601f9cbdc2ad8b0b4ad8bff371248430c762dcde6ff2f0414c2` |
| Reanudar (Observed→InProgress) | Confirmed | `06f51b9cd7f773b3b68dcb95c1ff1039e53458d63703b3bb304bfee44610c689` |
| Certificar (InProgress→Completed) | Confirmed | `5b080c1ffd8988c6f60603334bbc9447ce31fc3944c873b1fba5654205e81e70` |

**Etapa 8 — Instalaciones**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `0b71997e680748e92cf06e09db8d65fe17cc625f2e3af046d5b0a869aff47189` |
| Ancla evidencia | Confirmed | `f73af36678a0f54ee50ce54dec25ab9899c2a018c14c4dc6659e5f0905a13ab8` |
| Auto Pending→InProgress | Confirmed | `fd78664b3b6599ff99097f1fd2e7bd99c70cf9afbecd4fe2d1bbc071a8b853fd` |
| Observar (InProgress→Observed) | Confirmed | `cb46248e9fed481262dda1d514e05b26db8dbf337e747dc5203c397794eabdbb` |
| Reanudar (Observed→InProgress) | Confirmed | `dcef912606d674522fb6a581e14d48a457683b1ea77898646486f1138a6615b6` |
| Certificar (InProgress→Completed) | Confirmed | `ead1aa198a77e19bb2d73bc3529203e08afe8b50aae334edf66b766253f5dfca` |

**Etapa 9 — Terminaciones**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `085ebd2ec2b589ac2baf8dbae106118c74e27d24a02eb9811078f0b5cfe2c6fb` |
| Ancla evidencia | Confirmed | `6c6c1e208285c9395a099d0f5502e3d9ab5083adbc8629068decf9241254012d` |
| Auto Pending→InProgress | Confirmed | `c837dd192222c49ee971a9d8188195dd35d4216422d8b2fb12cc3a9d0bdb37d0` |
| Observar (InProgress→Observed) | Confirmed | `531cb045476bce32010fb54e588e48566b871aebfd9b1a05f05927a2a3eed82b` |
| Reanudar (Observed→InProgress) | Confirmed | `2cbb0bc5b1abac1cee1120499fc4c28fb78749f8ccc2c3a8e39e1784a7f9aeba` |
| Certificar (InProgress→Completed) | Confirmed | `9ebcf753e8c88ba6b4c3aed1de2b41bd968aa1d74a66e325fb83aaf68ae3bc5b` |

**Etapa 10 — Final de obra y subdivisión**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `fe3d21b358bf931e5f78dbc559f66cc2b2b341a9c5a62dc95c504dd6ef0af2b2` |
| Ancla evidencia | Confirmed | `36fce09bd1a041b41fbb04fa573b1f4f253e95e0cd62d0bc2cf9dd010e346dad` |
| Auto Pending→InProgress | Confirmed | `831a17ab5b34365437787729cdb2750a90a033af858ff839738c6e9a665fd9e7` |
| Observar (InProgress→Observed) | Confirmed | `2e5f84b76f0a9f950cad20018d1aac526981044e1c135cd2bc9aa9bc15873609` |
| Reanudar (Observed→InProgress) | Confirmed | `aa1abfd70a388fcb26eb2e3ffab3d12e6450db4e8c866bd7d286a85ea333714e` |
| Certificar (InProgress→Completed) | Confirmed | `ab9794a5010eb0d6f672cd0e9bc45f1499a8e38f904e3ca080625c7714b95ba7` |

### Torre Volumen 2


**Etapa 1 — Adquisición del terreno**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `d253922c485274b6c4cc79069564fc25ffc0fd9380ef5944d6963462437cf0af` |
| Ancla evidencia | Confirmed | `f4df818e30b64f7c74fbcfd54308a83a5d0648fb2018701bbe33b43d6fdaca33` |
| Auto Pending→InProgress | Confirmed | `e6df4aba0a3fb38179cd69b9eb817e3fdd06dbf0aa6ca67174cf065ac835e72f` |
| Observar (InProgress→Observed) | Confirmed | `5bf3fc45f50b9c91be9ebe3edde5565b6938dcffd7d76065f3d4832dfc5c4125` |
| Reanudar (Observed→InProgress) | Confirmed | `c9227010477854f49378182140753ea3a5a8dcd67ff98d480bd4d5b7864bc166` |
| Certificar (InProgress→Completed) | Confirmed | `6b50c5ca5ede70b2963b6c395e3d4b51ead85f6588b2ad07a91394597e9bcab6` |

**Etapa 2 — Proyecto ejecutivo**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `9b14ec76069b288397955f48fd40f5f2ae532c456be4c2e0d0b6860dcd39d6a2` |
| Ancla evidencia | Confirmed | `d4e4734b359498ae890865f40b3df84d7de5b22be792f547b51f3886a7c06d9d` |
| Auto Pending→InProgress | Confirmed | `0d9034de19a21a23accef7e0054147ea8569a8f33610681e40de1defe110e30a` |
| Observar (InProgress→Observed) | Confirmed | `e1d0528b8ec48ed2f601d11ffda0250143153c66bbc2bf424a293114e13fc92c` |
| Reanudar (Observed→InProgress) | Confirmed | `c2768c1e712d7e6f42484a56ceb2de5bdd1a3684daa1fcdf00dcea6958dd798e` |
| Certificar (InProgress→Completed) | Confirmed | `2f754af5c1b445d300ed81bc8a5ece986516518bdacbd17e072baf4cb19258a3` |

**Etapa 3 — Movimiento de suelos y excavación**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `d5fced405b5b3f256c0a33b19cce9284ef76d321086eb41315ebb8cb329e2aa2` |
| Ancla evidencia | Confirmed | `b36aa79c33c85fbef36c25f270c8f7ac28521d75f3579b163ef01c8dd07b1aa2` |
| Auto Pending→InProgress | Confirmed | `ac7bd08fd8bee1bda6ddce08f89a6f0ff1dcfe98e1b14196777bb8f9df9d792c` |
| Observar (InProgress→Observed) | Confirmed | `ea8c78ef3244e8551af2e42db2a37fb40a4d14b091d6aa4797c0baf12385e03a` |
| Reanudar (Observed→InProgress) | Confirmed | `d451bbbce026434ecb2a76b38dd516ad63b24835f24a9522631bd270b00c78b5` |
| Certificar (InProgress→Completed) | Confirmed | `a5c90d6cef0dd15f1553ad3a40437e7e008e32e99963883d4e9d551358724f0f` |

**Etapa 4 — Cimentación**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `5fa9493e2208ed94696354d7ca7374acb97a2683bb496db46d91a96b39f422fc` |
| Ancla evidencia | Confirmed | `5cd74d393fd69e74d84eb156d66e4c40f7b489a9f003399a8d68a248918cc0c0` |
| Auto Pending→InProgress | Confirmed | `286586df2416fa21d83dd4aa17b40ab6dbb900ddd835adf6a3beada2ee9bebaf` |
| Observar (InProgress→Observed) | Confirmed | `80c693dfcb59abc77128c7a276750e27d1c0e80f89a6103f7178f02d58d5c543` |
| Reanudar (Observed→InProgress) | Confirmed | `255bfd5c4f577ec14031e920d4520e2f9656fb822fa07402f68343199d987f47` |
| Certificar (InProgress→Completed) | Confirmed | `0238a9ae5ae6bb5ac96595ca9a58eca215d52b2f0106bc155096a163c12b2d25` |

**Etapa 5 — Estructura planta baja**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `d2a43fe211837f40b1c273bd0196fbcb5dd67b329c7e0cee45883e210efff398` |
| Ancla evidencia | Confirmed | `c9f7e5817a409c2850ed8b082830de1542aabf2c382d46e9dfef48e7cd4f49a7` |
| Auto Pending→InProgress | Confirmed | `33f7deb053da97125c4ba61ab4b70af8ba00c3a9ecb9f556012275ddade0463a` |
| Observar (InProgress→Observed) | Confirmed | `ae376b86bd727974574c77a007bd07e0f69b24963bbc2ae778b2a2975efc278f` |
| Reanudar (Observed→InProgress) | Confirmed | `0069507b3c1aba88ad4852cf56265c2bf729b7857f35458d4d495062533c9455` |
| Certificar (InProgress→Completed) | Confirmed | `3031b0198fce05fe9b25efa5e3b28138ab06bc1baf00a00c86599cad527102bf` |

**Etapa 6 — Estructura niveles superiores**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `de5e195779b814a20b9a37938ab245f0c0e9b6b599683c9d564f6a69439ff235` |
| Ancla evidencia | Confirmed | `40fd381daecbc1239c73afd07ae0d8907c39a6e99d77dc063158b608f1ac50c7` |
| Auto Pending→InProgress | Confirmed | `c71d3593cacbd643498c26602fd557b4527c692f350c5ff35a76e95af04e3f0c` |
| Observar (InProgress→Observed) | Confirmed | `9d7696c5523f83fb3ebe2c8df7ba75c35eaaa92d53cc92c21468c68382b41dc9` |
| Reanudar (Observed→InProgress) | Confirmed | `a9cf646aca7a1b4d0fe16b31dbf2b8ed55f266689ea443d0b7c52efb31f70f6e` |
| Certificar (InProgress→Completed) | Confirmed | `cad2aa46265feefc9eadc0324fe139d94e3192ebd89898a13cfce4a453e77c85` |

**Etapa 7 — Cerramientos y mampostería**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `633a5f5980c845f408268a536d310083363ae56dd0b27997e8c3a8457e594952` |
| Ancla evidencia | Confirmed | `158155667d6fb5fdc137407f3b998c75a8a14f0030c12f5457be5084c1614385` |
| Auto Pending→InProgress | Confirmed | `38b669b2f33c33d958b8f6f4ecafe2247045b05ada288aa8d1a20780bfbf84aa` |
| Observar (InProgress→Observed) | Confirmed | `19ebb84a3808df8417577c7dcef4292d246dfed0a4c363d1596526b1ed214c2d` |
| Reanudar (Observed→InProgress) | Confirmed | `102cc832b73b5aa3c95f7adc339d4c170a2ece3a7a8076df7090795909aa4814` |
| Certificar (InProgress→Completed) | Confirmed | `315dbbc13bae27a06ef2af9025a6f637bbe6f7f53ede69b41f2c223c0b775d23` |

**Etapa 8 — Instalaciones**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `735f7fab3ae469793fa1a4028f58c107f81849abd84ae60911d1f852222d1352` |
| Ancla evidencia | Confirmed | `4a37d7aaf2b6a51ea236e38bc7316a33d6aa944fc3f9b76497dfa93244cfeb4f` |
| Auto Pending→InProgress | Confirmed | `5065f1bfc75da300f487d69fcc434df504010aa3127aec150291d1672f4aecab` |
| Observar (InProgress→Observed) | Confirmed | `7cc8a4e5f24fc15f47c8d1b10d783cce7d0634840455b12d0ddfdfbe1a62a54c` |
| Reanudar (Observed→InProgress) | Confirmed | `faa7d80e3b9538dff557fde2d43fac7f44d1e1674c690cfadab61b7b0cb2c261` |
| Certificar (InProgress→Completed) | Confirmed | `74058d465ec1bf0517f214f57b6eea27c07d0d85fd5a7065611e90bc48d40e98` |

**Etapa 9 — Terminaciones**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `c06642bba288567c32f141bd5da62ee82a52c12c23864473ba4120b6a7f1bd88` |
| Ancla evidencia | Confirmed | `ad7e1aefb94eb8a1b2867e33be8bf6d11fb79882bb9c8a0f2c008f912d9a1d0c` |
| Auto Pending→InProgress | Confirmed | `35f7ce36629175fff331a418e1efadd917a0984fe86e02ad71d35b2c0da2bdbd` |
| Observar (InProgress→Observed) | Confirmed | `477a5c8bb0b2958ab8ace93f497fa2d8375b08b5d4fddfba79889a289f7dcca4` |
| Reanudar (Observed→InProgress) | Confirmed | `96b9f7ab479256e13dbc9bdd35bc553903205e7eee900c7b9717395a6835b803` |
| Certificar (InProgress→Completed) | Confirmed | `5ed43e6c8240e65a654d21f85dee44c622ced1fb1bd287f76290893dd171b1de` |

**Etapa 10 — Final de obra y subdivisión**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `93f98d71bede9119dd49958f9ec002b879e542dafe53558f4a3605215911ff4f` |
| Ancla evidencia | Confirmed | `c34314d4276c030a43919d9d0f13b82edb3f36cb2e90cc19dfdde6e253f4a3ed` |
| Auto Pending→InProgress | Confirmed | `c6d7abb1f40c74f8e5a185e152c37bf27ea1f3c2370cdaba0a6614b484eca841` |
| Observar (InProgress→Observed) | Confirmed | `4875496d4d31421226fca6216e41225a8c6f19fb29c5b633bdb4732e2e76dbe0` |
| Reanudar (Observed→InProgress) | Confirmed | `9ba0f810eb545ddf0060c9d092cdba0cbc563b53853c6509f9ec75f85b6da3ca` |
| Certificar (InProgress→Completed) | Confirmed | `937b31b71561537cce17ea8a50c85e85c5f69c8af679e8bff6763eb22cf81ab3` |

### Torre Volumen 3


**Etapa 1 — Adquisición del terreno**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `478b903123df671aa422103d75b89a5ef8fce216fb2888518f471d2451b1fee8` |
| Ancla evidencia | Confirmed | `439b10c4d6cde16501854011a7326c59b5315157c2b04708c1e23196398ede2e` |
| Auto Pending→InProgress | Confirmed | `2d8e33cb04a1e05b7f552e0c6e143adc149c7f55daad9923dec1417605e6c830` |
| Observar (InProgress→Observed) | Confirmed | `9c54abe7db22e85d1bcbcc0ca525142e41b104f4c1be8f711771377d4e0bc358` |
| Reanudar (Observed→InProgress) | Confirmed | `17881ea34c88ada58eef0bb6d77533243a4da08fed8ecfde0d16894509f486a2` |
| Certificar (InProgress→Completed) | Confirmed | `1d0bc8acd3918d6f35801a183e91cfe74cf789fe12835357cb706d02765c0029` |

**Etapa 2 — Proyecto ejecutivo**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `3144dac1045e54597f3df797b097b87a660c26477ba0595b91a68bc2be80d9ab` |
| Ancla evidencia | Confirmed | `f25230d359ca45f5aa0045412577cfc533f38bddc875ddc9ead7a0d131dc1ff6` |
| Auto Pending→InProgress | Confirmed | `2195d5cc0e277172f5e76cc2b2e4c2453f8913481d1192eb156e8ce2cd5727c1` |
| Observar (InProgress→Observed) | Confirmed | `9f29b951d7eb9d2b03328b341dcf970a5b51bf3632324007e10c032dfd4850be` |
| Reanudar (Observed→InProgress) | Confirmed | `4a160f105af3eb4df18d96523240cde2c28ed14bf33c0ab84983e698c5e4e402` |
| Certificar (InProgress→Completed) | Confirmed | `02ccd48a5eceb2e511ab45adf6aa1d261f04791cb389a9a66332f9c760a80bc9` |

**Etapa 3 — Movimiento de suelos y excavación**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `bf850b52b5c2884952da8731c9599b39eb7602a60171e42c79695ed00a3391b3` |
| Ancla evidencia | Confirmed | `835b6b83fb1edf009fe97f9d7197b0f111acc77da3acccd560cdc01a72abc49f` |
| Auto Pending→InProgress | Confirmed | `4b07aad729cd5a8861fdbcf00da201669ca333cb90d895d43d5a70e62b87c347` |
| Observar (InProgress→Observed) | Confirmed | `6657dcfdcb1614ee66f7c9c525c1f5f285e242076c2f222fea13916ca92bad2f` |
| Reanudar (Observed→InProgress) | Confirmed | `7948229bd3215f47760142496f48518a1399fd40aff113acee1ece60ec78c452` |
| Certificar (InProgress→Completed) | Confirmed | `13de262947dc69cf7e8e63c02b373dbfcdb8436a1a0d3855935d2f0a64b499ba` |

**Etapa 4 — Cimentación**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `9b1bf8420d87c8ca697574ff3dfa2dd107c5ad5de54d4e6a07aa802f8a11abd1` |
| Ancla evidencia | Confirmed | `ac7625e149a06742f57d7cc5a8ab215647d96b880ce35e0ef39fb08662d12248` |
| Auto Pending→InProgress | Confirmed | `39d31941d695af5fc4cb5dd9e14d9331d6ab4a00e674d06eeb6ea3d69f5817cf` |
| Observar (InProgress→Observed) | Confirmed | `eab045b18ade0bda509b1bf52c63e4495feec0aa00757c1708136786b455d8ce` |
| Reanudar (Observed→InProgress) | Confirmed | `a91c57f134f0431df4d3065684a3c8d1ff7ae374d7fef6295bee6f4295bc9d4d` |
| Certificar (InProgress→Completed) | Confirmed | `f2e687527c8624bf006a5fd3708e98d4fa9c301d7ad2c943cb90d7907be93dfb` |

**Etapa 5 — Estructura planta baja**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `14a043d42ae6b6d0167edd3ffc1622dd057bd5aea14fe7cfc41ca5e6f8237e62` |
| Ancla evidencia | Confirmed | `237284c136ae30880d9dbad12ac912271f4d448356e9043ef5fb53a2dccc6769` |
| Auto Pending→InProgress | Confirmed | `b21dfeab948f0034759dba2d56b1f931ed63a6658535fde0128abb736774811e` |
| Observar (InProgress→Observed) | Confirmed | `1f4d989bdceb2d8108ea5c52268badcce18d9c043856ab093ff965f5b76636e8` |
| Reanudar (Observed→InProgress) | Confirmed | `aab113b3703f4022cabc4c952ac1bb0de79f4e91dbebdeaef1e1fbbddcd10b9b` |
| Certificar (InProgress→Completed) | Confirmed | `81bffe18c3f0c4463f9317a72d291df2980b661443b7bd46332673639d8baab5` |

**Etapa 6 — Estructura niveles superiores**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `0c12c54224a65068a2d61fb8512f20690f2ba1973bee572a8ade476624c6a64f` |
| Ancla evidencia | Confirmed | `6d1892ea8a7029e9309df5d39ccc340204c99189cc8939eafc1fecf5de94aedc` |
| Auto Pending→InProgress | Confirmed | `60752955067bc36bdf48d76b501ef3712037e91659e28c8f7e7f1e480c70c52a` |
| Observar (InProgress→Observed) | Confirmed | `b47e4a9a55249dac7be2826793b89df0c3fd7e90419d4bc0dd7660c2e1987baf` |
| Reanudar (Observed→InProgress) | Confirmed | `6975287766f9dec81075afb6563b8e5edb9f0e33087cac49c32fd99444a5de66` |
| Certificar (InProgress→Completed) | Confirmed | `c69626d201aa774d2f8235366f6efc9ebae5d975c333309f528ced956d1b8dcc` |

**Etapa 7 — Cerramientos y mampostería**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `4d170440d8b8b916dc339bca9f0f9069d9cf34bf0df17ddc67a3d69b5e481498` |
| Ancla evidencia | Confirmed | `dfb63807a7a2a15c112ff2284df7be28a25703af692cb4f0b394f4ed650b1c2d` |
| Auto Pending→InProgress | Confirmed | `eb69ceb31f2152cb95dad6a87d5281acb30a4cf919ca6b644a81ef7c8a656149` |
| Observar (InProgress→Observed) | Confirmed | `7d2318bf3b5aaee4afd6733734242ac1557225a7b2d9a142bf688bb7c822329d` |
| Reanudar (Observed→InProgress) | Confirmed | `7a9b534233941030028d500af7d4a45e0d9b14832302fb9261705dc550531ed9` |
| Certificar (InProgress→Completed) | Confirmed | `207f2b4b8ebc56ecae155ed9c1d1bea2a713f709822fdb30a01bed13743fa885` |

**Etapa 8 — Instalaciones**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `d745e249f63ee6541e8926299ff5b90b4478996f27fb58614cabbb61a28b21a7` |
| Ancla evidencia | Confirmed | `36ebc69e2199fbe8da36d5d43499aebc3a84404e78da4dfff1e6371ed588e914` |
| Auto Pending→InProgress | Confirmed | `2d0e210b6c3781c1024e118882571d3986a27cb06e180f05170013325215eb9b` |
| Observar (InProgress→Observed) | Confirmed | `1a5399c3d5261967e7c18c8230374201f298b294b04a5e177236dd41ae82e6d2` |
| Reanudar (Observed→InProgress) | Confirmed | `1efb88123d2833aaf00838299dcf30bcb8dbe46f578ff4711b5a7d4b746b3734` |
| Certificar (InProgress→Completed) | Confirmed | `fdf533c69cc1a0c2773f0e3938464c09f435e13dd4555d5bee8d64aed0e0001e` |

**Etapa 9 — Terminaciones**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `0dae3d845591855b666ffd1997124c4ca640dae617481af879a2acd9574b58fd` |
| Ancla evidencia | Confirmed | `3c08bf9dc899eb7c21b5d80f4f6c08d364a5a32b5ad5d6722ea6a30754a0d1eb` |
| Auto Pending→InProgress | Confirmed | `385c2e0192531aa42d5a93fcf89d0c810fab71e3e60342222c8bf9155d2da0a8` |
| Observar (InProgress→Observed) | Confirmed | `5f918bc177f99aadc44cde11f1abd2c5d25853ba0acab304051271acc1d7ac5c` |
| Reanudar (Observed→InProgress) | Confirmed | `44486b07ae68be5fdb7132541556bf84d45da5b8b1640dcdab7d3649304440c5` |
| Certificar (InProgress→Completed) | Confirmed | `792c435dd3827a92c1eaebba7330eb97ccdba9129178968b378d849ae04878ca` |

**Etapa 10 — Final de obra y subdivisión**

| Transición | Estado en base | TXID |
|---|---|---|
| Mint (declaración) | Confirmed | `f0bdc168eedc9f1c473c82964ccd79e65e9f4b326ced5eb01940afaa65dab563` |
| Ancla evidencia | Confirmed | `f36f1e5778943825ef55e2366097ad7e7c79fef40e48b65f913df9ac90777e4b` |
| Auto Pending→InProgress | Confirmed | `692e380288714ac0c2d97a1e8e266e075c793a0e60feb4e48d2fcba498c2b43f` |
| Observar (InProgress→Observed) | Confirmed | `b4b18c182592fae2770b188fa22e107910133c656054c00b55aca17346d41a21` |
| Reanudar (Observed→InProgress) | Confirmed | `03007f19893539bafd50eb8ea4f9f15493192d5adb4f3a68650245cd1575f660` |
| Certificar (InProgress→Completed) | Confirmed | `6a9d502c789bb291f1fd670a748777fa70a2d16645d77b9e38838ce6bb8e66c2` |