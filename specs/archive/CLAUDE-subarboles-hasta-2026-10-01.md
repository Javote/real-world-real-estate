# Los CLAUDE.md de cada frente, hasta el 2026-10-01

Versión completa, con la narración de cada trampa, de antes del recorte de la pasada de prosa
([`AUDITORIA-2026-10-01`](../AUDITORIA-2026-10-01-arquitectura-api-y-web.md) §6). Lo vigente vive en cada
`CLAUDE.md`, una línea por trampa; esto es historia y no se mantiene.


---

# `apps/api/CLAUDE.md`


> Se carga solo al tocar este subárbol. Las reglas duras (Zod, dos capas de auth, `AuditLog`,
> bcrypt, uploads, idempotencia, claves de traducción) están en el `CLAUDE.md` de la raíz y **no
> se repiten acá**.

Express 5 + Zod + JWT + bcrypt(10) + Multer 2.x + Kysely/SQLite (`@libsql/client`), base `/api/v1`
(D-016, D-036, D-048 → D-049 — Prisma → Drizzle → Kysely, los dos migrados el 2026-08-21; los
restos que quedaban se barrieron en D-052).

Está mejor parada que el frente: **la API se evoluciona, el front se reemplaza.** Se conservan
auth JWT+bcrypt con autorización en dos capas, SHA-256 en el servidor al subir, `AuditLog`
append-only y el shape de `Project`/`Evidence`.

### Antes de tocar un endpoint

`M2-D5` §4-6 trae el path exacto, los test IDs y el work stream; `M2-D6` §9 el baseline. Los paths
van **scopeados por rol** (`/investor/`, `/developer/`, `/notary/`, `/certifier/`). El backlog de
M2-D5 §4-6 está **completo**: los 18 work streams `M3-BE-XX` tienen sus rutas montadas y con test.

Lo que queda fuera del backlog y sigue vivo: el CRUD genérico de `/projects` (crear/editar/borrar,
miembros) y `/users` — admin-only, ops y fixtures. **Desde D-095 (SPEC-221) `GET /users` sí tiene
caller**: la pantalla `/admin`, que además usa `POST|GET /projects/:id/certifier-invitations` y deja
que el certifier responda por `/certifier/invitations/:id/accept|decline`.

**Tres rutas se borraron el 2026-09-08, todas `developer`-accesibles y sin un solo caller real en
el front** (confirmado con `grep -rn "api.uploadEvidence" apps/web/src`, cero resultados, y lo mismo
para la de stages): `GET`/`POST /projects/:id/evidence` (sombra exacta de la ruta real,
`POST /developer/projects/:id/stages/:stageId/evidence`, M2-D5 fila 38) y `POST /projects/:id/stages`
(crear una etapa suelta). La primera confundió una sesión entera antes de encontrarse; la segunda se
pensó al principio como "la base para una futura UI de agregar etapa" —hasta que el historial mostró
que es **anterior** al Stage template de 10 (`git log`: existía antes de `DEFAULT_STAGE_CATALOG`) y
que nadie repreguntó si seguía haciendo falta una vez que el template llegó. Ni M1, ni M2 ni M3
mencionan agregar etapas después de crear el proyecto. Los tests que necesitaban un stage con hilo
real para probar transiciones migraron a `test/helpers/stages.ts` (`crearStageMinteado`), que hace
lo mismo sin pasar por HTTP. Ver el detalle en `CLAUDE.md` raíz.

### Checklist de un endpoint nuevo

1. Schema Zod en `packages/shared` — **antes** que el endpoint (regla 6). El front importa el
   mismo tipo. Es lo único que vuelve imposible el drift API↔web.
2. Ruta con **`authorize({ roles, acceso })`**, los dos campos obligatorios. `acceso` es
   `"soloRol"`, `{ proyecto, membresias }`, `{ dueño }` o `{ alguna: [...] }`. Nunca un `if`
   adentro del handler — **no hay otra forma**: los tres guards sueltos se borraron (D-088).
3. `safeParse` → 400 con `error.flatten()`.
4. **Path params con nombre nuevo** (`:algo` que no sea `id`/`projectId`/`stageId`/`contractId`/
   `unitId`/`bundleId`/`fileHash`/`shareToken`/`stageNum`): sumar su forma a
   `packages/shared/src/params.ts` y su `router.param(nombre, paramValidator(schema))` en el
   archivo de rutas — y a `PARAM_SCHEMAS` de `generate-openapi.ts`, o el OpenAPI documenta un
   `string` genérico para algo que sí valida. Si el nombre ya existe en la lista de arriba, no hay
   nada que hacer: ya está cubierto en ese router.
5. `writeAuditLog` si es mutación relevante.
6. Test del camino feliz y de cada rechazo.
7. Path y test ID **idénticos** a los de M2-D5.
8. La ruta entra en la matriz de `test/route-guards.test.ts` — el test se pone rojo hasta que la
   sumes, y sumarla es donde mirás si los guards son los que querías. Ver §La matriz de permisos.

### Trampas verificadas

- **2026-10-01 · El audit log mostraba las transiciones de etapa sin tx, ancladas y confirmadas.**
  La pantalla lee el txid de `AuditLog.metadata.txid`; `ACCEPT_INVITATION` lo guardaba y
  `transitionStage` no (solo `from`/`to`), aunque ancla dos líneas antes. Ahora lo guarda, y como el
  audit log es append-only, `GET /developer/audit-log` les busca el txid a las entradas viejas en el
  `OnChainEvent` de esa transición (`conTxidDeLaTransicion`). **Un anclaje nuevo que escriba
  `writeAuditLog` tiene que poner su `txid` en el metadata**, o la pantalla no lo ve.

- **2026-10-01 · CORS no permitía `PUT`, y la portada del alta (D-099) fallaba desde la web con la
  API sana.** La lista de `Access-Control-Allow-Methods` de `app.ts` era `GET,POST,PATCH,DELETE` y la
  portada es la única ruta que la web llama con `PUT`: el browser cortaba el preflight y la pantalla
  decía "the cover could not be uploaded". **`curl` no hace preflight**, así que la ruta respondía
  200 en cualquier prueba por terminal. Lo fija `test/cors.test.ts`. **Si la web empieza a usar un
  método nuevo, sumalo a esa lista en el mismo commit** — y probá desde un navegador, no desde
  `curl`.

- **2026-09-28 · `fs.createReadStream(path)` abre el archivo después, no cuando lo creás.** Si nadie
  consume el stream y el archivo se borra antes de esa apertura diferida, el `ENOENT` sale como un
  `error` sin listener: excepción suelta en el proceso. Pasaba en `S3Storage.put` con el cliente S3
  mockeado (el `send` no lee el body y el test borra el temporal), y tiraba CI de vez en cuando.
  **Un body de archivo se pasa como `(await fs.promises.open(p)).createReadStream()`, con el
  `close()` en un `finally`**: el handle ya está abierto y no hay apertura tardía que falle.

- **2026-09-22, más tarde · Los deploys que fallan con "Timed Out" los tumba el apagado por
  inactividad del plan free, no el código.** Render duerme el servicio a los **15 minutos sin
  requests** y manda `SIGTERM` a todas las instancias, incluida la que se está deployando. Si el
  deploy arranca 13-15 minutos después del último request, la instancia nueva muere a mitad del
  arranque, Render escanea un puerto que ya no existe hasta el timeout, y la API queda ~18 minutos
  caída. Verificado en tres deploys fallidos (cero requests y 15:00 minutos exactos entre el
  `live` anterior y el `SIGTERM`, las tres veces). **Corrige dos entradas de abajo**: la del
  2026-09-22 ("un Blockfrost lento") y la del 2026-09-04 (`ef8e55e`, "arrancó bien catorce minutos
  antes"): las dos son este patrón. Los cambios que dejaron siguen valiendo por sí mismos (escuchar
  antes de inicializar el `AnchorPort`, los logs de arranque), pero no eran la causa. Cómo evitarlo,
  y la decisión pendiente del ping periódico: `specs/RUNBOOK-deploy.md` §2.

- **2026-09-22 · `server.ts` esperaba a `initAnchorPort()` ANTES de escuchar, y un Blockfrost lento
  tumbó un deploy de Render por timeout de port-scan — con `ANCHOR_MODE=real`, la wallet de servicio
  se derivó bien, el puerto abrió bien, pero después de que Render ya había mandado `SIGTERM` por
  "Timed Out".** El log del deploy fallido mostraba la secuencia completa y sana —migraciones,
  instrumentación, `AnchorPort listo en modo "real"`, wallet, `API listening`— y recién ahí
  `[SIGTERM] cerrando`: no fue un error de código, fue el orden. El commit que disparó ese deploy
  (`f3296ed`) era **solo `.md`** y ni tocaba `apps/api/**` — lo redeployó el bug ya documentado de
  `buildFilter` (ver el comentario en `render.yaml`, con precedente del 2026-08-24), y el commit
  siguiente, con el mismo código de arranque, deployó bien: confirma que era latencia de Blockfrost,
  no una regresión. **⚠ Diagnóstico corregido el mismo día** (entrada de arriba): no era Blockfrost, era
  el apagado por inactividad.
  **Por qué el orden viejo ya no tenía sentido.** El comentario original justificaba esperar con
  "una config de anclaje rota tiene que impedir que la API levante, visible en los logs" — cierto
  hasta D-075, falso desde entonces: `initAnchorPort()` ya no tira, atrapa todo lo esperable y deja
  el puerto inhabilitado sin matar el proceso. Con eso, esperar antes de escuchar no evitaba nada —
  solo retrasaba el puerto tanto si Blockfrost respondía bien como si tardaba o fallaba.
  **Fix:** `app.listen()` corre primero, sincrónico; `initAnchorPort()` corre después, sin bloquear
  el puerto — `.then()` loguea el modo y la wallet, `.catch()` loguea sin matar el proceso (debería
  ser inalcanzable: D-075 ya no deja que rechace). `anchorPort()` (mismo archivo) sigue tirando si
  algo la usa antes de que esa promesa resuelva, así que la ventana real es chica: solo una request
  de anclaje en los primeros segundos de un arranque en frío ve un 500 en vez de esperar — login,
  listados y subir evidencia no tocan Cardano y no esperan nada.
  **Verificado contra el binario compilado, no solo los tests** (mismo criterio que el incidente del
  2026-09-07): `node --require dist/src/instrumentation.js dist/src/server.js` en modo `simulated`
  — `API listening` sale antes que `AnchorPort listo`, `/health` contesta 200 de inmediato, y
  `SIGTERM` sigue cerrando limpio (`[cierre] listo`).
  **Lo que sigue sin resolverse, y no es de este repo:** por qué `buildFilter` no filtra —
  `render.yaml` ya lo documenta como "causa sin determinar", confirmado con `render services
  --output json` mostrando el filtro completo del lado de la API. Este fix no lo arregla; lo que
  arregla es que el redeploy innecesario ya no pueda tumbar el servicio por una carrera con
  Blockfrost, venga o no venga disparado por ese bug.

- **2026-09-20 · `OpenAPIHandler` (oRPC) nunca llama a `next(err)` — un error sin capturar dentro
  de un procedimiento se vuelve el 500 genérico DE ORPC, no el de `errorHandler`.** Encontrado
  migrando `POST /developer/projects` a oRPC (SPEC-212 §D): un slug repetido choca contra
  `Project.slug` (`SQLITE_CONSTRAINT_UNIQUE`), y `errorHandler.ts` lo mapea a 409
  `RESOURCE_ALREADY_EXISTS` desde el 2026-08-24 — pero solo si el error llega ahí. oRPC captura toda
  excepción que no sea un `ORPCError`/error con nombre y escribe su propia respuesta directamente
  sobre `res`, sin pasar por la cadena de middlewares de error de Express. Confirmado con un smoke
  test dedicado (no leyendo código): un handler que tira un `Error` cualquiera responde
  `{"code":"INTERNAL_SERVER_ERROR","status":500}` de oRPC, y un `errorHandler` de prueba puesto
  después nunca corre. Ninguna de las tres sub-partes anteriores (`notary`, `certifier`, `investor`)
  lo había pisado porque ninguna insertaba contra un índice único sin haberlo chequeado antes en la
  misma transacción — acá sí (`Project.slug`, `Unit_projectId_unitReference_key`), y
  `test/constraint-errors.test.ts` fija 409 desde el incidente original.
  **Fix, solo donde hace falta:** `relanzarRestriccionComoOrpc` (`src/routes/_shared.ts`) reusa el
  MISMO `codigoDeRestriccion`/mapeo que `errorHandler.ts` — cada procedimiento que inserta contra
  una restricción declara `.errors({RESOURCE_ALREADY_EXISTS, RELATED_RESOURCE_NOT_FOUND})` y
  envuelve el insert en un `.catch()` que lo llama. Un error que no es de restricción se re-lanza
  tal cual y sigue siendo el 500 genérico de oRPC — mismo resultado que antes de esta migración para
  cualquier fallo no clasificado, así que no hace falta capturar todo, solo lo que un test fija.
  **Cerrado el mismo día, del lado de observabilidad — `lib/orpc.ts` envuelve el export de
  `OpenAPIHandler` con un interceptor que reporta a Sentry cualquier excepción que no sea un
  `ORPCError` declarado (`e.defined`) o con status < 500.** Hasta el 2026-09-30 era solo `e.defined`, y
  todo `new ORPCError("NOT_FOUND")` sin declarar (~50 en las rutas) llegaba a Sentry como una caída;
  ahora el criterio es el mismo que del lado de Express (`statusDeError(err) >= 500`). Las 45 rutas no cambiaron ni una línea — el interceptor se
  inyecta una sola vez, en la construcción, no por call site (ver SPEC-212 §"Implementado 2026-09-20
  — el interceptor de Sentry"). Lo que sigue siendo trabajo por ruta, y no lo reemplaza el
  interceptor genérico: el mapeo a un código de negocio (409 `RESOURCE_ALREADY_EXISTS`, etc.), que
  sigue siendo `relanzarRestriccionComoOrpc`.
  **La lección:** un framework que responde HTTP por su cuenta (en vez de delegar a `next()`) rompe
  en silencio cualquier invariante que dependiera de la cadena de middlewares de error — y esto no
  se ve leyendo el código del handler, solo probándolo con una excepción real.

- **2026-09-20 · `OpenAPIHandler` SÍ sabe parsear `multipart/form-data` — pero bufferea el archivo
  entero en memoria sin ningún límite, y por eso NO se usó para las rutas multipart de la API**
  (la subida de evidencia y, desde D-099, la portada del proyecto).
  Investigado antes de migrar `developer-evidencia.routes.ts` (SPEC-212 §D): un smoke test confirmó
  que un procedimiento con `z.file()` en el input recibe el `File` + los campos de texto de un
  `multipart/form-data` real, vía el `Response(stream).formData()` nativo de Node
  (`@orpc/standard-server-node`). El problema no es de capacidad, es de recursos: ese parser no
  tiene ningún `maxBodySize`/límite configurable, y bufferea el cuerpo completo antes de que el
  handler vea nada — a diferencia de Multer, que hoy aplica `limits.fileSize` y `fileFilter` en
  streaming (regla 10), cortando antes de terminar de recibir un archivo demasiado grande o de tipo
  no permitido. Migrar esa ruta habría empeorado el consumo de memoria (el parser de oRPC bufferea el
  archivo entero; Multer, con `diskStorage`, no toca la RAM — `SPEC-218` §Los hallazgos corrige el
  argumento original). **Se decidió no migrarla** — sigue con Multer y `REQUEST_SCHEMAS`/`RESPONSE_SCHEMAS` a mano, documentado
  en `generate-openapi.ts`.
  **La lección:** que una librería "pueda" hacer algo (parsear multipart) no dice nada sobre si lo
  hace con las mismas garantías que lo que reemplaza — acá la garantía que se hubiera perdido en
  silencio es justo la que regla 10 exige.

- **2026-09-11 · Sentry veía el error ANTES que `errorHandler`, así que reportaba como "Unhandled"
  cosas que el cliente recibía como un 409/400 perfectamente sano** — encontrado leyendo la propia
  captura de evidencia de monitoring (`specs/evidencia-m3/5-ops/monitoring/sentry-issues.jpg`): un
  `SQLITE_CONSTRAINT_UNIQUE` real (mandar el mismo `unitReference` dos veces, generado sin querer
  ejercitando el criterio 9) aparecía en el feed de issues indistinguible de un fallo de servidor.
  `Sentry.setupExpressErrorHandler(app)` va montado antes que `errorHandler` a propósito —Sentry
  necesita ver el error crudo, antes de que se traduzca a JSON— pero eso significa que ve el error
  **sin status todavía**, y el default del SDK (`!status || status >= 500`) lo captura igual. Un
  duplicado de slug, de `unitReference`, de email —cualquiera de los ~10 índices únicos que
  `errorHandler` ya resuelve limpio— se reportaba como si el servidor estuviera roto.
  **Fix:** `statusDeError` (`lib/error-status.ts`) le hace a Sentry la misma pregunta que
  `errorHandler` se hace un paso después — reusa el MISMO `CONSTRAINT_ERRORS`/`codigoDeRestriccion`
  (exportados de `errorHandler.ts`, no copiados) para que las dos clasificaciones no puedan
  divergir. `Sentry.setupExpressErrorHandler(app, { shouldHandleError: err => statusDeError(err) >=
  500 })` en `app.ts`. 9 tests en `test/error-status.test.ts`, cubriendo `HttpError`, `MulterError`,
  los tres códigos de restricción (directos y vía `cause`), y que un error sin clasificar siga
  siendo 500 — el único caso que a Sentry todavía le toca ver.
  **Por qué no va en `instrumentation.ts`, que es donde el SDK recomienda hoy configurarlo
  (`Sentry.expressIntegration({ shouldHandleError })`, ya que pasarlo a `setupExpressErrorHandler`
  está deprecado desde v10 y se va en v11):** `instrumentation.ts` es el archivo que se precarga con
  `node --require`, antes que cualquier otro módulo del proceso — mismo motivo que documenta ese
  archivo para por qué Sentry/OTel arrancan ahí y no en `app.ts`. Importar `statusDeError` (que
  importa `errorHandler.ts`, que importa `multer`) ahí arriba metería esos módulos en el proceso
  antes de que la auto-instrumentación tenga la chance de parchearlos. Queda en `app.ts`, donde el
  orden de carga no es delicado, hasta que el bump a v11 fuerce lo otro.
  **La lección:** un middleware de error montado "antes" de otro por una buena razón (acá, que
  Sentry vea el error crudo) hereda una limitación silenciosa — ve el error en un estado que todavía
  no tiene la clasificación que el siguiente middleware le va a dar. Si dos middlewares de error en
  cadena necesitan la misma pregunta ("¿esto es grave?"), la respuesta tiene que ser una función
  compartida, no una que cada uno adivina con su propio default.

- **2026-09-09 · el disparo por lectura no llegaba a tres pantallas que muestran el estado de un
  anclaje.** `reconciliarParaLectura` no tiene cron ni timer a propósito (D-077): el disparo **es**
  la lectura. Eso funciona solo si el disparador está donde se muestra el anclaje, y no lo estaba —
  `GET /projects/:id/documents`, `GET /contracts/:contractId/releases` y
  `GET /certifier/certificates` devuelven `anchorStatus` y no reconciliaban nunca. Un evento que ya
  estaba en un bloque se servía `Pending` **para siempre**: no hasta la próxima carga, para siempre,
  porque ninguna otra lectura lo iba a mirar.
  **Lo que lo venía tapando:** `GET /developer/kpis` reconcilia con alcance `{projectIds}` sobre
  todos los proyectos del developer, 5 por carga. Por eso producción muestra confirmaciones
  salpicadas en vez de un patrón por proyecto — el panel iba levantando de a poco lo que las
  pantallas propias nunca tocaban.
  **El tope NO era el problema.** `TOPE_POR_LECTURA = 5` acota **round-trips seriales** a Blockfrost
  adentro del tiempo de respuesta de alguien (`reconciliar` itera uno por uno a propósito: rate
  limit, y que un TXID que falla no tumbe la tanda). Subirlo a 10 duplicaba la latencia peor de
  todas las lecturas que sí reconcilian, para arreglar pantallas que no disparaban nada. Primero el
  disparador; el tope se mide después, con una carga real.
  **La invariante, ahora fijada:** toda lectura que devuelva el estado de un anclaje reconcilia su
  propio alcance antes de consultar. `test/reconcile-on-read.test.ts` la comprueba **por
  comportamiento y no por inspección del fuente** (D-053): planta un anclaje `Pending` con un txid
  que el simulador reconoce, pide la ruta por HTTP y mira la base. Con dos controles negativos —un
  anclaje sin `txid` no se toca, y uno de otro proyecto no se confirma— para que el alcance no sea
  decorativo. Los tres casos verificados en rojo sacando las llamadas.
  **La lista se mantiene a mano, igual que el literal de la matriz de permisos:** el test no
  descubre solo una ruta nueva con `anchorStatus`. Si agregás una, sumala — y sumarla es donde
  mirás si el alcance que elegiste es el correcto.

- **2026-09-09 · `eventIndex` se documentaba como la posición en el hilo on-chain y no lo es.**
  El docstring de `recordOnChainEvent` decía *"0 es el mint del thread token, 1..n las
  transiciones"*. Falso: `anchorCommitmentEvent` numera con el mismo contador, así que los
  `EVIDENCE_ANCHOR` —que nunca tocan el validador— **se intercalan y corren la numeración**. En
  producción, "Terminaciones" de `torre-a` tiene `0` mint · `1` transición · `2,3,4` evidencia ·
  `5` transición: **el hilo es una subsecuencia del índice, no el índice**.
  **No hay bug, y se verificó antes de afirmarlo:** `cabezaDelHilo` no ordena por `eventIndex` a
  secas, filtra `outputRef is not null` primero, y un anclaje por metadata siempre lo tiene en
  `null` — confirmado leyendo las filas reales de producción, no solo el código. La unicidad
  `(stageId, eventIndex)` que sostiene la idempotencia (regla 8) funciona igual sea cual sea el
  tipo de evento.
  **Lo que se hizo, además de corregir los dos comentarios:** un test que fija la invariante
  (`test/stage-transitions.test.ts` → *"un EVIDENCE_ANCHOR con índice mayor no corre la cabeza del
  hilo"*), verificado en rojo sacándole el filtro a `cabezaDelHilo`. La garantía se sostenía solo
  por lectura de código, que es exactamente como se coló `tieneHiloAnclado`.
  **La lección:** un comentario que describe un índice como algo que no es no es un error inocuo —
  es una invitación a "simplificar" el filtro que lo hace seguro. Si dos productores comparten un
  contador, decilo en los dos lugares (acá: `stage-transition.ts` y `anchoring.ts`).

- **2026-09-09 · `Completed` era terminal en la FSM pero no en el pipeline de evidencia.**
  `POST /developer/projects/:id/stages/:stageId/evidence` no miraba el estado del stage: se podía
  subir evidencia a una etapa ya certificada. La subida armaba un **bundle nuevo con un root
  nuevo** y lo anclaba por metadata, mientras el datum del hilo conserva para siempre el root
  congelado al certificar — el validador no deja salir de `Completed`, así que ese datum ya no se
  reescribe nunca.
  **La consecuencia es de la regla 17, y está verificada leyendo la ruta de lectura, no supuesta:**
  `GET /projects/:id/stages/:stageId` devuelve el bundle **más reciente**
  (`orderBy createdAt desc limit 1`, `projects-obra.routes.ts`), así que la pantalla mostraría ese
  `commitmentHash` al lado del evento de certificación, cuyo `commitment` es el viejo. Un root
  exhibido junto a un TXID que no lo atestigua. El listado del certifier
  (`GET /certifier/certificates`, que leftJoinea `EvidenceBundle`) tiene el mismo problema.
  **Fix:** 409 `STAGE_ALREADY_COMPLETED` apenas se resuelve el stage, antes de tocar el storage, con
  `borrarHuerfano()` como todos los rechazos de esa ruta (regla 10).
  **Por qué rechazar y no aceptar-sin-rebundlear:** aceptar en silencio dejaría al developer
  creyendo que subió evidencia de la etapa. La documentación posterior al cierre tiene su lugar y es
  `POST /developer/documents`, que es a nivel proyecto y no toca el bundle de ningún stage.
  **`Observed` sigue aceptando**, y hay un test que lo fija: es el camino de remediación (D-020), no
  un estado cerrado. Cuatro tests en `test/evidence-upload.test.ts`, los tres de rechazo verificados
  en rojo neutralizando el guard — el de `Observed` queda verde, que es el control de que el guard
  no es demasiado ancho.
  **La lección, de la misma familia que `tieneHiloAnclado`:** cuando una FSM declara un estado
  terminal, preguntá **qué otros pipelines escriben sobre esa entidad** — la terminalidad la hacía
  cumplir el validador y `canTransition`, y ninguno de los dos ve un `POST` de evidencia.

- **2026-09-08 · `PATCH /stages/:id/state` dejaba a un developer auto-certificar su propio stage —
  encontrado probando el flujo real de certificación con Claude en Chrome, al preguntar si el reparto
  de roles era el correcto.** `M2-D1 §Role Permission Matrix` es explícita: `Stage certification` y
  `Stage observation` son **"Certifier-exclusive action"**; el developer solo tiene `R W` sobre el
  stage (lo define y lo hace progresar). El código no lo cumplía: `stages.routes.ts` autoriza
  `PATCH /stages/:id/state` a `roles: ["admin", "developer"]`, y `transitionStage()` —el dominio
  compartido por esa ruta y por `POST /certifier/stages/:id/certify`/`observe`— solo valida que la
  transición sea legal según la FSM (`canTransition`), **no quién la pide**. Se confirmó corriendo
  el test existente (`stage-transitions.test.ts`, con el token de `FIXTURES.activo`, un developer):
  `200 para InProgress → Completed` pasaba en verde. Un developer con su propio token, sin pasar por
  ninguna pantalla, podía pedir esa ruta con `{state:"Completed"}` sobre su propio stage y quedar
  como `certifiedById` de sí mismo — exactamente lo que la separación certifier/developer existe
  para impedir, y la misma familia de riesgo que el agujero de `GET /evidence/:bundleId/files`
  (autorización de router correcta, regla de negocio faltante adentro).
  **Fix:** después de validar el body con Zod y antes de llamar a `transitionStage`, si
  `req.user!.role !== "admin"` y el `state` pedido no es `"InProgress"`, la ruta devuelve **403** con
  un código nuevo (`STAGE_TRANSITION_ERRORS.forbidden` / `STAGE_TRANSITION_FORBIDDEN`, en
  `packages/shared/src/stage.ts`) — antes incluso de tocar la FSM, así que un developer nunca ve
  "sí, pero..." filtrando si la transición además era válida. `admin` conserva acceso total (mismo
  criterio que el bypass de `projectScope`, D-043). El developer sigue pudiendo pedir `→ InProgress`
  desde `Pending` (arrancar) y desde `Observed` (reanudar tras una observación) — las dos únicas
  transiciones que le corresponden.
  **No es un tercer guard suelto de los que D-088 borró:** `authorize({roles, acceso})` solo describe
  rol+membresía, y esto es una restricción sobre **qué valor** del body puede pedir ese rol — no hay
  forma de expresarlo con `proyecto`/`dueño`/`alguna`/`scopeEnQuery` sin inventar un quinto caso para
  un solo campo. Vive como un chequeo explícito en el handler, con comentario que dice por qué, igual
  que la validación de Zod de la línea de arriba.
  **Los tests que asumían que el developer podía completar/observar por esta ruta se movieron a
  `admin`** (`tokenAdmin` nuevo en `stage-transitions.test.ts` y `units-contracts.test.ts`) porque lo
  que probaban —la tabla de 16 pares de la FSM, las reglas de evidencia, el Merkle root del bundle—
  es lógica de dominio, no la nueva capa de autorización; esa tiene su propio describe ("el developer
  no puede saltear al certifier", 6 tests: 403 a `Completed`, 403 a `Observed`, el 403 gana aunque la
  FSM también rechazaría, los dos `→ InProgress` que siguen en 200, y que `admin` no tiene el
  límite). `evidence-anchor.test.ts` y `route-guards.test.ts` ya usaban `admin`/no tocaban el body —
  no necesitaron cambios. 305 tests verdes, `pnpm verify:all` completo (incluido Aiken) también
  verde.
  **La lección, otra vez la misma familia que `GET /evidence/:bundleId/files`:** una ruta con la capa
  de rol+membresía bien declarada puede seguir dejando pasar una regla de negocio que vive **adentro**
  del dominio compartido — acá, cuál transición le corresponde a cuál rol, algo que `authorize()`
  no modela porque no es ownership ni membresía, es una restricción sobre el valor del body. Ningún
  test la cubría porque el test que sí ejercitaba `InProgress → Completed` (el de los 16 pares) usaba
  el mismo token developer que la ruta ya autorizaba a nivel de router, así que el 200 parecía
  correcto sin serlo.

- **2026-09-08 · un `require()` sin tipar no lo agarra ni `tsc` ni pnpm en local — encender OTel de
  verdad tumbó producción con `MODULE_NOT_FOUND`.** `instrumentation.ts` ya usaba `require()` tardío
  para los paquetes de OTel (comentario: "si el bloque de arriba no corriera... no tiene sentido
  pagar el costo"); agregar `diag.setLogger` sumó `require("@opentelemetry/api")` sin declararlo en
  `dependencies` de `apps/api/package.json`. Local no lo vio: `@opentelemetry/api` ya estaba en
  `node_modules` como transitiva de `@opentelemetry/sdk-node` y compañía, y como es un `require()`
  sin tipar, `tsc` lo trata como `any` y no valida el paquete contra ningún `package.json` — el build
  salió verde. Render sí lo vio: `pnpm install --frozen-lockfile` en limpio arma un `node_modules`
  por paquete que **no expone transitivas no declaradas**, así que el `--require` de producción
  murió con `Error: Cannot find module '@opentelemetry/api'` apenas después de "Sentry activo".
  **Fix:** declarar `@opentelemetry/api` como dependencia directa (versión resuelta del lockfile,
  `^1.9.1`) y reproducir el `startCommand` real contra ese build antes de pushear — mismo criterio
  que ya pedía el incidente del 2026-09-07, ahora hecho test: ver `.github/workflows/ci.yml` §Smoke
  test del arranque compilado.
  **La lección, que generaliza más allá de OTel:** un `require()` sin tipar (el patrón de esta misma
  sección para imports ESM tardíos, ver más abajo) bypasea dos redes de seguridad a la vez — `tsc` no
  valida el módulo porque no está tipado, y un local con `node_modules` viejo/hoisted puede tener el
  paquete igual sin que esté declarado. Ninguna de las dos cosas se ve hasta una instalación limpia.
- **2026-09-08 · Sentry (v10) registra sus propios globals de OTel y gana la carrera contra el
  `NodeSDK` propio — los traces se perdían en silencio, el deploy quedaba `live` igual.**
  `Sentry.init()` corre primero en `instrumentation.ts`; desde la v8, el SDK de Node de Sentry
  configura su propio `TracerProvider`/`ContextManager`/`Propagator` de OTel internamente **aunque
  `tracesSampleRate: 0`** — no es opcional a menos que se le diga. Cuando el `NodeSDK` propio corría
  `sdk.start()` después, `registerGlobal` (de `@opentelemetry/api`) rechazaba el segundo registro con
  `Attempted duplicate registration of API: context/propagation/trace` — pero **solo loguea, no
  tira** — así que las auto-instrumentaciones de `http`/`express` seguían creando spans, solo que
  contra el `TracerProvider` de Sentry (que los descarta, por el `tracesSampleRate: 0`) en vez del
  nuestro, que es el único con un `OTLPTraceExporter` colgado. El proceso arrancaba sano, el deploy
  quedaba `live`, y Tempo se quedaba vacío sin ningún error visible — se encontró recién leyendo los
  logs con el `diag.setLogger` de la entrada de abajo.
  **Fix:** `skipOpenTelemetrySetup: true` en `Sentry.init()` — es la forma que documenta Sentry para
  convivir con un `NodeSDK` propio. Verificado local forzando el mismo arranque con env vars basura
  (mismo patrón que la entrada de arriba): sin el flag, tres líneas de `Attempted duplicate
  registration`; con el flag, ninguna.
  **La lección:** un conflicto de dos SDKs de observability compitiendo por el mismo registro global
  no tira el proceso — cada uno asume que es el único, y el que pierde queda funcionando pero mudo.
  Si dos piezas de instrumentación tocan `@opentelemetry/api` en el mismo proceso, hay que preguntar
  explícitamente cuál gana, no asumir que conviven solas.
- **2026-09-08 · sin `diag.setLogger`, un exporter OTLP que falla queda mudo — ni acá ni en Grafana
  aparece nada, solo ausencia de datos.** `@opentelemetry/api` no registra un logger de diagnóstico
  por default; un exporter que recibe 401/malla de red solo llama a `diag.error(...)`, que sin logger
  no imprime nada. El síntoma indistinguible de "no hay tráfico" es "el tráfico se pierde" — los dos
  se ven igual (Grafana sin datos) hasta que se agrega el logger. **Fix:** `diag.setLogger(new
  DiagConsoleLogger(), DiagLogLevel.ERROR)` antes de `sdk.start()`; con esto se encontraron los dos
  incidentes siguientes de esta lista el mismo día. **Antes de asumir "no hay tráfico" con un
  exporter que no dice nada: prendé el diag logger primero.**
- **2026-09-08 · el asistente "OpenTelemetry (OTLP)" de Grafana Cloud genera el valor de
  `OTEL_EXPORTER_OTLP_HEADERS` sin el prefijo `Authorization=` — Grafana contestaba 401
  `"authentication error: no credentials provided"` con un token recién generado y bien copiado.**
  La pantalla de setup (`Connections → Add new connection → OpenTelemetry (OTLP) → View connection
  details`) da `export OTEL_EXPORTER_OTLP_HEADERS="<base64(instanceID:apiKey)>"` — el blob solo, sin
  la clave. El SDK de Node parsea esa variable como pares `clave=valor` separados por coma
  (`parseKeyPairsIntoRecord` de `@opentelemetry/core`, mismo formato que baggage HTTP); un valor sin
  `=` antes del primer carácter útil no arma ningún header, así que Grafana literalmente no recibía
  ningún `Authorization` — de ahí "no credentials provided" y no "token inválido". Verificado leyendo
  el DOM de la página con Chrome (no la captura de pantalla, que se veía ambigua) y el código fuente
  de `otlp-node-http-env-configuration.js` en `node_modules`, no adivinado.
  **Fix, sobre el valor generado por Grafana:** anteponerle `Authorization=Basic%20` a mano antes de
  pegarlo en Render — queda `Authorization=Basic%20<blob>`. El `%20` es opcional (`parsePairKeyValue`
  hace `decodeURIComponent` de la parte del valor, así que un espacio literal también funciona), pero
  usar `%20` evita cualquier ambigüedad de copiado. `apps/api/.env.example` ya documentaba el formato
  correcto (`Authorization=Basic <base64(...)>`); lo que cambió es que el asistente de Grafana ya no
  lo arma completo — antes de confiar en un valor generado por un wizard externo, comparalo contra lo
  que el parser del lado nuestro realmente espera.
- **2026-09-07 · `node --require` no resuelve rutas relativas igual que un script posicional —
  tumbó producción (`Failed deploy`).** El `startCommand` de `render.yaml` quedó como
  `node --require apps/api/dist/src/instrumentation.js apps/api/dist/src/server.js`, sin `./`
  adelante. `apps/api/dist/src/db/migrate.js`, en la línea de arriba, **nunca tuvo el problema**
  porque es el script principal (posicional) que Node ejecuta, y ese sí se resuelve relativo al
  `cwd` sin importar el prefijo. `--require` en cambio sigue la resolución de `require()`: una ruta
  sin `./` ni `/` al principio se busca como paquete de `node_modules`, no como archivo — y
  `apps/api/dist/src/instrumentation.js` calzaba justo esa forma. El proceso moría al arrancar con
  `MODULE_NOT_FOUND` antes de escuchar el puerto, así que Render nunca vio el health check y marcó
  el deploy fallido.
  **Por qué no lo atrapó nada:** ninguna suite corre el `startCommand` compilado de punta a punta.
  `pnpm dev` usa `tsx watch --require ./src/instrumentation.ts` (con `./`, y además `tsx` resuelve
  distinto), y los tests importan `app.ts` directo sin pasar por Node ni por `--require`. Local y
  CI quedaron ciegos al único camino que corre en producción.
  **Fix:** agregar el `./` (commit `2d65fca`). **La lección:** cualquier flag de Node que reciba una
  ruta de archivo (`--require`, `-r`, `--loader`, `--import`) hay que probarlo con el mismo comando
  exacto que va a correr el deploy —no alcanza con que el script principal al lado funcione, ni con
  correrlo desde otro directorio de trabajo.

- **2026-09-07 · `NODE_ENV: production` como env var del SERVICIO rompió el `buildCommand`, no el
  `startCommand` — segundo incidente en el mismo deploy.** El fix del `./` de arriba se pusheó y
  Render armó bien el `startCommand`, pero el build entero falló antes de llegar ahí:
  `packages/cardano prepare: error TS2688: Cannot find type definition file for 'node'`. La causa
  no tenía nada que ver con `--require` — `NODE_ENV=production` se había agregado como `envVars` del
  servicio (para que `instrumentation.ts` etiquetara bien el ambiente en Sentry), y Render aplica
  las `envVars` del servicio a **las dos** fases, build y arranque, no solo a la que las necesita.
  Con `NODE_ENV=production` puesto, `pnpm install` saltea las `devDependencies` —`@types/node`
  incluido— y `tsc` de `packages/cardano` no encuentra el tipo `node`.
  **Reproducido a propósito, las dos ramas:** `NODE_ENV=production pnpm install --frozen-lockfile`
  falla igual que Render; sin la variable, instala `devDependencies` y compila. No hizo falta
  adivinar — se corrió el mismo comando que loguea Render, con y sin la variable.
  **Fix:** sacar `NODE_ENV` de `envVars` del servicio y ponerlo **inline en el `startCommand`**
  (`NODE_ENV=production node --require ...`), que solo alcanza a ese proceso — el `buildCommand` es
  una invocación de shell aparte y no lo hereda. `test/render-config.test.ts` ahora tiene dos
  guardas: que `NODE_ENV` nunca sea una `envVars` del servicio, y que el `startCommand` lo fije
  inline.
  **La lección, que generaliza más allá de `NODE_ENV`:** en un Blueprint de Render, `envVars` del
  servicio es un solo balde compartido entre `buildCommand` y `startCommand` — no hay forma de
  declarar una variable "solo para el arranque" ahí. Cualquier variable cuyo valor cambie el
  comportamiento de una **herramienta del toolchain** (`NODE_ENV` para npm/pnpm, pero la misma
  familia de riesgo aplica a cualquier var que un instalador o un compilador lean) es candidata a
  ir inline en el comando que la necesita, no en `envVars`.

- **2026-09-04 · Aceptar una invitación no creaba la membresía, y el seed la plantaba a mano — así que
  los fixtures describían un mundo que el flujo real nunca producía.** `POST
  /investor/invitations/:id/accept` (M2-D5 fila 63) marcaba la unidad como vendida, creaba el
  contrato y anclaba el evento, pero **no insertaba `ProjectMember`**. En este código la lectura que
  M2-D1 §4 le da al investor —Construction stage, Evidence bundle, Contract del proyecto de su
  unidad— se resuelve con membresía por proyecto (`ANY_MEMBERSHIP` incluye `buyer`), así que un
  investor real aceptaba y **toda ruta con `requireProjectAccess` le contestaba 403**: los stages de
  su proyecto, la evidencia, y —lo peor— `GET /evidence/:bundleId/files` y `/proof/:fileHash`, que
  son el Merkle proof de su propia unidad y llevan sus test IDs (`INV-STAGE-MILESTONE-001`,
  `INV-MERKLE-PROOF-002`). El paso 6 del flujo de onboarding de M2-D1 —*"Unit now appears in
  investor's portfolio with progress timeline visible"*— no se cumplía fuera del seed.
  **Por qué no lo vio nadie:** `test/global-setup.ts` siembra la membresía del investor con un
  `insertInto("ProjectMember")` directo. Todos los tests del investor corrían sobre un usuario que ya
  era miembro, así que probaban la superficie con un estado que **solo el seed sabía construir**.
  **Fix:** el handler inserta la membresía `buyer` con `onConflict().doNothing()` (regla 8) y la
  registra en el `metadata` del `AuditLog` de `ACCEPT_INVITATION` — otorgar un permiso tiene que
  poder leerse, no deducirse. Test que reproduce el bug y prueba el cierre:
  `test/invitation-membership.test.ts`, con el control de que **antes** de aceptar sí da 403.
  **La lección, que es la misma del 2026-08-24 con otra cara:** cuando el seed construye a mano un
  estado que en producción produce un endpoint, el seed deja de ser un atajo y pasa a ser una
  **hipótesis sin verificar** sobre lo que ese endpoint hace. Antes de sembrar una fila que el
  producto crea solo, preguntá qué endpoint la crea — y si no hay ninguno, ese es el bug.
  **Ojo si hay datos viejos:** un investor que aceptó antes de este arreglo no tiene la membresía. Se
  detecta con `select u.email from Unit un join User u on u.id = un.investorId left join
  ProjectMember pm on pm.userId = u.id and pm.projectId = un.projectId where pm.id is null`.

- **2026-09-04 · Un arranque colgado no se distingue de otro porque el `startCommand` son dos pasos
  y ninguno anunciaba que empezó.** El deploy de `ef8e55e` —un commit de **solo `.md`**— compiló
  bien, corrió `node migrate.js && node server.js` a las 14:56:23 y **no abrió un puerto en catorce
  minutos**, hasta que Render lo mató por *port scan timeout*. La API estuvo caída ~18 minutos; el
  deploy siguiente, con más código encima, levantó en 5 segundos. **No fue una regresión**: el código
  de `ef8e55e` es idéntico al de `ae782be`, que había arrancado bien catorce minutos antes.
  **⚠ Corregido el 2026-09-22:** esos "catorce minutos" son la pista. Fue el apagado por inactividad
  del plan free (primera entrada de esta lista), no un arranque colgado.
  **Lo que no se pudo determinar, y por qué importa:** `migrate` solo imprimía al *aplicar* una
  migración (`Applied ${file}`), así que en el caso normal —sin pendientes— no decía nada. Un
  arranque colgado adentro de `migrate` y uno colgado adentro de `server.js` antes de su primer log
  producían **exactamente el mismo log vacío**, y el free tier no da shell para ir a mirar.
  **Fix, tres piezas:** `migrate` ahora abre con `[migrate] conectando a la base` y cierra con
  `[migrate] sin migraciones pendientes` o `[migrate] N migración(es) aplicada(s)`; `server.ts` abre
  con `[arranque] migraciones listas, levantando la API`; y `conTecho` le pone un techo de **120s** a
  la migración entera, conexión incluida, para que una base que no responde **falle** en vez de
  esperar. Verificado contra una IP muerta: sale con error y con causa a los pocos segundos. Tests en
  `test/migrate-techo.test.ts`, incluido el del `clearTimeout` — sin él, un techo de 120s deja el
  proceso despierto dos minutos **después** de migrar, y como el comando es `migrate && server`, la
  API no arrancaría hasta que ese timer se apague.
  **La lección:** en una plataforma sin shell, el log es el único instrumento, y **un paso que no
  anuncia que empezó es un paso que no se puede diagnosticar**. Si agregás un paso al `startCommand`,
  que diga que arrancó y que diga que terminó.

- **2026-09-03 · `POST/PATCH /users` no podía dar de alta ni promover a `notary` —
  encontrado evaluando si ya se podía dar acceso real a gente.** El dominio tiene cinco roles
  (`USER_ROLES` en `db/types.ts` y `userRoleSchema` en `packages/shared/src/auth.ts` ya traían
  `notary`), pero `users.routes.ts` declaraba su propio `z.enum(["admin", "developer", "buyer",
  "verifier"])` en vez de importar el schema compartido (regla 6 incumplida en el único lugar donde
  se crean cuentas reales) — un admin no tenía forma de crear un notary por API, solo existía vía
  seed/fixtures. **Fix:** las dos rutas ahora usan `userRoleSchema` de `@plataforma/shared`. Test en
  `test/users-roles.test.ts`.
  **La lección:** un schema local que "por casualidad" coincide con el compartido no lo reemplaza —
  cuando el dominio crece un rol, todo el que lo copió a mano se queda atrás en silencio, y acá el
  síntoma no era un 500 sino un 400 de validación indistinguible de un email inválido.

- **2026-09-03 · `GET /:bundleId/proof/:fileHash` y `GET /:bundleId/files` no tenían segunda capa
  — encontrado en el security review del criterio 11 del SOM.** Cada otra ruta de
  `evidence.routes.ts` (`/:id`, `/:id/download`, `PATCH /:id`, `/:id/anchor`, `DELETE /:id`) suma
  `requireProjectAccess` a `router.use(authenticate)`; estas dos rutas, agregadas para la fila 25m
  (`INV-STAGE-MILESTONE-001`/`INV-MERKLE-PROOF-002`), solo tenían la primera capa. Cualquier usuario
  autenticado sin membresía en el proyecto dueño del bundle —un notary sin proyectos, un buyer de
  otro proyecto— podía leer la raíz Merkle, los `sha256Hash` y los `originalFilename` de la
  evidencia de un bundle ajeno con solo conocer su `bundleId`. No es el patrón del `/public/` (D-016
  §dossier): ese vive en su propio router, sin `authenticate`, y documentado como una de las dos
  únicas rutas sin sesión del backlog — esto no lo era, era un olvido.
  **Fix:** `ProjectSource` en `middlewares/auth.ts` suma `via: "EvidenceBundle"` (mismo patrón que
  `Stage`/`Evidence`: la tabla tiene `projectId` directo, no hace falta joinear), y las dos rutas
  ahora piden `requireProjectAccess({ via: "EvidenceBundle", param: "bundleId" }, ANY_MEMBERSHIP)`.
  Test que reproduce el bug y prueba el cierre: `test/evidence-anchor.test.ts` → *"un developer sin
  membresía en el proyecto del bundle recibe 403"*.
  **La lección:** cuando una ruta nueva se agrega a un archivo con un patrón de autorización
  consistente en todas las demás, copiar `router.get("/x", async (req, res) => ...)` sin el
  middleware no rompe nada visible — compila, el happy path funciona, y el agujero solo se ve
  leyendo la ruta al lado de sus hermanas o auditando expresamente. Ninguna herramienta lo iba a
  encontrar sola porque no hay un checker de esto (D-053): la forma es el middleware obligatorio en
  la firma, y acá la firma no lo tenía.

- **2026-09-03 · Defensa 3 (D-087): dos call sites confiaban en `recibo.status` del puerto sin
  verificar.** `anchorEvent` (`domain/stage-transition.ts`) solo llamaba a `verify()` si
  `receipt.status === "Confirmed"` — con el simulador devolviendo `Confirmed` directo, eso nunca
  hacía falta y el chequeo era código muerto en la práctica. `anchorCommitmentEvent`
  (`domain/anchoring.ts`) y el `/:id/anchor` de `evidence.routes.ts` ni eso: escribían
  `status: recibo.status` tal cual, sin ningún chequeo. Los tres corregidos con el mismo patrón —
  `verify()` para hilo, `confirmedAt()` para metadata, siempre, sin condicionar al literal del
  recibo. `evidence.routes.ts` y `domain/anchoring.ts` tienen la MISMA lógica de insertar +
  anclar + `catch → Failed` casi duplicada — no se unificó hoy, queda a la vista para quien lo
  toque después.
- **2026-09-03 · `tieneHiloAnclado` miraba CUALQUIER `OnChainEvent` con `txid`, no el hilo.** La
  función que bloquea `sequenceOrder`/`validationCritical` en `PATCH /stages/:id` una vez "anclado"
  (`identity_preserved` del validador) filtraba por `txid is not null` — y un anclaje de evidencia
  por metadata (`EVIDENCE_ANCHOR`, D-006) también tiene `txid`, aunque nunca toca el validador ni la
  identidad del stage: su `outputRef` es siempre `null` porque no hay UTxO de por medio. Un stage
  con evidencia anclada pero **sin hilo real** quedaba con la identidad bloqueada por error — el
  chequeo correcto ya existía en el archivo (`cabezaDelHilo`, que sí filtra por `outputRef`) pero
  nadie lo había usado acá. Se encontró auditando el área para el hallazgo de abajo, no por un
  reporte.
  **Fix:** `tieneHiloAnclado` se borró (quedaba idéntica a `cabezaDelHilo(...) !== null`, sin
  agregar nada) y `PATCH /stages/:id` llama a `cabezaDelHilo` directo. Test que reproduce el bug
  original y prueba que quedó cerrado: `test/stage-transitions.test.ts` → *"un anclaje de metadata
  (evidencia) no bloquea la identidad — no es hilo"*.
  **La lección:** cuando dos funciones del mismo archivo responden preguntas parecidas
  ("¿tiene evento anclado?" vs. "¿tiene hilo?"), y solo una filtra por el campo que realmente importa
  (`outputRef`, no `txid`), la más laxa gana por descuido en el próximo call site nuevo. Antes de
  escribir un chequeo de "¿ya está anclado?", preguntá **qué tipo** de anclaje importa — no todos
  los `OnChainEvent` de un stage son su hilo.

- **2026-09-03 · Un stage sembrado directo en la base no tiene hilo on-chain, y `PATCH .../state`
  no lo dice.** El primer anclaje real de state-thread se probó en producción sobre `torre-a` y el
  intento inicial fue transicionar `Estructura` —un stage que ya existía, sembrado por
  `db/fixtures.ts` con `insertInto("Stage")` directo—. `advanceThread` necesita un UTxO vivo que
  gastar (`cabezaDelHilo`, que busca un `OnChainEvent` con `outputRef`), y un stage que nunca pasó
  por `POST /projects/:id/stages` no tiene ninguno: el mint solo ocurre ahí
  (`anchorEvent(evento, stage, null)`). **Esa ruta se borró el 2026-09-08** (era anterior al Stage
  template y sin caller real, ver §CRUD genérico); lo que hacía —crear una fila y mintear su
  hilo— hoy vive en `test/helpers/stages.ts` para tests, y en el loop de
  `POST /developer/projects` para el template de 10. El síntoma
  **no es un error de la request** — D-059 escribe la declaración igual, la respuesta es 200 — es
  el `anchor.status` quedando `Failed` en silencio, exactamente el caso que ya cubre
  `test/stage-transitions.test.ts` (*"deja el evento en Failed... si el stage no tiene hilo"*), solo
  que nadie había cruzado ese test con el hecho de que el seed de demo crea stages así.
  **Primer anclaje real, resuelto sobre un stage nuevo:** se probó sobre "Terminaciones", creado con
  `POST /projects/:id/stages` para abrir el hilo, y recién después `PATCH .../state`. Confirmado con
  las dos transacciones referenciando el reference script (D-083) en vez de adjuntar el validador —
  verificado leyendo `reference: true` en los inputs de cada tx contra Blockfrost, no por
  tamaño/fee nomás. Ver `specs/archive/CLAUDE-historial-hasta-2026-09-10.md`, cierre del 2026-09-03.
  **Dos arreglos que salieron de esto, para que no vuelva a sorprender:**
  1. `POST /projects/:id/stages/:stageId/retry-anchor` (admin) — reintenta el mint cuando
     genuinamente falló (red caída, wallet sin fondos) y el stage **sigue en `Pending`**. Para un
     stage que ya avanzó sin hilo —el caso de `Estructura`— da 409 `STAGE_ALREADY_ADVANCED` a
     propósito: no existe un mint retroactivo honesto una vez que el estado off-chain avanzó sin
     prueba (`domain/stage-transition.ts` → `retryStageMint`).
  2. `hasOnChainThread` (calculado, no guardado) en `GET /stages/:id`, `GET /projects/:id/stages` y
     `GET /projects/:id/stages/:stageId` — para que "¿este stage tiene hilo?" se vea en la respuesta
     en vez de tener que saber que `cabezaDelHilo` existe y consultarla a mano.
  **Antes de completar o transicionar un stage viejo de `torre-a` para una demo o un test manual:
  confirmá que tiene una fila en `OnChainEvent` con `outputRef` antes de asumir que el hilo existe.**

- **2026-08-24 · Un `router.use(guard)` en un router montado sobre `/api/v1` pelado corre para
  TODA request que le entre, matcheen o no sus rutas.** `developer.routes.ts` tenía
  `router.use(requireRole("admin", "developer"))`, y como estaba montado en `app.use("/api/v1",
  developerRoutes)` contestaba **403 a `GET /api/v1/investor/favorites` de un buyer** antes de que
  el router de favoritos se consultara siquiera: el rol global de OTRA superficie cortaba la
  request. Lo mismo hacía `router.use(authenticate)` con `GET /public/dossier/:token`, que es uno
  de los dos endpoints sin sesión del backlog (M2-D5 §2.2) — devolvía 401.
  **Por qué no lo vio nadie:** la suite no tenía **ningún fixture activo que no fuera developer o
  admin**. Cada test probaba su propia superficie con el rol correcto, y el 403 cruzado no aparecía
  porque nunca se pedía una superficie de investor con un token de investor. Ahora
  `test/global-setup.ts` planta un buyer, un notary y un verifier activos.
  **Fix:** los routers con guard a nivel de router van montados bajo SU prefijo
  (`app.use("/api/v1/developer", developerRoutes)`), con los paths internos sin el prefijo; y
  `dossierRoutes` va **primero** de todos, antes de cualquier router con `authenticate` global.
  La alternativa —bajar el guard a cada ruta— deja la puerta abierta a que una ruta nueva se olvide
  de ponerlo, que es justo lo que D-042 evita.
  **La lección general:** el orden de montaje en `app.ts` es semántico, no cosmético. Dos routers
  sobre el mismo prefijo comparten el pipeline: el primero que contesta, contesta por los dos.

- **2026-08-24 · Una restricción de la base violada por el cliente contestaba 500.** Crear un
  proyecto con un slug que ya existía, dos stages con el mismo orden o dos unidades con la misma
  referencia caía en el `catch` genérico del `errorHandler`: **5xx en el monitoreo con el servidor
  perfectamente sano**, y el cliente sin forma de saber qué corregir. Peor: el mensaje crudo de
  libSQL es `UNIQUE constraint failed: Project.slug` — tabla y columna, que es justo lo que la
  regla 2 no deja salir.
  **Fix, y por qué es central y no por ruta:** `errorHandler` mapea `SQLITE_CONSTRAINT_UNIQUE` y
  `SQLITE_CONSTRAINT_PRIMARYKEY` a **409** (`RESOURCE_ALREADY_EXISTS`) y
  `SQLITE_CONSTRAINT_FOREIGNKEY` a **400** (`RELATED_RESOURCE_NOT_FOUND`), con mensaje genérico y
  el detalle solo al log. Son ~10 índices únicos y cada endpoint nuevo que inserte hereda el
  comportamiento correcto sin acordarse de nada. **Un `select` previo por ruta no alcanza**: dos
  requests simultáneos lo pasan los dos y uno choca igual — la restricción de la base es la única
  respuesta verdadera. La forma del error (`LibsqlError`, campo `code`, y también en `cause.code`)
  se comprobó contra la base real, no contra la documentación.

- **2026-08-24 · Un evento de commitment sin ref no se puede volver a encontrar.** El TXID de un
  `PaymentRelease` se buscaba matcheando el commitment del `OnChainEvent`, y el commitment de un
  release incluye su `releasedAt` — así que el join no matcheaba nunca y el patrón P10 mostraba las
  liberaciones **sin prueba**, indistinguibles de las no ancladas. `OnChainEvent` ahora tiene
  `referenceId`: la ref opaca al registro off-chain que el evento ancla (release, invitación,
  dossier, documento). Es la misma que ya se le pasaba al `AnchorPort`, solo que ahora persistida.
  **Antes de anclar algo nuevo, preguntá cómo se va a volver del registro a su TXID.**

- **2026-08-23 · La FSM del stage no estaba aplicada acá, y `contracts/` creía que sí** — cerrado
  el mismo día (D-059). `PATCH .../state` validaba el enum con Zod y escribía: aceptaba
  `Pending → Completed` directo y **salir de `Completed`**, que la regla 9 declara terminal. Los dos
  `CLAUDE.md` decían "una sola tabla de transiciones, espejada 1:1" y la mitad de esa frase era
  falsa. **La lección, que sobrevive al arreglo:** cuando dos sistemas implementan la misma regla y
  ninguno importa al otro, la frase "está espejado" es una intención, no un hecho — y acá el costo
  no era un bug de UI sino una transacción firmada y pagada que la cadena rechaza. Ahora la tabla
  vive en `packages/shared` (`STAGE_TRANSITIONS`, `canTransition`) y las dos suites prueban los 16
  pares. **Antes de tocar la FSM: se cambia en `packages/shared` y en
  `contracts/lib/propnexus/fsm.ak`, en el mismo commit.**

- **2026-08-21 · TypeScript hoistea TODOS los `import` al principio del archivo compilado, así
  que un `dotenv.config()` intercalado entre imports corre DESPUÉS de que ya se resolvieron.**
  `app.ts` tenía `import dotenv from "dotenv"; dotenv.config(); import express ...; import
  authRoutes from "./routes/auth.routes";` — visualmente `dotenv.config()` corre segundo, pero el
  emit de CommonJS pone los `require()` de los tres imports **antes** que cualquier código
  intercalado, en el orden en que aparecen los `import`. `auth.routes` carga `lib/jwt.ts`, que lee
  `JWT_SECRET` al importarse (D-042) — así que la API tiraba "JWT_SECRET falta o está vacío" con
  un `.env` perfectamente válido y confirmado con `node -e` standalone. Se encontró al verificar
  `pnpm dev` desde cero para SPEC-011: nadie lo había pisado porque el árbol principal nunca se
  había reiniciado limpio con este archivo. **Fix:** `import "dotenv/config"` como el primer
  import del archivo (side-effect import, sin código intercalado) — mismo patrón que ya usaban
  `db/migrate.ts` y `db/seed.ts`, que por eso nunca lo sufrieron. Antes de "arreglar" un
  `dotenv.config()` que parece no cargar nada, mirá si hay imports después en el mismo archivo.
- **2026-08-20 · `storagePath` se filtraba en las cuatro respuestas de `/evidence`.** D-011 dice
  explícitamente que la clave de almacenamiento jamás se expone, pero `POST/GET/GET-by-id/PATCH
  /evidence` devolvían el registro completo — incluida la ruta absoluta en disco del servidor. Se
  detectó leyendo la ruta al migrar Multer, no por un test (no había ninguno).
  **Fix:** una lista de columnas explícita (`EVIDENCE_SAFE_COLUMNS = { storagePath: false }`,
  pasada como `columns` a cada query de Drizzle que responde al cliente en `evidence.routes.ts`);
  las dos rutas que sí necesitan la ruta real internamente (`download`, `delete`) siguen
  consultándola completa, porque nunca la devuelven en el body. Cualquier endpoint nuevo que toque
  `Evidence` tiene que repetir esa lista — no hay un select compartido todavía porque la superficie
  es chica; si crece, vale la pena centralizarlo.
- **`req.params[x]` es `string | string[]`, no `string`.** Con Express 5 + `@types/express` 5.0.6
  (pineado por `pnpm.overrides` en la raíz), path-to-regexp v8 admite parámetros repetidos (`:id+`)
  y el tipo lo refleja. Ninguna ruta de esta API declara uno, así que un array significa que alguien
  cambió el path — `requireProjectAccess` contesta 500 explícito en vez de elegir el primero en
  silencio, que en la capa de autorización sería el peor default posible.
- ~~El warning de `url.parse()` deprecado al arrancar viene de `bcrypt`~~ — **cerrado el
  2026-09-10.** Venía de `@mapbox/node-pre-gyp` (que `bcrypt@5.1.1` usaba para bajar binarios
  precompilados), no de Multer ni de código propio — el repo lo atribuyó a Multer durante meses y
  era falso: se comprobó con `tsx --trace-deprecation`, y sobrevivió intacto a la migración a
  Multer 2 (D-036). **Antes de atribuir un warning, trazalo.**
  `bcrypt@6.0.0` reemplazó `@mapbox/node-pre-gyp` por `node-gyp-build` + `node-addon-api` (mismo
  mecanismo de binario precompilado, sin el paquete que llamaba `url.parse()`), así que el warning
  desapareció al bumpear la dependencia — no hizo falta ningún workaround. Verificado: `pnpm
  --filter @plataforma/api test` ya no lo imprime, y los 345 tests (incluidos los de timing de
  `auth-timing.test.ts`, que miden el costo real de `bcrypt.compare`) siguen en verde sin cambios.
  `bcrypt` sigue siendo un **módulo nativo** — eso no cambió, y el argumento caro de antes (toolchain
  en la imagen Docker) sigue muerto con D-041, no hay imagen. Ver §Superficie 🔴 y `specs/stack.md`
  §11.
- **2026-08-21 · La Relational Query API de Drizzle no reescribe un `SQL` a mano para calzar con
  su propio alias interno.** `db.query.projects.findMany({ where: projectScope(...) })` rompía con
  `SQLITE_ERROR: no such column: Project.id`: el RQB alias-ea la tabla base (`"Project" AS
  "projects"`), pero el `EXISTS` correlacionado que arma `projectScope` referencia la columna del
  schema importado, sin ese alias. **Fix:** `GET /projects` usa `db.select().from(projects)` (sin
  alias) en vez del RQB, y arma los `milestones` de cada proyecto con una segunda query agrupada en
  JS. `GET /:id` y `GET /:id/members` sí pueden usar el RQB con seguridad porque no inyectan
  `projectScope` dentro de su `where`. **Regla:** cualquier `SQL` armado a mano que referencie una
  tabla del schema (no un alias) no es seguro de pasar al `where` de una query del RQB sobre esa
  misma tabla.
- **2026-08-21 · `@libsql/client` y `@paralleldrive/cuid2` son ESM puro; con `moduleResolution:
  node16` (CJS) un `import` normal typechequea rojo** (TS1479/TS1471) aunque corra bien en runtime.
  El patrón que lo resuelve —usado en `src/lib/libsql-client.ts`, para no repetirlo en cuatro
  lugares— es tipos vía `import type {...} from "pkg" with { "resolution-mode": "require" }` y el
  valor vía `require("pkg")` a secas; Node 24 resuelve ese `require` de un paquete ESM en runtime
  sin problema. Antes de "arreglar" un TS1479/TS1471 nuevo cambiando `moduleResolution`, mirá si es
  este mismo patrón el que hace falta.
- **2026-08-20 · Un `import()` dinámico en un test necesita la extensión `.js`.** `apps/api`
  es CommonJS con `moduleResolution: node16`, así que `import("../src/lib/jwt")` typechequea
  rojo (TS2835) aunque vitest lo resuelva sin problema. Va `"../src/lib/jwt.js"`: tsc lo mapea
  al `.ts` y vitest también. Los imports estáticos no lo piden — solo los dinámicos.
- **2026-08-21 · Las credenciales del seed son públicas, así que el límite es la BASE, no la
  password.** `admin@example.com/admin123` está en el README, en el skill `run-app`, en los
  presets del login y en los e2e. Hacerla más larga no arregla nada: publicada es publicada.
  Lo que se controla es dónde se puede sembrar — `DATABASE_URL` con `file:` usa los defaults,
  cualquier otra cosa exige `SEED_ADMIN_PASSWORD`/`SEED_DEMO_PASSWORD` o el seed revienta
  (D-047). Los helpers y sus tests están en `src/db/credentials.ts`.
  **Corregido el 2026-09-28:** esto decía "sin `DATABASE_URL` cuenta como remota", y era falso en
  la práctica: sin la variable, `lib/db.ts` conecta al SQLite local por defecto, así que
  `pnpm db:seed` sin `.env` reventaba **contra una base local**. El chequeo y la conexión ahora
  resuelven con la misma función (`urlDeLaBase`, `db/local-db.ts`) y no pueden volver a divergir.
  Un `DATABASE_URL=` **vacío** sí sigue contando como no local (la conexión tampoco caería al
  default, porque `??` solo cae con `undefined`).
- **2026-08-21 · El seed imprimía credenciales que no garantizaba.** Los cuatro `upsert` de
  `src/db/seed.ts` (entonces `prisma/seed.ts`) usaban `update: {}`, así que en una base ya existente el usuario conservaba
  la password vieja mientras el `console.log` del final anunciaba la nueva. Se vio al subir el
  mínimo a 8 caracteres: el seed decía `developer123` y el login daba 401 con esa. **Un seed de
  demo tiene que ser autoritativo sobre lo que publica**, así que ahora `update` sí escribe el
  `passwordHash`. Corolario general: `update: {}` no es "idempotente", es "no reconcilia".
- **2026-08-21 · Un rate limiter mal configurado detrás de un proxy es peor que ninguno.**
  `req.ip` sale de `app.set("trust proxy", …)`. Con 0 detrás de Render, todos los clientes
  comparten la IP del proxy y caen en el mismo balde: la app queda inusable. Con
  `trust proxy: true`, cualquiera falsifica `X-Forwarded-For` y el límite no existe, sin
  ruido. El default es 0 —el que falla ruidoso— y `true` es inalcanzable porque
  `trustProxyHops()` parsea siempre a entero. **El deploy tiene que setear
  `TRUST_PROXY_HOPS=1`** (D-045).
- **El puerto sale de `PORT` en `apps/api/.env`.**
  No lo hardcodees.
- **2026-08-21 · `kysely` y `@libsql/kysely-libsql` son ESM puro, mismo problema que
  `@paralleldrive/cuid2` (D-049).** Se resuelve con el mismo patrón, centralizado esta vez en
  `src/lib/kysely.ts` y `src/lib/libsql-dialect.ts` (para no repetirlo en cada archivo que importa
  Kysely) — `require()` en runtime tipado con `typeof import("kysely", { with: { "resolution-mode":
  "require" } })`, que a diferencia del patrón de `libsql-client.ts` no necesita listar cada tipo a
  mano: le da al `require()` el tipo completo del módulo de una sola vez.
- **2026-08-21 · Pasarle a `LibsqlDialect` un `Client` ya construido con `createClient` de
  `lib/libsql-client.ts` no tipa.** `@libsql/kysely-libsql` declara `@libsql/client: ^0.8.0` como
  dependencia propia; este package usa `^0.17.4`. `^0.8.0` no cubre `0.17.4` (para versiones `0.x`,
  el caret solo permite parches), así que pnpm instala las dos versiones sin dedupear, y el tipo
  `Client` de una no es asignable al de la otra (`sync()` devuelve `Promise<Replicated>` en una y
  `Promise<void>` en la otra). **Fix:** `LibsqlDialect` recibe `{ url, authToken }` en vez de
  `{ client }` — así construye su propio cliente con su propia versión, y no hay dos tipos de
  `Client` en la misma expresión. Consecuencia: `lib/db.ts` ya no expone un `client` para cerrar a
  mano; los tests cierran con `db.destroy()` (que sí cierra la conexión subyacente cuando
  `LibsqlDialect` es dueño del cliente que crea — no cuando se le pasa uno externo, por eso el fix
  de arriba). Donde hace falta un cliente crudo para SQL sin pasar por Kysely (`db/migrate.ts`,
  `test/global-setup.ts`), se sigue usando `lib/libsql-client.ts` aparte, sin compartirlo con la
  instancia de `Kysely`.
- **2026-08-21 · Kysely no tiene `mode: "boolean"` / `mode: "timestamp_ms"` como Drizzle.** SQLite
  guarda ambos como `integer` y `@libsql/client` los devuelve tal cual (`number`), no como
  `boolean`/`Date`. Centralizado en `src/db/sqlite-type-plugin.ts` (`SqliteTypeCoercionPlugin`,
  cargado en cada instancia de `Kysely`) en vez de convertir a mano en cada ruta — convierte por
  nombre de columna (`createdAt`, `updatedAt`, `certifiedAt`, `estimatedDelivery`, `uploadedAt` →
  `Date`; `isActive`, `authoritative`, `validationCritical` → `boolean`) en el resultado de toda
  query. Al insertar/actualizar no hace falta la inversa: `@libsql/client` acepta `Date`/`boolean`
  directo como valor (los convierte él). Si se agrega una columna nueva de estos dos tipos, hay que
  sumarla a los `Set` del plugin — no hay chequeo del compilador que lo fuerce.
- **2026-08-21 · Kysely no genera IDs ni timestamps por default** (`$defaultFn`/`$onUpdate` de
  Drizzle no tienen equivalente). `src/db/id.ts` centraliza `createId()` (mismo patrón ESM que
  arriba); cada `insertInto` pasa `id: createId()` y `createdAt/updatedAt: new Date()` a mano, y
  cada `updateTable` que toca una fila con `updatedAt` lo suma explícito a `.set(...)`. Si un
  endpoint nuevo hace un `update` y se olvida `updatedAt`, nada lo va a marcar — a diferencia de
  Drizzle, donde `$onUpdate` lo hacía solo.
- **2026-08-27 · Los defaults de `createStorage()` son de MinIO, y contra R2 hay que pisarlos.**
  `S3_REGION` cae a `us-east-1` y `S3_FORCE_PATH_STYLE` a `true` porque el S3 que se prueba local es
  MinIO. Cloudflare documenta lo contrario en las dos: *"the region for an R2 bucket is `auto`"* y
  virtual-hosted-style —path-style no está garantizado—. Con credenciales **correctas** y estos dos
  defaults, R2 falla igual, y el error no dice "te falta setear la región". Están explícitos en
  `render.yaml` y el porqué está ahí al lado; el comentario de `storage.ts` que dice que R2 "tolera"
  path-style no está respaldado por la documentación de Cloudflare.

### El endpoint de estado de stages, y lo que todavía no cumple

**`POST /evidence/:id/anchor`** (admin) ancla el hash de un archivo por metadata — el otro camino
on-chain de M1 (D-006, D-061). Es idempotente: si el archivo ya tiene su anclaje devuelve el mismo
evento en vez de gastar otra transacción. Lo dispara el admin y nunca el upload, porque una vez en
la cadena no se borra.

`PATCH /api/v1/stages/:id/state` es hoy el único lugar donde el developer avanza el registro, y hace
cinco cosas (D-059, y el chequeo de rol del 2026-09-08): rechaza si el estado pedido no es
`InProgress` y quien pide no es `admin` (`Stage certification`/`Stage observation` son
"Certifier-exclusive action" en `M2-D1 §Role Permission Matrix` — certificar u observar solo pasa por
`POST /certifier/stages/:id/certify`/`observe`), aplica la tabla de transiciones, exige evidencia
para completar un stage `validationCritical`, escribe el estado, y registra un `OnChainEvent`
**pendiente** — la declaración queda registrada y la prueba queda `Pending` hasta que exista TXID. Al
revés no puede pasar.

Lo que le falta, en orden de importancia:

- **~~La evidencia que exige es el piso de D-028.~~** Cerrado el 2026-09-01. Además de exigir que
  exista *una* evidencia, completar un stage crítico rechaza con `STAGE_EVIDENCE_UNATTRIBUTED` si
  alguna evidencia se **declara** `authoritative` sin `issuingAuthority`. No se valida la autoridad
  —la plataforma no valida (D-026)—: se exige que la declaración esté completa. D-084 sacó
  `authorityReference` y D-086 eliminó la atestación como condición.
  **El rechazo es en la transición, no en el upload**: subir una evidencia autoritativa sin
  atribuir siempre se puede; avanzar el stage con ella adentro, no. Y una evidencia **no**
  autoritativa nunca pide atribución — el developer sube fotos de obra desde el teléfono.
- **~~Nadie calcula el commitment.~~** Cerrado: al completar, `crearBundle` congela la evidencia
  del stage en un `EvidenceBundle` y su Merkle root viaja al datum. **Es un acta, no un índice:** se
  escribe con lo que existía en ese momento y no se toca. Si después se sube más evidencia, es otro
  bundle — el root ya anclado tiene que seguir verificando.
  **Y desde el 2026-09-09 es idempotente por contenido** (regla 8): si el acta vigente del stage ya
  dice ese root, `crearBundle` la devuelve en vez de escribir otra igual. Hacía falta porque
  completar llamaba a `crearBundle` **dos veces** —una en `POST /developer/projects/:id/stages/
  :stageId/evidence` y otra desde `transitionStage`— y la segunda insertaba una gemela: en
  producción, "Terminaciones" de `torre-a` quedó con 3 evidencias, **4 bundles y 3 roots
  distintos**. Inocuo en valor (el root repetido es el mismo) pero el `leftJoin EvidenceBundle` del
  listado del certifier duplica filas por eso. Se compara contra el acta **vigente**, que es la
  misma fila que después lee `rootDelStage` para armar el datum. Tests en
  `test/evidence-upload.test.ts` §"el acta es idempotente por contenido", verificados en rojo
  neutralizando el chequeo. **Las 4 filas que ya existen en producción no se tocaron: son
  historia, y la duplicada tiene el mismo root que la buena.**
- **~~El path dice `/milestones/`~~ — falso desde hace tiempo, y este archivo lo afirmó de más.**
  `app.ts` monta `app.use("/api/v1/stages", stagesRoutes)` y **no existe ninguna ruta
  `/milestones`**. Lo único que conserva la palabra es `setMilestoneState` en
  `apps/web/src/api/port.ts` —un nombre de función, no un path— y las claves de i18n que
  corresponden al test ID `INV-STAGE-MILESTONE-001`, que M2-D5 obliga a transcribir literal.
- **El nombre todavía miente un poco:** `PATCH .../state` suena a editar un campo, cuando lo que
  ocurre es *registrar una transición* — un evento, no un update. Es lo único que queda de esta
  deuda; el path ya es `/stages/`.

### Superficie 🔴 — inventario

> 🔴 = **el humano lidera y escribe; el LLM asiste**, y el revisor tiene que poder explicar cada
> línea sin mirar el chat (`CLAUDE.md` raíz §Niveles de autonomía). **Hoy el 100% del código 🔴 del
> proyecto vive en este package.** Auditado el 2026-08-20 leyendo los 27 endpoints, no estimado.

| Archivo | Qué lo hace 🔴 | Estado |
|---|---|---|
| `lib/jwt.ts` | manejo de la clave de firma | ✔ cerrado 2026-08-20 — sin fallback (D-042, `SPEC-010`) · algoritmo fijado a HS256 de los dos lados el 2026-09-04 |
| `routes/auth.routes.ts` | bcrypt en login | ✔ cerrado 2026-08-20 — hash dummy (`SPEC-010`) |
| `routes/users.routes.ts` | bcrypt al crear y al cambiar password | ✔ correcto (cost 10, nunca se loguea ni se devuelve) · política endurecida 2026-08-21 (D-046) |
| `middlewares/auth.ts` · `canAccessProject` | la lógica de membresía | ✔ correcto · fail-closed desde 2026-08-21 · falta que sea middleware |
| `utils/hashing.ts` | SHA-256 de evidencia | ✔ correcto · R2 lo va a mover |
| `SERVICE_WALLET_PRIVATE_KEY`, construcción de commitments | `packages/cardano` | el código existe y el factory lo cablea (2026-08-27); **falta la cuenta de Blockfrost y la wallet fondeada**. La clave es 🔴 y no se puede rotar sin migrar los hilos |

#### ~~P1 · `JWT_SECRET` cae a un literal público~~ — cerrado el 2026-08-20

`lib/jwt.ts` hacía `process.env.JWT_SECRET || "dev-secret"`. Con la variable ausente **o vacía**
—y `.env.example` traía `JWT_SECRET=""`, que en JS es falsy— la API firmaba con un literal que está
en el repo: cualquiera forjaba `{userId, role:"admin"}`. No era escalar privilegios, era saltear la
autenticación entera. No llegó a ser explotable porque todavía no hay deploy.

**Cómo quedó.** `requireJwtSecret()` lee el entorno, recorta y **lanza** si no queda nada; se
evalúa al importar el módulo, así que el fallo es el arranque del proceso y no una request de
producción — que importa porque el free tier de Render no da shell para ir a mirar qué variables
quedaron cargadas (D-040). El porqué completo y las alternativas descartadas están en **D-042**;
las invariantes y los casos borde, en `specs/SPEC-010`.

**Lo que hay que sostener.** El `render.yaml` que falta escribir (D-041) tiene que declarar
`JWT_SECRET` con `generateValue: true`. Y `pnpm dev` ahora falla en un checkout sin
`apps/api/.env`: es el comportamiento buscado, no una regresión.

#### El algoritmo de firma se fija; el ciclo de vida del token sigue abierto

**Cerrado el 2026-09-04 · `signToken`/`verifyToken` fijan HS256 explícito.** Antes se firmaba sin
declarar `algorithm` y se verificaba sin `algorithms`, o sea que la garantía la ponía el default de
la librería y no el código. **No había agujero:** con un secreto de tipo `string`, jsonwebtoken v9
acota la verificación a la familia HS* por su cuenta, así que ni `alg: "none"` ni la confusión HS/RS
llegaban a entrar. Lo que se cierra es la **dependencia** de ese default — el día que la clave deje
de ser un string (un KMS, un par asimétrico) la allowlist deja de deducirse sola y el token pasa a
elegir su propio algoritmo, sin que nada en el diff de ese cambio lo señale. Test:
`test/jwt.test.ts` → *"el algoritmo de firma está fijado de los dos lados"*, que asienta las tres
mitades (HS512 con la clave real se rechaza, HS256 se acepta, el header emitido dice HS256).

**Abierto, y es una decisión del dueño, no una tarea:** el token dura **7 días y no se puede
revocar**. La revocación que hoy existe es indirecta y gruesa — `authenticate()` reconsulta la base
en cada request y rechaza si `isActive` es `false`, así que dar de baja una cuenta sí corta sus
sesiones al instante; lo que no hay es forma de invalidar **un** token (un robo, un logout que
importe) sin dar de baja al usuario entero. Cerrarlo de verdad pide refresh tokens con un store de
revocación: tabla nueva, endpoint nuevo, y el front tocado. **No se hizo a propósito**: es
infraestructura para un problema que todavía no duele, con la superficie hoy en demo y el token en
`sessionStorage` (muere al cerrar la pestaña). Si alguna vez hay usuarios reales con sesiones
largas, esto se reabre y ahí sí conviene medir cuánto cuesta el store antes de elegir la forma.

#### ~~El comentario del login promete más de lo que el código cumple~~ — cerrado el 2026-08-20

`auth.routes.ts` devolvía el mismo body para "no existe" y para "password incorrecta", y el
comentario explicaba bien por qué. Pero **el tiempo de respuesta no era el mismo**: si el usuario no
existía, cortaba antes y nunca corría `bcrypt.compare`. El oráculo que el comentario decía cerrar
seguía abierto — se consultaba con un cronómetro en vez de leyendo el body, que es igual de gratis.

**Cómo quedó.** Se compara siempre, contra `user?.passwordHash ?? HASH_DUMMY`, y los tres rechazos
—no existe, inactivo, password incorrecta— se resuelven en un solo `if` **después** de la
comparación. El hash dummy se deriva de un `randomUUID()` por proceso: ninguna password puede
coincidir y no queda en el repo un literal con forma de credencial.

**Medido, no estimado** (`test/auth-timing.test.ts`, medianas de 9 corridas intercaladas):

| | antes | después |
|---|---|---|
| email inexistente | ~0 ms | 82.3 ms |
| password incorrecta | ~81 ms | 83.0 ms |
| **diferencia** | **~81 ms** | **0.7 ms** |

El test asienta por **orden de magnitud** (entre 0.5× y 2×), no por milisegundos: la falla que
importa es categórica —cortar antes de bcrypt devuelve ~0 ms—, y una aserción en milisegundos sería
flaky en cualquier CI compartido. `isActive=false` entra en el mismo caso: antes también cortaba
temprano, o sea que revelaba "esta cuenta existe pero está dada de baja".

**Lo que costó, porque no fue gratis.** Ahora **todo** intento paga un bcrypt: un email inventado
pasó de costar ~0 ms a costar 82 ms, y en el free tier son 0.1 CPU (D-040). Sin límite, un spray sin
autenticar voltea la URL pública, que es el criterio 12. Por eso `/login` tiene rate limiting
(D-045) — y por eso el arreglo del oráculo y el limiter son el mismo cambio en dos commits, no dos
cosas independientes. Si alguna vez alguien piensa en sacar el limiter, esto es lo que reabre.

**Lo que queda.** La consulta a la base sigue costando distinto según el email exista o no. Es un
índice único sobre una columna, y al lado de los 82 ms de bcrypt no se mide. Si algún día el store
de usuarios deja de ser una tabla local, hay que volver a medirlo.

#### `canAccessProject`: el default fail-open cerrado, la forma todavía no

Auditados los 27 endpoints el 2026-08-20: **no hay agujeros**. `evidence` 6/6, `milestones` 6/6, y
los de `projects` que no lo llaman son admin-only o filtran por membresía en el query (el listado
scopea correctamente a no-admins). La auditoría dejó dos observaciones de **forma**; una está
cerrada y la otra no.

**Cerrado el 2026-08-21 · el 4º parámetro era opcional y omitirlo abría, no cerraba.** Sin
`allowedMemberships`, cualquier membresía pasaba: quien quiso decir "solo developer" y se olvidó del
argumento obtenía "cualquier miembro", en silencio. Un default fail-open en la función 🔴 por
excelencia. Ahora es **obligatorio** —omitirlo es un error de compilación, no un permiso más
ancho— y para abrir a cualquier miembro hay que escribir `ANY_MEMBERSHIP`, que se puede grepear. Los
7 call sites que lo omitían (todos de lectura) lo dicen explícito. El porqué está en D-042; los
casos, en `specs/SPEC-010` y `test/project-access.test.ts`.

`ANY_MEMBERSHIP` es una lista **literal** con `satisfies Record<MembershipRole, true>`, no
`Object.values(MembershipRole)`. La primera versión usaba el enum y se mantenía sola, que suena
mejor y es peor: una membresía nueva quedaba leyendo todos los proyectos sin que nadie lo decidiera.
Con `notary` pendiente de entrar al schema —el dominio tiene cuatro roles y el enum tiene tres, con
los nombres viejos— eso iba a pasar en serio. Ahora agregar un rol al enum sin tocar esta lista no
compila (TS1360, verificado a propósito).

**Cerrado el 2026-08-23 · la segunda capa es un middleware** (`SPEC-012`). Era una función que
había que acordarse de llamar **adentro** del handler, y de chequearle el booleano: un endpoint que
se la olvidaba funcionaba perfecto y servía datos de un proyecto a quien no era miembro, sin que lo
viera el compilador, ni un test, ni el CI.

Ahora es `requireProjectAccess(source, allowedMemberships)`, hermano de `requireRole`, y las dos
capas se leen en el mismo lugar: la firma de la ruta. **Ninguna ruta llama a `canAccessProject`** —
su único llamador es el middleware, que sigue delegando en `projectScope` (D-043).

`source` cubre las dos formas: `{ param: "id" }` cuando el path ya trae el projectId, y
`{ via: "Stage" | "Evidence", param: "id" }` cuando hay que cargar la entidad para averiguarlo.
`allowedMemberships` es **posicional y obligatorio**, no rest args: con `...memberships` omitirlo
compilaría como lista vacía —cerrado, pero en silencio— y D-042 fijó que omitirlo sea un error de
compilación.

Hubo un escáner (`scripts/check-project-access.py`) que gritaba ante el olvido; se borró con el
harness (D-053) porque eran 147 líneas parcheando un problema de forma. Esta es la forma.

**Lo que queda abierto, chico y declarado:** en la forma B, una entidad inexistente da 404 y una
ajena da 403, así que desde afuera se distingue "no existe" de "no es tuyo". Los ids son cuid2, así
que no es explotable en la práctica; se conservó a propósito para no cambiar semántica de seguridad
adentro de un refactor (`SPEC-012` §Lo que NO hace). Y el middleware carga la entidad para sacarle
el `projectId` mientras el handler la vuelve a cargar: un lookup por PK de más en 5 endpoints,
aceptado para no meter una caché adentro del middleware 🔴.

**Cerrado el 2026-08-21 · la regla estaba escrita tres veces.** `canAccessProject`, el bypass de
`admin` repetido en 5 call sites, y un query a mano en `GET /projects` que no llamaba a la función.
Las tres coincidían por casualidad y solo una tenía tests. Ahora hay una sola —`projectScope`, una
condición de Kysely (`EXISTS` correlacionado, D-048 → D-049)— que `canAccessProject` aplica a un id y el listado aplica a la
colección; el bypass de admin vive adentro y en ningún otro lado. Al unificarlas cayeron dos bugs de
la copia: el listado de un no-admin salía sin orden, y un usuario con dos membresías en el mismo
proyecto lo veía **duplicado**. Ojo con la consecuencia deliberada: `admin` sobre un proyecto que no
existe ahora da `false`, no `true`. Todo en D-043.

**Deuda que queda a la vista acá.** `GET /projects` sigue leyendo `status` y `city` de la query sin
Zod (`String(status) as any`). No es autorización y no es 🔴, pero es la regla 6 sin cumplir en el
único lugar donde el body no aplica.

#### La matriz de permisos, asentada — 2026-09-04

**El problema que cierra.** La segunda capa tiene forma que no compila si te la olvidás
(`allowedMemberships` obligatorio, D-042), pero eso solo protege a quien la escribe: **nada obligaba
a poner el middleware**. Los dos agujeros de septiembre son el mismo modo de falla —
`GET /evidence/:bundleId/files` sin `requireProjectAccess`, y `POST /users` con su propio enum de
roles— y los dos los encontró una auditoría a mano. No había ninguna herramienta que los pudiera
encontrar, y con 87 handlers en 18 archivos la auditoría a mano no escala ni se repite.

**Cómo funciona.** `test/route-guards.test.ts` recorre los routers **ya montados** y reconstruye la
matriz de las 88 rutas: método, path absoluto y cadena de guards declarados. La compara contra un
literal en el propio test. Una ruta nueva, un guard que cambia o uno que desaparece ponen el test en
rojo hasta que alguien actualice el literal — y actualizarlo es la revisión.

Tres piezas lo sostienen, y las tres son deliberadas:

1. **`GUARD`** (`middlewares/auth.ts`) — un símbolo global, propiedad no enumerable, que
   `requireRole` y `requireProjectAccess` le cuelgan a la closure que devuelven. Sin esto el router
   sabe que hay tres funciones anónimas en la cadena y nada más. No cambia el comportamiento del
   middleware ni aparece en un spread.
2. **`MONTAJE`** (`app.ts`) — el montaje pasó de 22 `app.use(...)` sueltos a una tabla que el propio
   `app.ts` recorre para montar. **Express 5 no conserva el path de montaje**: `Layer` lo compila a
   un matcher y tira el string (comprobado leyendo el layer, no supuesto), así que sin la tabla el
   test tendría que repetir los prefijos por su cuenta y un cambio de prefijo lo dejaría auditando
   rutas que ya no existen, en silencio.
3. **Los tres tests hermanos** — sesión obligatoria salvo las dos rutas públicas declaradas
   (`/auth/login` y `/public/dossier/:shareToken`); ninguna lista de roles o membresías vacía; y
   **los routers que comparten prefijo declaran los mismos guards de router**, que es el bug del
   2026-08-24 convertido en invariante: hoy `/api/v1/developer` tiene cuatro routers y coinciden por
   disciplina, nada lo obligaba.

**Se verificó rompiéndolo, no solo viéndolo verde.** Tres mutaciones, cada una revertida:
sacarle `requireProjectAccess` a `GET /evidence/:bundleId/files` (o sea, reintroducir el agujero de
septiembre) → rojo; agregar una ruta al router público → rojo por dos tests; cambiar el
`requireRole` de `capital.routes.ts` para que difiera de los otros tres del prefijo `/developer` →
rojo. **Un test de auditoría que nunca se vio fallar no es evidencia de nada.**

**Qué NO prueba, y hay que tenerlo presente al leer la matriz.** Asienta los guards **declarados**,
no que la autorización sea correcta ni completa. Hay un tercer patrón, vivo y sin forma: autorizar
**adentro** del handler. `contracts.routes.ts` llama a `projectScope` a mano;
`investor.routes.ts` compara `investorId` contra `req.user!.id` en cada handler o adentro de
`dossierDeLaUnidad`; `notary.routes.ts` filtra por `signedById`. En la matriz esas rutas figuran con
la columna corta —solo `auth` o `auth + rol(...)`— y **eso no significa que estén abiertas**: se
auditaron una por una al escribir esto y ninguna lo está. Significa que su autorización no se lee en
la firma, no la protege el compilador y no la ve este test. **Esa columna corta es la lista de
candidatas** a subir a la firma con un `requireOwnership` hermano de los otros dos, que es el paso
siguiente y todavía no está hecho.

**La lista de candidatas, resuelta el mismo día**, y la última —`GET /contracts/:contractId/releases`,
la única regla disyuntiva— con `{ alguna: [...] }` cuando llegó el guard único. **Ya no queda
ninguna ruta autorizando adentro del handler.**

**Y una redundancia que la matriz dejó a la vista:** `investor`, `developer`, `notary` y otros
declaran `requireRole` a nivel de router **y** lo repiten en cada ruta, así que la matriz muestra
`rol(admin|buyer) + rol(admin|buyer)`. No es un bug —el segundo chequeo es idéntico al primero— y se
dejó tal cual a propósito: sacarlo es tocar la capa de autorización de 20 rutas para ganar prolijidad,
y eso se hace con su propia revisión, no de arrastre.

#### ~~El SHA-256 se mueve cuando llegue R2~~ — cerrado el 2026-08-23

El hash lo calcula ahora `lib/storage.ts`, y con `STORAGE_DRIVER=s3` **relee el objeto subido y lo
rehashea**: cubre los bytes que quedaron en el object storage, no los del temporal. La diferencia
no es teórica — si una subida se truncara, el hash del temporal seguiría siendo "correcto" y
estaríamos anclando la huella de un archivo que no existe en ningún lado.

`utils/hashing.ts` se borró: su única función quedó adentro del port, y dos lugares que hashean es
uno de más.

#### El guard único — `authorize`, 2026-09-04 (D-088)

**Las rutas montadas declaran su regla en la firma.** Las únicas sin `authorize` son las tres sin
sesión: las dos que M2-D5 §2.2 declara, `POST /auth/login` y `GET /public/dossier/:shareToken`, y la
portada del proyecto, `GET /public/projects/:id/cover` (D-099).

```ts
authorize({ roles: ["admin", "developer"], acceso: { proyecto: { param: "id" }, membresias: ["developer"] } })
authorize({ roles: CUALQUIER_ROL, acceso: { dueño: { via: "Unit", param: "id" } } })
authorize({ roles: ["admin"], acceso: "soloRol" })
```

**Por qué, en una línea:** con guards sueltos, omitir la capa de pertenencia compilaba — *la
ausencia de una llamada no es un tipo*. `acceso` obligatorio convierte esa ausencia en un
`"soloRol"` explícito, que es algo que alguien firmó y que se discute en un diff. El argumento
completo está en D-088.

**`requireRole`, `requireProjectAccess` y `requireOwnership` se borraron**, no quedaron como
internos: un guard exportado que nadie llama es una forma vieja esperando que alguien la copie. Lo
que sobrevive son los **evaluadores** (`evaluarProyecto`, `evaluarDueño`, `evaluarRegla`), que
devuelven un `Veredicto` en vez de contestar. Esa separación no es estética: `{ alguna: [...] }`
necesita probar la segunda rama cuando la primera dice que no, y un middleware que ya contestó 403
no deja probar nada.

**Dos decisiones del `alguna` que no se leen del tipo:** un `500` gana sobre todo, incluso sobre una
rama que pasa —una ruta mal declarada tiene que ser ruidosa y no taparse con el OK de la otra—, y
entre `403` y `404` gana el `403`, porque contestar "no existe" a quien tampoco podía saberlo filtra
justamente eso.

**El reparto, medido:** `"soloRol"` 19 · `{ scopeEnQuery }` 26 · `{ proyecto }` 30 · `{ dueño }` 9 ·
`{ alguna }` 1 · sin sesión 2.

**`scopeEnQuery` es la etiqueta de "hay regla de fila y la aplica el handler".** Nació porque
`"soloRol"` quedaba en 45 rutas y 26 mentían: los listados se acotan con `where userId = ...` o
`projectScope(...)` adentro del query, así que decir "no hay regla de fila" se leía como una revisión
hecha cuando no lo era. Ahora cada una nombra su filtro —`"Unit.investorId = usuario"`,
`"projectScope(developer)"`— y hay un test que exige que el texto **no esté vacío**: sin eso sería
`"soloRol"` con otro nombre. **No lo verifica el compilador**; el valor es que la afirmación sea
concreta y se pueda contrastar contra el `where` de al lado.

**Al escribir una ruta nueva, elegí entre las dos leyendo tu propio handler**, no por costumbre. Si
tu query filtra por el usuario o por `projectScope`, es `scopeEnQuery` y hay que decir por qué campo.

**El agujero que destapó etiquetar, y cómo quedó.** `GET /developer/audit-log` devolvía el `AuditLog`
**entero**, sin acotar por proyecto, con `actorName` y `actorRole` de cada usuario del sistema. Es la
regla 5 sin su segunda capa. **No era decisión de producto:** M2-D1 §4 (*"developer sees
project-scoped events"*) y M2-D4 §P6 (*"all events scoped to that developer's projects"*) ya la
tenían tomada, y el código no la cumplía.

Lo cierra `auditScope` (`middlewares/auth.ts`), hermana de `projectScope`: el bypass de `admin`
adentro, y para el resto un `OR` de `EXISTS` que resuelve `entityType`/`entityId` → proyecto
(`Project` directo; `Stage`/`Evidence`/`Invitation`/`Unit`/`ProjectMember` por su `projectId`;
`Dossier` por su unidad; `PaymentRelease` por contrato → unidad). Reusa `projectScope` adentro para
que la regla de membresía siga en un solo lugar (D-043).

**Es fail-closed y hay que saberlo:** un `entityType` que no esté en ese mapeo **no se muestra**. Si
auditás una entidad nueva y te olvidás de sumarla, el síntoma es "no aparece en el audit log", no "la
ve todo el mundo". `User` está afuera **por diseño** — crear usuarios o cambiar roles no pertenece a
ningún proyecto.

**La forma que corresponde es una columna `projectId` en `AuditLog`**, escrita por `writeAuditLog`:
sin joins y sin mapeo que se pueda olvidar. No se hizo porque pide la primera migración sobre una
base desplegada (D-063) y un backfill que para varias filas viejas no tiene respuesta. **Si alguna
vez tocás el esquema de `AuditLog` por otro motivo, sumá la columna en el mismo commit.**

#### La tercera capa — la pertenencia de fila, 2026-09-04

**Qué contesta.** `requireRole` responde "¿este rol puede tocar esta superficie?" y
`requireProjectAccess` responde "¿es miembro de este proyecto?". Ninguna responde la pregunta que
rige la superficie del investor: *¿esta unidad, esta invitación, este contrato son suyos?* — el
aislamiento cross-rol de M2-D1 §Cross-role data isolation. Eso vivía como un `if` copiado en **nueve
handlers**, siempre igual: `req.user!.role !== "admin" && fila.x !== req.user!.id`.

**Contra qué argumento se cambió.** `investor.routes.ts` justificaba tenerlo suelto con que *"el dato
que decide —quién es el dueño— sale de la fila, no del token"*. Es cierto y no alcanza:
`requireProjectAccess` **ya carga una fila** para averiguar el `projectId` cuando el path trae un
`stageId` o un `evidenceId`, y a nadie se le ocurrió bajarlo al handler por eso. Lo que sí traía el
chequeo suelto es el modo de falla de siempre — una ruta nueva que se olvida el `if` compila, pasa el
happy path y sirve la unidad de otro. Es el agujero de `GET /evidence/:bundleId/files` otra vez, y la
respuesta es la que ya dio D-042: que se lea en la firma.

**Las tres formas de `OwnerSource`,** ramas explícitas y no una query con nombres de tabla en
variables (mismo criterio que `ProjectSource`):

| `via` | Fila | Compara contra |
|---|---|---|
| `Unit` | `Unit.investorId` por PK | `user.id` |
| `Invitation` | `Invitation.investorEmail` por PK | **`user.email`** |
| `ContractOfUnit` | `Contract.investorId` **por `unitId`** | `user.id` |
| `CertifierInvitation` | `CertifierInvitation.certifierId` por PK | `user.id` — el certifier ya tiene cuenta al ser invitado (SPEC-221) |

Las dos rarezas son reales y por eso están tipadas aparte. La invitación compara contra el **email**
porque existe antes de que el investor tenga cuenta: si comparara ids, ninguna invitación sería de
nadie. Y `ContractOfUnit` resuelve la fila por `unitId` y no por su clave primaria, porque el path de
`GET /investor/contracts/:unitId` trae la unidad — el 404 igual dice `Contract not found`, que es lo
que decía antes.

**Dos decisiones que quedan adentro, en un solo lugar cada una.** El bypass de `admin`, igual que en
`projectScope` (D-043). Y que **un dueño `null` es 403, no un pase libre**: una unidad sin vender no
es de nadie, y para un no-admin es tan ajena como cualquier otra. Antes eso salía de cómo se comporta
`!==` con `null`; ahora está escrito, y hay un test que existe para que nadie lo "simplifique".

**Se verificó neutralizando el guard**, no solo viéndolo verde: con `requireOwnership` convertido en
un `next()` pelado, 7 de los 13 tests de `test/require-ownership.test.ts` se ponen rojos — todos los
de rechazo. Los 6 que sobreviven son los caminos felices y los 404 que el handler todavía produce por
su cuenta, que es exactamente lo que se espera.

**La que queda afuera, a propósito: `GET /contracts/:contractId/releases`.** Su regla es
*el dueño del contrato **o** cualquier miembro del proyecto* — una disyunción, y una cadena de
middlewares es una conjunción. Expresarla pediría un combinador `o(...)` en la capa de autorización:
más maquinaria y más superficie 🟡 para una sola ruta. Autoriza adentro del handler, con
`projectScope` a mano, y está bien mientras sea una. **Si aparece una segunda ruta con regla
disyuntiva, ahí sí conviene el combinador** — dos copias de una regla de autorización es como
empezaron las nueve.

**Lo que `notary` NO era.** Al ir a aplicarlo apareció que `GET /dossiers/:id`, `/sign` y `/reject`
**no tienen** regla de pertenencia y no es un olvido: el dossier pendiente es una **cola de trabajo
compartida**, cualquier notary firma cualquiera, y `signedById` se escribe al firmar. Los listados
(`/kpis`, `/signatures`) filtran por `signedById` para acotar la vista, que es scope y no
autorización. Antes de subir un filtro a la firma, preguntá si es una regla de acceso o un criterio
de listado — no son lo mismo y el middleware solo sirve para la primera.

#### bcrypt: se queda nativo

El uso es correcto — cost 10 (regla 4), `compare` en login, `hash` al crear y al cambiar password,
y `auth.routes.ts` tipa la respuesta explícitamente para que `passwordHash` no se escape por un
spread distraído.

**Por qué bcrypt y no Argon2id: D-046.** Resumen: Argon2id es la recomendación general, pero es
memory-hard, y en 0.1 CPU con todo login pagando un hash (D-045) es la forma equivocada para esta
caja. La salida si el módulo nativo alguna vez rompe un build **no es `bcryptjs`, es `scrypt` de
`node:crypto`** — stdlib, sin dependencias, se lleva puesta toda esta deuda de una. La política de
largo (mín. 8 caracteres, máx. 72 **bytes**, sin reglas de composición) vive en `passwordSchema` de
`packages/shared`, no en las rutas.

Sobre `bcrypt` vs `bcryptjs`, la recomendación **se dio vuelta** y conviene saber por qué: D-041
mató el argumento caro (sin Docker, no hay toolchain que meter en una imagen), y apareció un dato
nuevo — **Render free da 0.1 CPU**, donde los ~81 ms de una máquina rápida se van a varios cientos,
y `bcryptjs` es ~30% más lento encima de eso. El warning de `url.parse()` se cerró con el bump a
`bcrypt@6.0.0` (ver Trampas); queda el riesgo genérico de módulo nativo. **Bajar el cost no es
opción: la regla 4 fija 10.**


### Tests

`pnpm --filter @plataforma/api test` — vitest + supertest contra **una base SQLite propia**
(`test.db`), que `test/global-setup.ts` crea aplicando las migraciones (`src/db/migrate.ts`, D-049)
y siembra en cada corrida. Nunca contra `.data/dev.db`: un test no puede depender del seed de desarrollo
ni ensuciarlo.

Se aplican las migraciones reales (`migrations/*.sql`) **con el mismo runner que corre en producción**
(`src/db/migrate.ts`, D-052) y no una proyección ad-hoc del schema: así la
suite verifica lo mismo que va a correr en producción.

### Comandos

```bash
pnpm --filter @plataforma/api dev            # solo la API; antes migra la base si es local (`--solo-local`)
pnpm --filter @plataforma/api db:migrate     # aplica las migraciones pendientes
pnpm --filter @plataforma/api db:seed        # datos demo
pnpm --filter @plataforma/api test:s3        # storage contra el MinIO de compose.dev.yml — NO corre en CI
pnpm --filter @plataforma/api docs:api       # regenera specs/evidencia-m3/2-api/postman/*.json desde el router montado
pnpm --filter @plataforma/api docs:openapi   # regenera specs/evidencia-m3/2-api/openapi/*.json, mismo router, formato OpenAPI 3.1
```

**`docs:openapi` existía como pendiente hasta el 2026-09-08: 23 de los 26 endpoints que validan
con Zod tenían su schema declarado inline, y `zod-openapi` necesita una referencia importable, no
un literal dentro del handler.** Se resolvió moviendo esos 23 schemas a `packages/shared` (regla 6,
que ya lo pedía por otro motivo) — ver `CLAUDE.md` raíz. El generador
(`apps/api/scripts/generate-openapi.ts`) reusa la misma introspección que `docs:api` y
`route-guards.test.ts` (`route-inventory.ts`, que ahora también expone el handler terminal de cada
ruta) y mapea a mano las 26 rutas validadas a su schema real — la lista está en
`REQUEST_SCHEMAS`, y **se edita el mismo día que se agrega un `safeParse` nuevo**, igual que el
literal de la matriz de permisos. El código de éxito se lee del `res.status(2xx)` real del handler,
no se adivina por verbo HTTP — la primera versión sí adivinaba y mentía en `POST /auth/login`
(200, no 201), `POST /evidence/reconcile` (200) y `POST /invitations/:id/decline` (204). Las
respuestas quedan sin schema a propósito: la mayoría de los handlers devuelve un tipo TS inferido
de Kysely, no un schema Zod en runtime, y documentarlas pediría inventar uno. `specs/evidencia-m3/2-api/openapi/` está
excluido del formatter de Biome (`biome.json`), mismo motivo que `specs/evidencia-m3/2-api/postman`: Biome colapsa
arrays cortos a una línea y eso rompe el test de frescura, que compara contra el
`JSON.stringify(doc, null, 2)` crudo.

**`0000_init.sql` describe la base al 2026-08-23**, colapsando las seis que existieron hasta esa
fecha (D-063): nada estaba desplegado, así que el esquema real —que había que reconstruir mentalmente
aplicando seis archivos en orden, incluida una reconstrucción de tabla— pasó a leerse en un solo
lugar. **Desde que Turso está en producción (2026-09-03), toda corrección es una migración nueva**
(`0001_stage_progress.sql`, `0002_payment_attestation.sql`, …), nunca una edición de `0000_init.sql`
ni de ninguna ya aplicada.

**La regla "no editar una migración aplicada" tiene condición, y hay que saber cuál.** Protege
entornos donde ya corrió. Mientras las únicas bases sean `.data/dev.db` y las que la suite recrea en `.data/test/`,
corregir el esquema es editar el archivo y **borrar la base local**. En cuanto exista una base
desplegada —Turso—, esto se termina: toda corrección es migración nueva, sin excepción.

**Si tenías una `dev.db` de antes, borrala.** El runner registra por nombre de archivo: una base que
ya aplicó el `0000_init.sql` viejo **no** va a aplicar el nuevo, y se queda con el esquema anterior
sin avisar. Es el único modo de falla que este colapso introduce.

No hay `db:generate` ni `db:studio` (D-049): Kysely no trae generador de migraciones ni UI de
inspección. Una migración nueva se escribe a mano en `migrations/*.sql`, con el mismo separador
`--> statement-breakpoint` (convención de archivo para tener más de un statement, no sintaxis de
Kysely). Para inspeccionar
la base, un cliente SQLite cualquiera contra `.data/dev.db` — es deuda menor, no bloqueante.

---

# `apps/web/CLAUDE.md`


> Se carga solo al tocar este subárbol. **El flujo de trabajo está en el `CLAUDE.md` de la raíz** y
> no se repite acá: abrir la captura, abrir su fila de M2-D5, transcribir.

TanStack **Router** sobre Vite — **SPA, sin SSR** (D-065) · React 19 · Tailwind v4 · Lucide ·
Vitest+jsdom · Playwright.

### Estado: reconstrucción en curso, por verticales

El front se demolió por baja conformidad (D-064) y se reconstruye superficie por superficie desde
`SPEC-014`. **El número de estado vive en `specs/README.md` y solo ahí** (regla del `README.md`
raíz) — no lo copies acá, se desactualiza. Lo que sí es estable y no rota con cada commit:

| Existe | Qué es |
|---|---|
| `api/port.ts` | Único lugar que hace `fetch`. Cuerpos y filtros se tipan con los `*Input`/`*Query` de `packages/shared`, y `api/port.contract.test.ts` cruza cada método contra `specs/evidencia-m3/2-api/openapi/propnexus.openapi.json` (`SPEC-111`). **Agregar un método a `api` exige su caso en ese test** |
| `auth/*` | `useRoleGuard` implementa los AuthGuard role groups de M2-D1 §7.2 |
| `i18n/*` | Diccionario propio, sin librería. Crece con cada pantalla |
| `routes/` | Rutas reales por rol (`investor.*`, `developer.*`, `notary.*`, `certifier.*`), no stubs — el backlog de `SPEC-014` se cierra vertical por vertical, en el orden `evidencia → certificar → liberar` |
| `styles.css` | **Los tokens de M2-D3** en `@theme` — colores normativos, escala tipográfica, espaciado de 4px, radios, elevación, tamaños de ícono |
| `lib/cn.ts` · `components.json` | Base de shadcn/ui. Los primitivos se agregan **de a uno**, cuando su componente de dominio los necesita |
| `components/domain/` | Los componentes transversales de M2-D3 + los patrones de prueba de M2-D4 (P1–P5, P7, P9, P10 como componentes reutilizables; P6 audit log y P8 dossier llegan con su propia vertical, son superficies enteras) |
| `components/ui/dialog.tsx` | Primitivo de Radix vía shadcn. Adaptado del todo (`SPEC-102`): su botón de cierre usa el `SecondaryButton` de M2-D3 y traduce su texto (`common.close`), y toda la escala es la de M2-D3 (fondo, radio, sombra, espaciado) — ningún consumidor pasa `bg-card` a mano |
| `i18n/format.ts` | `Intl` con el locale activo: moneda, fecha, relativos (regla 14) |

Antes de asumir que una superficie sigue siendo un stub, mirá `routes/` — puede que ya se haya
transcrito. Ver [`specs/SPEC-014`](../../specs/archive/SPEC-014-reconstruccion-del-front.md) para el plan y
`specs/README.md` para qué falta hoy.

### La jerarquía de profundidad, que es lo que hace coherente a la app

M2-D4 §6.1: *"patterns compose, never overlap"*. Cada patrón contesta **una** pregunta y a una
profundidad distinta. Antes de agregar una señal de prueba a una pantalla, ubicá a qué profundidad
va — dos patrones compitiendo por la misma respuesta es redundancia, no rigor.

| Profundidad | Pregunta | Patrón |
|---|---|---|
| 1 | ¿está anclado? | `VerificationBadge` (P1) |
| 2 | ¿cuál hash? (6+4) | `HashChip` (P2) · `StageChips` (P9) |
| 3 | el hash completo, el explorador, la metadata | `TxidModal` (P3) · `AnchoringSuccessModal` (P4) · `MerkleRootProof` (P5) |
| 4 | la historia entera o el artefacto compilado | audit log (P6, `developer.audit-log.tsx`) · dossier (P8, `investor.unit.$unitId.dossier.tsx`) |

**Un solo modal se abre solo:** `AnchoringSuccessModal`, porque el sistema lo emite tras un anclaje
exitoso. Todos los demás los inicia el usuario (M2-D4 §6.3).

### Dos componentes llevan una regla dura adentro

`VerificationBadge` **no acepta un booleano**: recibe el TXID. La regla 17 —nunca mostrar una señal
de prueba que no puedas sustanciar— deja de ser algo que hay que acordarse y pasa a ser la firma del
componente: sin TXID no hay forma de pedirle que diga "Verificado".

`HashChip` recibe el hash **completo** y trunca al mostrar. Pre-truncarlo en la capa de datos rompe
la copia y vuelve inverificable el anclaje (regla 16). Trunca 6+4 **contando el prefijo `0x`**, que
es una contradicción del entregable resuelta en D-069.

### Lo que la captura pide y el contrato no da

Sección viva, **igual que las Trampas**: cuando una captura muestre un dato que no podés sustanciar,
agregalo acá el mismo día.

El criterio no se negocia y es la regla 17 llevada a los datos: **sin dato, no se dibuja**. Nada de
placeholders, nada de derivar un valor parecido para que la pantalla "se vea como la captura". Una
pantalla a la que le falta un campo se nota y se arregla; una que muestra un campo inventado parece
terminada y nadie la vuelve a mirar.

**La deuda se declara en el prop que no se puede llenar**, no en un documento aparte: ahí es donde
la va a leer quien intente usarlo. Esta tabla solo dice dónde está cada una.

| Qué falta | Dónde está declarada | Qué costaría |
|---|---|---|
| Pill de estado del investor (Active / Pending / Completed) | `InvestorCard` prop `status` | Contrato: `investorDirectoryEntrySchema` no expone `status`, y el endpoint hace `innerJoin Contract` |
| Fila de StatCards Active / Pending / Completed en `/developer/investors` | misma deuda: no hay `status` por investor del que agregar | Contrato: sin el campo no hay conteo que no sea inventado |
| ~~Nombre de la organización ("Grupo Alpine")~~ | — | **Cerrado 2026-09-21 (SPEC-220)**: migración `0010` creó `Organization` + `Project.organizationId`. El perfil del desarrollador lo pasa; el listado y el detalle de obra todavía no (no traen la organización en su contrato) |
| "Price from" en el listado del investor | `ProjectCard` prop `priceLabel` | Endpoint: `GET /projects` no agrega el mínimo de las unidades. `GET /developer/projects` **ya lo hace** — es copiar esa agregación |
| Rating / reputación del developer (capturas 6-7, 59-60) | detalle `/project/:id` y `/project/:id/developer` — no hay estrellas | **No se construye, es una decisión (D-094)**: un rating es una afirmación sobre la calidad de un tercero y D-026 limita la plataforma a cuatro afirmaciones sobre documentos y atestaciones. La pantalla de las capturas 59-60 **sí** se construyó (SPEC-220), sin el pill |
| KPI "Active investors" y "Verified events" del panel (capturas 33/34) | `developer.index.tsx` — no hay tile | Contrato: `developerKpisSchema` no los expone |
| `DocumentCard` completo (nombre, fecha, formato) en los artefactos del dossier (investor y notary) | `investor.unit.$unitId.dossier.tsx` y `notary.dossier.$dossierId.tsx` — la lista de artefactos solo tiene label + hash + `VerificationBadge` | Contrato: `dossierArtifactSchema` solo tiene `kind`, `referenceId`, `label`, `sha256`, `txid` — sin `filename`/`uploadedAt`/`format` no hay nada real que ponerle a `DocumentCard` |
| Miniatura por etapa en "Stage Detail" (captura 45: una foto de obra junto a cada fila) | `developer.progress.tsx`, bloque "Stage Detail" (`M3 §2.2`) — la fila es texto + `StatusPill`, sin imagen | Endpoint: `developerProgressItemSchema` no trae ninguna referencia a evidencia; haría falta un `join` a la primera `Evidence` `photo` del stage (mismo patrón que `fotosPorStage` en `project.$projectId.progress.tsx`, que hoy solo cuenta, no expone URL) |

**Fijate si el dato existe antes de declararlo ausente.** El "Price from" se declaró ausente y no lo
estaba: el precio existe en `UnitTable.priceMinorUnits`, solo que a nivel unidad. Eso convirtió una
supuesta migración en un `min()` en la query, y se resolvió el mismo día para el listado del
developer. Son deudas MUY distintas y la diferencia solo aparece si mirás el esquema.

### Los tokens no se tocan a mano

`src/styles.test.ts` lee **el entregable** —no una copia— y verifica que los 20 colores normativos
de M2-D3 §Visual Language estén en `styles.css`, uno por uno. Es el mismo patrón que el valor dorado
de `contracts/`: si alguien ajusta un tono "para que quede mejor", el test se pone rojo.

**Regla de uso:** ningún componente escribe un color, tamaño, radio o sombra literal. Si hace falta
algo que no está en los tokens, no se inventa — se busca en M2-D3, y si tampoco está, es una decisión.

**Biome necesita `css.parser.tailwindDirectives`** para parsear `@theme`: Tailwind v4 declara los
tokens dentro del CSS y no hay `tailwind.config.js`. Sin esa opción aborta el formateo del archivo
entero, con un error que no menciona `@theme`.

**Un stub no es una pantalla a medias.** Se ve como lo que es y no compite con la captura: una
pantalla inventada parece terminada y nadie la vuelve a mirar.

### El header es uno (D-074)

`PanelLayout` pinta **siempre** el `GradientHeader` completo. La pantalla no elige piezas:

- Logo PropNexus a la izquierda. No se oculta.
- Campana, perfil e idioma a la derecha. No se opt-in por ruta.
- Si la pantalla tiene padre, pasa `back`. La flecha queda **entre** el logo y el título.

Login no usa `PanelLayout`: ahí solo va el toggle de idioma (M2-D3 §LanguageToggle).

Si una captura del developer omite el logo (46, 48, 35) o las utilidades (casi todas), gana D-074,
no la captura. No reintroducir un `hideBrand`.

### Específico de este frente

- **Mobile-first de verdad**: la captura es un teléfono de ~380px. El desktop es la adaptación, no
  al revés (M2-D3 §Principio 4).
- **Los strings en español son 20-30% más largos que en inglés** (M2-D3 §Text growth):
  dimensioná al contenido, nada de anchos fijos salvo FAB e íconos.
- **La clave de `localStorage` del idioma es `propnexus.lang`**, literal (M2-D3 §Localization).
- **Los puertos salen de `ports.ts`**, que los lee de `apps/web/.env` y por defecto da 3000/8787.
- **En dev, `/api` va por el proxy de Vite** a `API_ORIGIN`. En producción el web es estático y vive
  en otro origen: la URL absoluta sale de `VITE_API_ORIGIN` y la API la acepta por su lista blanca
  de CORS (D-065). Si en producción no responde nada y la consola dice CORS, falta `WEB_ORIGIN` del
  otro lado — ver `specs/RUNBOOK-deploy.md`.

### Trampas verificadas

- **2026-09-30 · un mapa de Leaflet en la página tapaba los diálogos, y los diálogos anchos medían
  512px.** Dos causas, vistas grabando el video contra producción. (1) Leaflet les da a sus capas
  `z-index` de 400 a 1000; sin un contexto de apilamiento propio, la miniatura del detalle de obra y
  de unidad quedaba **encima** del diálogo (`z-50`) que ella misma abre, y los pines de "Buy" encima
  del popover. **Fix:** `isolate` en todas las variantes de `LocationMapModal`. (2) El primitivo
  `dialog.tsx` trae `sm:max-w-lg`, y `twMerge` **no** lo pisa con un `max-w-*` sin variante: un
  `DialogContent className="max-w-3xl"` quedaba en 512px desde 640px de ancho. **Un diálogo que
  necesite otro ancho lo pide en `sm:`** (hoy: mapa, galería y visor de documentos).

- **2026-09-28 · el pin de Leaflet salía como imagen rota en producción.** El `L.Icon.Default` arma la
  URL de `marker-icon.png` desde la ruta de su propio CSS, y Vite no publica esa carpeta: se veía un
  recuadrito con el texto "Marker". Los tests no lo ven (el Leaflet falso no carga imágenes); se vio
  en una captura contra producción. **Fix:** `usarIconoPublicado` en `LocationMapModal` importa las
  tres imágenes como assets (Vite las publica con hash) y se las pasa con `mergeOptions`.
- **2026-09-28 · dos `import()` concurrentes de un módulo con `vi.mock` dan dos instancias
  distintas.** Con `vi.mock('leaflet', () => import('#/test/leaflet-falso'))`, si `LocationMapModal`
  cambia de props mientras la primera importación dinámica sigue pendiente, la segunda resuelve a
  **otra** instancia del Leaflet falso: el mapa se crea, pero sobre un `L.map` que el test no mira, y el
  test concluye que no hubo mapa. Medido: `a.map === b.map` da `false`. En el navegador los módulos ES
  son únicos, así que es un artefacto del test, no del componente. **Montá el mapa con un solo render**
  (no re-renderices con otras props antes de que exista el mapa) o esperá a que exista antes de cambiar.
- **2026-09-28 · `LocationMapModal` (variante `modal`) abría vacío, y era real.** El `<div>` del mapa
  vive dentro del portal de Radix, que se monta un render después de que el diálogo abre: con un
  `useRef`, el efecto que crea el mapa corría con el contenedor en `null` y no volvía a correr. Nadie
  lo había visto porque ninguna obra tenía coordenadas; confirmado en producción con Playwright (cero
  `.leaflet-container` en el modal de `project.$projectId.index`). **Fix:** el contenedor es estado
  (`ref={setContenedor}`), así que montarlo re-dispara el efecto. De paso, el modo mapa de "Buy"
  mostraba 1 pin de 3: emitía el `bbox` al crear el mapa, con zoom de calle sobre el primer pin, y el
  listado se filtraba a esa obra antes del encuadre. Ahora el `bbox` sale con el primer `moveend`.
  Ver D-097.
- **2026-09-20 · el front no puede importar VALORES de `@plataforma/shared` por el índice, y por qué se
  ve tarde.** `shared` se compila a **CommonJS** (`dist/`) y el front solo había importado *tipos* de
  ahí. El día que `SPEC-218` necesitó valores (tipos permitidos, topes, detección por magic bytes) el
  typecheck y **los tests de vitest pasaron**, pero el navegador tiró *"The requested module
  '…/packages/shared/dist/evidence-rules.js' does not provide an export named …"* — Vite dev sirve el
  archivo crudo y un `exports.X =` de CJS no es un módulo ES. Lo cazó el e2e, no los unitarios. Además el
  índice arrastraría **Zod y los 30 archivos de schemas** al bundle (CJS no se tree-shakea).
  **La regla:** lo que el front necesite como valor va en un módulo de `shared` **sin ninguna
  dependencia** y se importa por su propia entrada, que apunta al **fuente `.ts`** (que Vite sí
  transforma), no a `dist`: hoy `@plataforma/shared/evidence-rules` (`packages/shared/package.json`
  `exports`). El resto de `shared` sigue siendo solo tipos (`import type`).

- **2026-09-19 · `styles.test.ts` no tiene un número de tests estable, y no es una regresión de
  ningún commit.** Corriéndolo solo (`pnpm --filter web test -- styles.test`) da un número; corriendo
  la suite completa da otro; y varía entre corridas del mismo comando sin tocar nada. Confirmado
  contra el código **sin modificar** con `git stash` — la inestabilidad ya estaba ahí, no la causó
  SPEC-108 (que fue cuando se notó, al comparar el total de la suite entre dos commits). El archivo
  genera sus tests con `it.each` sobre listas que arma parseando `docs/M2-D3-...md` en tiempo de
  colección (`coloresNormativos()` y análogas para tamaños de ícono y espaciado) — la sospecha es
  alguna dependencia de orden de ejecución entre archivos de test en el mismo worker de Vitest
  (un regex con estado global, o algo similar), pero no se investigó a fondo: **cero tests fallan
  en ninguna corrida**, solo cambia cuántos se coleccionan, así que no bloqueó nada y quedó fuera de
  alcance de la spec que lo encontró. Si alguna vez este archivo empieza a fallar de verdad (no solo
  a variar en cantidad), esto es el primer lugar donde mirar.

- **2026-09-09 · el `VerificationBadge` del detalle de etapa mostraba el TXID de la transición
  equivocada.** `stage.events.find(e => e.eventType === 'STAGE_TRANSITION' && e.txid)` devuelve la
  **primera**, y `GET /projects/:id/stages/:stageId` ordena por `eventIndex asc`. En un stage que
  recorrió la FSM entera —`Pending → InProgress → Observed → InProgress → Completed`— eso es el
  arranque, no el cierre: la píldora "Verificado" quedaba al lado de `certifiedAt` sustentada por
  el TXID de una transición a **otro estado**.
  **Verificado contra producción, no deducido:** "Terminaciones" de `torre-a` tiene `1` =
  `Pending → InProgress` (`b28eb6cf…`) y `5` = `InProgress → Completed` (`e842c8ac…`); la pantalla
  mostraba el primero. Es M2-D4 §6.2 en su forma más literal —*"the system never displays a proof
  signal that cannot be substantiated"*— porque Depth 1 contesta "¿esto está anclado?" sobre el
  estado **actual**.
  **Fix:** `anclajeVigenteDelStage` en `lib/investor.ts` (la última transición anclada, no la
  primera), con tests en `lib/investor.test.ts`. Vive como helper puro y no inline en la ruta
  porque las rutas de TanStack no se testean unitariamente acá — mismo criterio que
  `unicosPorStageId`, que nació del mismo tipo de rareza en la forma de los datos.
  **La lección:** `.find()` sobre una lista ordenada ascendente devuelve lo más **viejo**. Cada vez
  que un componente elija "el evento" de una entidad que tiene historia, preguntá si quiere el
  primero o el último — y si la respuesta es "el que corresponde al estado actual", nunca es el
  primero.

- **2026-09-09 · dos acciones del hilo de estados no tenían clave de traducción, así que el audit
  log las mostraba en crudo.** `CHANGE_STAGE_STATE` y `STAGE_WORK_INITIATED` no estaban en
  `dictionary.ts`; `t()` devuelve `undefined` para una clave ausente y el `?? e.action` de
  `developer.audit-log.tsx` caía al literal en mayúsculas. Justo las **dos transiciones que entran
  a `InProgress`** (D-020: el auto-avance al subir la primera evidencia y el "Reanudar etapa"),
  o sea la mitad del hilo, ilegible en la superficie que M2-D4 §Pattern 6 designa como su casa
  —*"if a stage is re-anchored (e.g. after a remediation), the original anchor event remains; a new
  event is appended"*—. Confirmado en producción: `AuditLog` tiene 2 filas `CHANGE_STAGE_STATE` y
  1 `STAGE_WORK_INITIATED`, todas con `entityType = Stage`, que `auditScope` sí mapea.
  **Quedan ~20 acciones más sin clave** (`ACCEPT_INVITATION`, `RELEASE_PAYMENT`, `CREATE_UNIT`, …).
  No se agregaron acá a propósito: son otra tarea y no son el hilo. Las de `entityType = User`
  (`LOGIN`, `CREATE_USER`, `UPDATE_PROFILE`) **nunca** se ven, porque `auditScope` deja `User`
  afuera por diseño.
  **Nada que agregar en la pantalla de la etapa, y esto es lo importante:** M2-D4 §6.1 dice que los
  patrones no se superponen y que la **historia entera es Depth 4** (P6/P8). El detalle de etapa es
  Depth 1/2/3. Poner ahí un historial de eventos sería mostrar el mismo material de prueba dos
  veces en la misma pantalla, que es exactamente lo que §6.1 prohíbe. **Si el hilo no se lee, se
  arregla el audit log, no la pantalla de la etapa.**

- **2026-09-04 · `PanelLayout` no tenía `max-width`, y en desktop el `aspect-video` de `ProjectCard`
  escalaba con el viewport.** Sin límite de ancho, cada card medía más de 1000px de alto —
  `1502×1034px` medido en un viewport de 1534px— y una lista con proyectos reales (`/developer/projects`
  con 2 proyectos) se veía vacía sin scrollear una enormidad: solo entraba en pantalla el ícono
  "sin imagen" de la primera card. **No lo encontró un test** — la suite no verifica layout en
  viewports anchos — sino probar el flujo real contra producción con Claude en Chrome: crear un
  proyecto nuevo y volver a `/developer/projects`. `get_page_text` (que prioriza un solo `<article>`)
  hizo parecer al principio que faltaba un proyecto entero; la causa real apareció recién midiendo
  `getBoundingClientRect()` de los dos `<article>` — ambos estaban en el DOM, ambos con texto
  correcto, solo que gigantes.
  **Fix (commit `0428f13`):** `max-w-2xl mx-auto` en el `<main>` de `PanelLayout` y en el contenido
  interno de `GradientHeader` (que antes también se estiraba a todo el ancho) — mismo patrón que ya
  usaban `login.tsx` (`max-w-md`) y `public.dossier.$shareToken.tsx` (`max-w-lg`), que nunca se
  llevó a `PanelLayout`.
  **Lo que destapó y sigue sin cerrar:** `BottomNav` tiene `md:hidden` (se oculta a partir de
  768px) pero no existe ningún componente que lo reemplace en desktop — verificado a mano en el
  navegador (`getComputedStyle(nav).display === "none"` a 1534px) y buscando `Sidebar`/`SideNav`/
  `DesktopNav` bajo cualquier nombre en `components/domain/`: no hay ninguno, no es un componente
  desconectado. M2-D3 Principio 4 ("desktop swaps BottomNav for a left sidebar and adds columns")
  lo pide, y `M2-D2` captura 61 (`61-DESKTOP-HOME.png`) lo muestra — pero es la única captura de
  desktop en todo el catálogo y es del panel de investor, sin equivalente para developer/notary/
  certifier. Queda en la tabla de pendientes de `CLAUDE.md` raíz (#1) para una sesión aparte: toca
  las 4 superficies de rol porque `PanelLayout` es compartido.
- **Un `*.test.tsx` dentro de `src/routes/`** lo escanea el generador de rutas y avisa "does not
  export a Route": prefijalo con `-` o configurá `routeFileIgnorePattern`. Y `vitest` excluye `e2e/`
  explícitamente porque su `include` por defecto matchea `spec` además de `test`.
- **Los tests E2E esperan que React monte, no que exista el DOM.** Con formularios controlados, un
  click antes del montaje hace submit nativo, nunca corre el `preventDefault` y la página recarga
  sin llamar a la API. Falla intermitente que parece de backend. Ver `waitForHydration` en
  `e2e/walkthrough.spec.ts` — sigue aplicando como SPA: cambió *cuándo* monta React, no *que* haya
  que esperarlo.
- **`test.fail()` a nivel `describe` aplica a todos los tests que siguen.** Para marcar uno suelto va
  **dentro** del cuerpo. Puesto afuera hizo fallar los 16.
- **Usá selectores accesibles** (`getByLabel`, `getByRole`): fallan cuando la accesibilidad está mal,
  que es justo lo que querés. Así se descubrió que los `<label>` del login no tenían `htmlFor`.
- **2026-08-21 · Cuidado con clases utilitarias que colisionen con CSS propio.** El `styles.css`
  legado definía `.hidden { display: none !important }` y ganaba siempre sobre la variante
  responsive de Tailwind: `hidden md:flex` quedaba oculto en **todos** los viewports. Se fue con el
  archivo, pero la lección queda para cuando entren los tokens: **si escribís una regla con el
  nombre de una utilidad de Tailwind, vas a pelear con el orden del archivo.**
- **2026-08-28 · `Link` de TanStack Router pinta activo por prefijo.** `activeOptions.exact`
  vale `false` por defecto: un tab a `/developer` queda activo en `/developer/capital`. En el
  BottomNav, el tab índice pide `exact` si algún hermano cuelga de su path. No es CSS ni estado
  local. El investor no lo padece: su primer tab es `/investor/menu`.

### Comandos

```bash
pnpm --filter web dev             # SPA en :3000, con proxy a la API
pnpm --filter web test            # vitest
pnpm --filter web build           # dist/ — lo que se publica como static site
pnpm --filter web e2e:ui          # playwright interactivo
pnpm --filter web e2e:report      # reporte HTML de la última corrida
pnpm --filter web test:a11y       # la suite de vitest con axe después de cada test (SPEC-112)
pnpm --filter web e2e a11y        # axe en el navegador real, 12 superficies × mobile/desktop
```

**Accesibilidad: una violación conocida se registra, no se silencia.** Las dos capas de axe leen
`a11y/hallazgos.ts`: cada fila es regla + patrón de HTML + **la spec que la cierra**. Lo que no
esté ahí pone la capa en rojo. Si arreglás un hallazgo, **borrá su fila en el mismo commit**: una
fila que queda deja de proteger contra la regresión de lo que arreglaste. `test:a11y` no está en
`pnpm verify` ni en CI a propósito (SPEC-112 §Invariantes: ninguna capa bloquea hoy).

**Los E2E entran con la password del seed, no con la del prefill.** `e2e/_credenciales.ts` la resuelve
igual que `passwordDeDemo` del seed: `SEED_DEMO_PASSWORD` / `SEED_ADMIN_PASSWORD` del entorno o de
`apps/api/.env`, y si no están, los defaults locales. La solapa de `/login` (`ROLE_PRESETS`) precarga
solo el usuario —nunca la contraseña, que depende del entorno—, así que nunca escribas una password
literal en un spec ni en el front.

**Si los E2E locales fallan en masa y en CI pasan, es la `dev.db`, no los specs.** CI migra y siembra
una base nueva en cada corrida; la local arrastra estado. Pasó el 2026-10-01 con 43 fallos: a la base
le faltaba `0012_project_cover.sql` (`/developer/projects` fallaba y la pantalla decía "0 proyectos")
y sus passwords eran anteriores a `SEED_DEMO_PASSWORD` en `apps/api/.env` (401 en el login de los
specs). Lo primero ya no pasa: `pnpm dev` migra la base local antes de arrancar. Lo segundo se arregla
con `pnpm db:seed`.

---

# `packages/cardano/CLAUDE.md`


> Se carga solo al tocar este subárbol. Lo transversal está en el `CLAUDE.md` de la raíz;
> el plan de las tres rebanadas, en `specs/archive/SPEC-013-anchorport.md`.

**Es la única puerta a Cardano** (D-014). Nada fuera de acá importa Lucid ni Blockfrost; la API pide
el puerto y no sabe que la cadena existe.

```
port.ts        la interfaz: openThread · advanceThread · verify · awaitConfirmation
ledger.ts      LedgerStore — el estado del simulador (memoria o SQLite)
simulated.ts   adaptador simulado: rechaza lo mismo que rechazaría el validador
real.ts        LucidAnchorAdapter: construye las transacciones de verdad
codec.ts       StageDatum ⇄ Data de Plutus — el contrato binario con contracts/
blueprint.ts   carga plutus.json, aplica el admin, deriva dirección y policy
factory.ts     createAnchorPort(): ANCHOR_MODE, sin defaults inseguros
```

### El valor dorado, y por qué existe

`codec.test.ts` compara el CBOR contra un hex fijo. **Ese mismo hex está fijado del otro lado**, en
`contracts/lib/propnexus/fsm.ak` (`t_golden_datum_encoding`), sobre el mismo datum. Sale de correr
el test en Aiken con un valor cualquiera y leer lo que el error dice que esperaba.

Es la única defensa real contra el modo de falla más caro de esta rebanada: **un campo corrido o un
índice de constructor equivocado pasa el typecheck, pasa los tests de lógica, y falla recién en la
cadena** — después de firmar y pagar el fee, con un mensaje que no dice nada. Si tocás `StageDatum`
en cualquiera de los dos lados, los dos tests se ponen rojos. Es a propósito.

Índices que **no son libres** (salen del orden de declaración en Aiken):

| Tipo | Índices |
|---|---|
| `StageState` | `Pending`=0 · `InProgress`=1 · `Observed`=2 · `Completed`=3 |
| `Bool` | `False`=0 · `True`=1 (convención de Plutus) |
| `Option` | `Some`=0 · `None`=1 |
| `StageDatum`, `Completion`, `Advance`, `Init` | constructor 0, campos en orden |

### Trampas

- **2026-08-23 · `auto-install-peers=false` + `strict-peer-dependencies=false` = un `instanceof`
  que revienta en runtime.** Lucid trae los `@harmoniclabs/*` como **peers**, y este repo no
  instala peers automáticamente a propósito (D-052: con `true` arrastraba Prisma y Drizzle vía un
  peer opcional de Nitro). O sea que hay que declararlos a mano — y **a la versión que el dependent
  pide**, que nadie verifica: `pnpm add @harmoniclabs/cbor` trae la 2.x, `uplc@1.4.1` pide `^1.3.0`,
  y el síntoma es `TypeError: Right-hand side of 'instanceof' is not an object` en el encoder,
  a diez frames de profundidad, sin ninguna señal en el typecheck. **Antes de agregar un peer a
  mano, mirá el rango que declara quien lo necesita** (`peerDependencies` de su `package.json`).
- **2026-08-23 · Copias con peers distintos rompen `instanceof` aunque la versión sea la misma.**
  Agregar peers de a uno deja variantes viejas en `node_modules/.pnpm` y dos clases "iguales" de
  archivos distintos nunca son `instanceof`. Si el error persiste después de arreglar versiones:
  `rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install`.
- **2026-08-23 · El warning `The "pnpm" field in package.json is no longer read`** sale en cada
  comando: el `overrides` de la raíz (`@types/express`) está siendo **ignorado**. Hoy no rompe nada
  porque `apps/api` ya declara `^5.0.6` directo, pero el override no está haciendo lo que parece.
- **2026-09-01 · El `Emulator` no ve su propio mempool, y eso es una ventaja.** `getUtxos()` lee
  solo el ledger, así que un anclaje sin `emulator.awaitBlock(1)` detrás reproduce **exactamente**
  la condición de Preprod: un proveedor que todavía no vio la transacción anterior. Los tests de la
  cola dependen de eso. Si alguna vez agregás un `awaitBlock` "para que pase", lo que estás haciendo
  es apagar el test.
- **La dirección del script depende del `admin`.** Rotar la wallet de servicio cambia la dirección,
  así que **no se puede rotar sin migrar todos los hilos**. Saberlo antes de generar la clave.
- **2026-08-31 · `fromSeed` y `fromPrivateKey` dan direcciones distintas para la misma clave.**
  `fromSeed` arma una dirección **base** (pago + staking, `addr_test1q…`); `fromPrivateKey` solo sabe
  armar una **enterprise** (`addr_test1v…`, `CML.EnterpriseAddress.new`). El *payment credential* —y
  por lo tanto el admin del validador— es **el mismo** en las dos, así que la clave puede gastar los
  UTxOs de las dos; lo que cambia es dónde los **busca** Lucid. Costó un rodeo entero: se fondeó la
  base con el faucet y al pasar a clave de pago (D-078) la wallet miraba la enterprise, vacía. **El
  faucet pide una dirección, no una clave: pedile la que el servicio va a usar de verdad.**

### El simulador es su propia cadena, y solo habla de ella

`confirmedAt(txid)` contesta desde el registro de lo que **él mismo ancló**, y da `null` para
cualquier otro txid (D-079). Antes devolvía `now()` para todo, o sea que afirmaba confirmación sobre
transacciones ajenas.

**El punto general, que vale para el adaptador real también:** tener un txid no es tener una
confirmación. El txid es el hash del cuerpo de la transacción y existe antes de enviarla; un submit
exitoso solo dice que el nodo la aceptó en su mempool. Por eso `openThread`/`advanceThread` devuelven
`Pending` con txid y la promoción a `Confirmed` la hace `confirmedAt()` (D-077).

**Esta frase era cierta para `real.ts` y falsa para `simulated.ts` hasta el 2026-09-03.** El
simulador devolvía `Confirmed` directo desde `commit()`/`anchorCommitment()` — la "Defensa 3" que
quedó pendiente del incidente del 2026-08-31 (ver `DECISIONS.md` D-087). Ahora los dos adaptadores
declaran `Pending` siempre; que el simulador **conozca** el txid al toque (`confirmedAt`/`verify`
sin esperar nada, la propiedad de arriba) sigue siendo cierto y sigue siendo lo que lo hace barato
para tests — la diferencia es que ahora nadie se entera de la confirmación sin preguntar
explícitamente, con los dos adaptadores.

### Un anclaje por vez, y el adaptador se acuerda de lo que envió

`LucidAnchorAdapter` serializa todas sus transacciones en una cola en memoria y, después de cada
envío, se queda con lo que acaba de crear: el vuelto de la wallet (`overrideUTxOs()`) y las salidas
al script, que `advanceThread` consulta **antes** que al proveedor. La vista vence a los 3 minutos
(`PENDING_UTXO_TTL_MS`). El porqué completo está en D-082; acá, lo que hay que tener presente al
tocar el archivo:

- **Se construye con `chain()`, no con `complete()`.** Es la misma transacción; `complete()` es
  `chain()` tirando dos de los tres valores. Si volvés a `complete()`, el encadenamiento desaparece
  sin que nada se ponga rojo hasta que haya dos anclajes seguidos.
- **La vista se vence en `enCola()`, antes del trabajo.** El primero que la lee es `utxoAt()`, que
  corre antes de construir nada: vencerla dentro de `enviar()` llega tarde.
- **La cola guarda una promesa que nunca rechaza.** Guardar el turno a secas deja un rechazo sin
  manejar —que en Node mata el proceso— aunque quien llamó lo haya atrapado.
- **Vale para un proceso.** Render corre una instancia; con dos, esto no alcanza.

### El validador viaja por referencia, si está publicado

El validador son 2289 bytes. Hasta el 2026-09-01 viajaban adentro de **cada** transacción de hilo;
ahora, si existe un UTxO que lo lleva, se lo referencia con `readFrom` (D-083). Medido: un
`openThread` pasa de 2890 a 599 bytes y de 0,2976 a 0,2317 tADA.

```bash
BLOCKFROST_API_KEY=… SERVICE_WALLET_PRIVATE_KEY=… \
  pnpm --filter @plataforma/cardano ref:publish    # una vez por red, idempotente
```

- **Vive en la dirección de la wallet**, no en la del script: ahí sería inmune a la selección de
  monedas pero también irrecuperable —los ~11 ADA del mínimo quedarían muertos—.
- **Y por eso hay que filtrarlo a mano.** Para la selección de monedas es plata. El error de Lucid
  dice que excluye los UTxOs con script, y en 0.6.2 **solo excluye los que la transacción declaró
  con `readFrom`**: un anclaje por metadata no declara ninguno y se lo lleva puesto. Lo filtra
  `entradasDeLaWallet()`, que es el único lugar por el que pasan todas.
- **Se descubre al arrancar**, comparando el hash del script. Publicar con la API arriba no la
  cambia: hay que reiniciarla.
- **`null` es un estado legítimo**: sin reference script, el adaptador adjunta el validador y todo
  funciona igual, más caro. Los tres primeros tests de `yaci.test.ts` corren así a propósito.
- **Los dos caminos están probados contra un nodo de verdad.** El test del reference script va
  **último** en `yaci.test.ts` porque publicar muta el adaptador: los de arriba cubren el validador
  adjunto y el de abajo el referenciado, que es la diferencia que existe en producción según haya o
  no un UTxO publicado.

### El puerto declara su red, y por eso la fila puede ser honesta

`AnchorPort.network` dice contra qué ledger resuelven los TXID que produce: `Preprod`, `Mainnet`,
`Custom`, o `Simulated` para el simulador —que es su propia cadena y sus TXID resuelven contra
`SimulatedLedgerUtxo`—. `disabled` devuelve `null`: no produce ninguno.

**Sale del puerto y no de `CARDANO_NETWORK`.** El env es lo que se *pidió*; el puerto es lo que se
*construyó*. Si la API lee el entorno al insertar la fila, los dos se pueden desincronizar en
silencio y la columna termina afirmando una red contra la que ese TXID no existe — exactamente lo
que la columna existe para impedir (D-080). Lo cubre un test que pone `CARDANO_NETWORK=Preprod` con
el puerto en `simulated` y exige que la fila diga `Simulated`.

**No es la columna `anchorMode` que D-080 rechazó.** Aquella registraba qué adaptador corrió; esta
registra contra qué ledger se resuelve un TXID. Que correlacionen es incidental.

### El adaptador real es agnóstico del provider, y eso no es cosmético

`LucidAnchorAdapter` recibe una instancia de Lucid ya configurada, así que **el mismo código** corre
contra el `Emulator` (en proceso, en CI), contra yaci-devkit (nodo local) y contra Preprod. Si
hiciera falta cambiar una línea al pasar de uno a otro, lo que prueba el CI no sería lo que corre
desplegado.

El `admin` **no se configura**: se deriva de la wallet de la instancia. Configurarlo aparte
permitiría que la firma y la dirección del script se desincronicen, y el síntoma sería hablarle a
una dirección donde no hay ningún hilo — sin error, solo silencio.

**Los tests del `Emulator` ejecutan el validador de verdad.** Un rechazo ahí es el mismo rechazo que
daría la cadena. Por eso exigen `/failed script execution/` y no un `toThrow()` pelado: sin el
regex, el test pasaría también si la transacción fallara por una razón nuestra —un UTxO que no
está, plata que no alcanza— y estaría diciendo que el validador rechazó algo que nunca evaluó.

### El devnet local, y las tres cosas que costaron

`compose.dev.yml` levanta yaci-devkit: un Cardano de verdad con bloques de 1 segundo. El mismo
adaptador que corre contra el `Emulator` corre contra él sin tocar una línea — cambia el provider.

1. **La imagen `latest` no sirve**: quedó en enero de 2024 y reporta `protocol_major_ver: 8`
   (Babbage), que **no ejecuta Plutus V3**. Por eso está pineada en `0.10.6`, que da Conway
   (`protocol_major_ver: 10`) con cost models de V3.
2. **Su entrypoint está roto**: invoca con `sh` un script que usa `==` de bash, y el contenedor
   muere con `unexpected operator`. Se puentea con `entrypoint: ["bash", "/app/yaci-cli.sh"]`.
3. **Provider Kupmios, no Blockfrost.** El provider Blockfrost de Lucid 0.6 lee `cost_models_raw`,
   un campo que la API agregó después y que yaci-store todavía no devuelve (`Cannot read properties
   of undefined (reading 'PlutusV1')`). Ogmios entrega los parámetros nativos. En Preprod se usa
   Blockfrost, que sí lo trae, y el adaptador no se entera.

4. **Tarda ~5 minutos en estar listo, y miente mientras tanto.** Ogmios (1337) y Kupo (1442)
   contestan casi enseguida, pero **yaci-store (8080) es un Spring Boot** que sigue arrancando. En
   el medio los logs escupen `Java command not found in the provided JRE folder` — **es ruido**:
   cae a `java` del PATH (`/opt/java/openjdk`) y arranca igual. La señal buena es
   `[OK] Yaci Store Started`, o un 200 en `curl localhost:8080/api/v1/blocks/latest`.
   **Esa espera ya no es tuya**: `vitest.devnet.mts` levanta el devnet, aguanta hasta 8 minutos a
   que `/blocks/latest` conteste, y lo baja al terminar. Solo apaga lo que prendió — si el devnet
   ya estaba arriba, lo usa y lo deja. El teardown corre aunque los tests fallen, que es justo
   cuando uno se olvidaría de limpiar.
5. **`docker compose stop yaci` termina con exit 137, y no es un error.** La imagen no maneja
   `SIGTERM`, así que compose la mata con `SIGKILL` después del timeout. No hay estado que perder:
   el devnet se regenera entero en el próximo arranque.

Y dos fricciones del devnet que quedaron documentadas en el propio test: los cost models vienen con
el i64 máximo, que al pasar por un `number` se redondea fuera de rango y CML rechaza; y la **ventana
de validez no puede pasar el safe zone de la era** (`PastHorizon`), que en un devnet son 300
segundos — de ahí que `VALIDITY_WINDOW_MS` sean 3 minutos y no 10.

### Estado

Rebanadas **A** (puerto + simulador) y **B** (códec, blueprint, `Emulator` y **devnet local**)
cerradas. Desde el 2026-08-27 `factory.ts` **cablea el adaptador real**: `ANCHOR_MODE=real` levanta
Lucid contra Blockfrost, selecciona la wallet desde `SERVICE_WALLET_PRIVATE_KEY` y arma el
`LucidAnchorAdapter`. Mainnet se rechaza ahí mismo (D-013).

Hasta entonces se decía que "Preprod no cambia el código, solo el provider y la seed", y era
inexacto: el adaptador no cambiaba, pero **nadie lo construía** — pedir `real` tiraba un error que
remitía a esta misma rebanada. Ahora sí: lo que falta para Preprod es la cuenta de Blockfrost y una
wallet fondeada, nada de código.

Desde el 2026-09-01 el adaptador **referencia** el validador en vez de adjuntarlo cuando está
publicado (D-083), y **encadena**: dos anclajes dentro del mismo bloque ya no chocan por
el UTxO único de la wallet, y el hilo se puede avanzar sin esperar a que el bloque publique el
`openThread` (D-082).

De la rebanada **C** está lo mínimo: `confirmedAt(txid)` en el puerto, que responde con el POSIX ms
del bloque o `null`. **Existe porque `verify()` no servía**: devuelve un `AnchorProof`, que exige
`outputRef` y `datum` —cosas de un anclaje **con hilo**—, así que para uno por metadata daba `null`,
indistinguible de "no confirmó". Queda el `reconcile()`/`verify()` completo, que necesita un
indexer.

### Comandos

```bash
pnpm --filter @plataforma/cardano test        # códec, blueprint, simulador y Emulator
pnpm --filter @plataforma/cardano ref:publish # publica el validador como reference script (🟡)
pnpm --filter @plataforma/cardano test:yaci   # el flujo completo contra el devnet
docker compose -f compose.dev.yml up -d       # solo si querés dejarlo levantado entre corridas
```

`test:yaci` **no corre en CI** (el CI no levanta infraestructura) y está excluido del `test` normal.
Se corre a mano, con el compose arriba.

---

# `packages/shared/CLAUDE.md`


> Se carga solo al tocar este subárbol.

Zod + los tipos inferidos. Todo lo que cruza la frontera entre `apps/api` y `apps/web` se
declara **una sola vez acá** (D-012, regla 6). Es lo único que vuelve el drift API↔web
*imposible* en vez de meramente prohibido: si una respuesta cambia de forma y el schema no,
falla el typecheck de los dos lados. Verificado.

### Cómo agregar un contrato

1. El schema va acá **antes** que el endpoint.
2. Exportá el schema *y* el tipo inferido; re-exportá desde `src/index.ts`.
3. La API valida con `safeParse` y **tipa la respuesta** con el tipo inferido — ese tipado es lo
   que impide que un campo nuevo del modelo se filtre por un spread distraído.
4. El front importa **solo tipos** (`import type`): no carga Zod en runtime.
5. Un test por cada regla que el schema defiende.

### Resolución: por qué está armado así

Tres consumidores con necesidades distintas, y la respuesta no es la misma para los tres:

| Quién | Resuelve a | Por qué |
|---|---|---|
| typecheck de api y web | `dist/index.d.ts` (`types`) | Un `.d.ts` **nunca se emite**, así que no cae bajo el `rootDir` del consumidor — que es el error que da apuntar al fuente |
| runtime de la API (CJS) | `dist/index.js` (`main`) | La API es CommonJS y lo carga con `require()` |
| tests de la API | **el fuente**, por alias en `vitest.config.mts` | Ni compilar antes de testear, ni riesgo de testear contra un `dist` viejo |
| runtime del front | nada | Importa solo tipos; `verbatimModuleSyntax` los borra |

**`pnpm typecheck` reconstruye este package antes de verificar.** No es ceremonia: verificar
contra un `dist` viejo es un verde falso, que es peor que un rojo. `prepare` lo compila también
en cada `pnpm install`, para que un clone fresco pueda correr `pnpm dev` sin pasos extra.

### Trampas

- **`.strict()` no es decorativo.** Sin él, Zod **descarta** las claves desconocidas en silencio:
  un `passwordHash` filtrado pasaría el schema sin que nadie se entere. Con `.strict()`, falla.
  Todo schema de respuesta va estricto.
- **Las fechas viajan como string ISO en UTC** (`z.string().datetime()`), no como `Date`: JSON no
  tiene tipo fecha, y la regla 1 pide UTC.
- Este package es **CommonJS** (sin `"type": "module"`). Si algún día necesita ESM, hay que mirar
  primero cómo lo consume la API, que es CJS por D-016.

---

# `contracts/CLAUDE.md`


> Se carga solo al tocar este subárbol. Las reglas duras (nunca custodiar valor, cero PII,
> metadata ≤64 bytes, blueprint commiteado) están en el `CLAUDE.md` de la raíz.

Aiken **v1.1.21** · **Plutus V3** (D-019) · stdlib v3.0.0 · `aiken-lang/fuzz` v2.1.1 (property
tests, `SPEC-306`).
Aislado del workspace pnpm (D-054): **corre en paralelo y no bloquea a nadie.** Es el track ideal
para trabajarlo por separado del resto del workspace.

```
lib/propnexus/fsm.ak     núcleo puro: tipos, tabla de transiciones, reglas del datum (45 tests)
validators/stage.ak      el validador: spend + mint, lo que necesita la tx    (40 tests)
plutus.json              blueprint — se commitea tras cada build
```

El corte es el de D-008: **el validador es cáscara delgada sobre el núcleo puro.** Si una regla se
puede escribir sin mirar la transacción, va en `fsm.ak` y se prueba barato.

### La FSM canónica (D-020)

```
Pending → InProgress → Completed        (Completed es TERMINAL)
             ↑↓
          Observed                       (remediación, no estado final)
```

Sale textual del entregable original de M1 (`M1-D2/3-milestone-lifecycle.puml`). `Observed` es el
camino de remediación: se observa para que el developer corrija y vuelva a `InProgress`. El estado
en datos se llama `Completed` —no `Certified`, porque la plataforma no certifica (D-026)— y la
etiqueta visible sale del diccionario i18n.

**Qué significa cada estado: a quién le toca.** Los cuatro no son cuatro momentos de la obra —
son de quién es el turno, y por eso `Pending` e `InProgress` no son redundantes aunque lo parezcan.
La tabla completa está en D-020; acá va el resumen porque explica el diseño del datum:

| Estado | Espera a | Afirma |
|---|---|---|
| `Pending` | developer | declarada y anclada; nada en el registro |
| `InProgress` | certifier | hay evidencia; nadie la juzgó |
| `Observed` | developer | el certifier encontró un problema |
| `Completed` | nadie | cerrada, con el root del bundle en el datum |

**El validador no sabe nada de esos roles, y está bien**: acá todo lo firma el `admin` (ver más
abajo, D-058), así que quién tenía derecho a pedir cada transición es una regla off-chain que vive
en `apps/api`. El validador garantiza que la **secuencia** sea legal y que nadie la reescriba
después; quién la pidió lo garantiza `authorize()`.

**Una sola tabla de transiciones, y desde D-059 el espejo existe de verdad**: la misma tabla vive
en `packages/shared` (`STAGE_TRANSITIONS`) y la aplica `PATCH /stages/:id/state` antes de
escribir. Si cambia una, cambian las dos en el mismo commit — y las dos suites prueban los 16 pares
exhaustivamente, así que una divergencia se ve como test rojo, no como una transacción rechazada en
la cadena.

### El datum sale de M1-D2, menos lo que no puede salir del off-chain

`StageDatum` es la entidad `Milestone` de `M1-D2/2-core-domain-model.puml` con dos filtros
encima: todo lo legible se queda afuera (whitepaper §On-Chain/Off-Chain Boundaries: *"No document
contents, personal data (…) are written on-chain"*, y regla 2 de la raíz), y solo entra lo que el
validador necesita para decidir.

| Campo | De dónde sale | Por qué está |
|---|---|---|
| `project_ref`, `stage_ref` | `milestone_id: UUID` de M1-D2 | refs **opacas**: los bytes crudos del id off-chain (hoy cuid2, 24 bytes). `stage_ref` es además el asset name del thread token, de ahí el tope de 32 |
| `sequence_order` | M1-D2 | orden del stage dentro del proyecto; parte de la identidad |
| `validation_critical` | M1-D2 | decide si completar exige evidencia |
| `state` | M1-D2 §3 | la FSM de D-020 |
| `evidence_root` | `EvidenceBundle.bundle_commitment_hash` (M1-D2) | 32 bytes cuando existe; vacío hasta `Completed` |
| `completed_at` | `certified_at` (M1-D2) | POSIX ms, acotado por la ventana de validez de la tx |

**La regla que trae el whitepaper**, §Signature and Certification Rules: *"Milestones designated as
validation-critical cannot reach Certified status unless their required evidence set is complete"*.
Acá eso es literal: `validation_critical == True` sin un commitment de 32 bytes **no llega a
`Completed`**.

**El firmante es un solo `admin`, y es definitivo** (D-058): el whitepaper §System Overview dice
*"All blockchain interactions are performed by operator-controlled backend services"*, y el dueño
ratificó que no hace falta un certificador externo firmando en la cadena. No hay co-firma CIP-30
pendiente acá. **Consecuencia, y hay que decirla:** lo que la cadena prueba es la **integridad de la
secuencia y del momento**, no que un profesional atestiguó. La atestiguación vive off-chain
(documento firmado + `AuditLog`), que es exactamente el reparto de las cuatro afirmaciones de D-026.

### El hilo: un token por stage, y no se puede quemar

Todos los stages viven en la **misma dirección de script**, así que la dirección no identifica a
nadie. Lo que identifica al hilo es un **NFT** cuyo asset name es el `stage_ref`:

- `mint` acuña **exactamente uno por transacción** y lo deja en el script con un datum inicial
  legítimo (`Pending`, sin evidencia, sin fecha, `sequence_order > 0`, refs no vacías ≤32 bytes).
  **La unicidad por stage no la garantiza el validador** — el handler no mira `tx.inputs`, así que
  nada ata la acuñación a un UTxO consumido y una segunda transacción vuelve a acuñar el mismo
  `stage_ref` (reproducido en `AUDITORIA-2026-09-11-calidad-de-contracts.md` §C-01). La sostiene el
  backend: `retryStageMint` (`apps/api/src/domain/stage-transition.ts`) consulta
  `findLiveThread` contra la cadena antes de mintear, no solo `OnChainEvent`
  (`SPEC-301`). Cerrar el agujero on-chain de verdad —que el validador exija gastar un UTxO
  semilla— cambia el script hash y es decisión de mainnet (`SPEC-305`).
- `spend` exige que el UTxO que se gasta lleve el token **y** que el output de continuación lo siga
  llevando. Un UTxO cualquiera abandonado en la dirección del script no es un hilo.
- **No hay burn.** Quemar el token sería borrar la historia de un stage, y el punto entero del hilo
  es que ni el operador pueda hacerlo (D-008). El hilo es append-only, como el `AuditLog`.

Sin el token, el operador podía crear dos UTxOs para el mismo stage con estados contradictorios y
**los dos validaban**: quien verifica tenía que preguntarnos cuál era el bueno, que es la confianza
que el producto viene a eliminar.

### Coverage: cada punto de rechazo contra su test

`aiken check` **no mide coverage de líneas** —solo tiene `--property-coverage`, que es la
distribución de labels en property tests—, así que el ≥95% del criterio 2 del SOM se demuestra con
esta tabla.

**La tabla se mide, no solo se afirma** (`SPEC-017` paso 6). Dos scripts en `contracts/scripts/`,
que se corren a mano desde la raíz del repo:

```bash
node contracts/scripts/rechazos-mutantes.mjs --listar   # qué chequeos se van a mutar, sin correr aiken
node contracts/scripts/rechazos-mutantes.mjs            # saca cada chequeo de a uno: algún test tiene que ponerse rojo (~4 s por mutante)
node contracts/scripts/rechazos-trazas.mjs              # cada `expect` contra el test de rechazo que aborta exactamente ahí
```

`rechazos-mutantes.mjs` cubre las conjunciones de `and`, los `expect` booleanos, los patrones de
lista, las puntas de la ventana de validez, las ramas de la tabla de transiciones y el `fail` del
`else` (51 mutantes). Los `expect` que desarman o castean (`Some(x) = …`, `x: StageDatum = …`, 7) no
se pueden mutar sin romper los tipos: los cubre `rechazos-trazas.mjs` con la traza que devuelve
`aiken check`. Los dos salen con código ≠ 0 si queda un chequeo sin test. **102 tests, 0 fallando** (dos de ellos, property tests, corren 100 casos generados
cada uno — ver la fila de abajo).

**Medida de verdad, no solo argumentada (`SPEC-017`, cerrado 2026-09-22).** La corrida vigente —
[`specs/evidencia-m3/1-repo-ci-tests/aiken-coverage-report.md`](../specs/evidencia-m3/1-repo-ci-tests/aiken-coverage-report.md)
(en inglés; consolida los dos reportes que hasta el 2026-09-24 vivían en archivos separados,
`mutation-report.md` y `expect-trace-report.md`)— da **51 mutantes: 51 muertos** y **18 `expect`: 18
con test**: el 100% que la tabla de abajo venía afirmando queda medido, no solo argumentado. El
triage del paso 6 había marcado `stage.ak:91`
(`own_input` lleva exactamente 1 unidad del token) como equivalencia genuina —`carrying_thread`
sobre el output de continuación (línea 104) más la igualdad de valor (línea 125) parecían forzar la
misma cardinalidad por otro camino—, pero esa lectura asumía que `carrying_thread` termina mirando
al output de continuación. No tiene por qué: filtra **todos** los outputs por payment credential,
así que un decoy en una dirección con el mismo payment credential pero otro staking credential
(el mismo hueco de C-01/SPEC-301) puede absorber el único match en su lugar, sin que la cantidad
mal formada de `own_input` importe. `spend_rejects_own_input_with_two_units_when_a_decoy_absorbs_
carrying_thread` arma exactamente ese ataque y mata el mutante — no era equivalencia, era un test
que faltaba.

`lib/propnexus/fsm.ak` — 48:

| Qué prueba | Tests |
|---|---|
| La tabla de transiciones, **exhaustiva**: los 4 pares válidos y los 12 inválidos | `t_*_to_*` (16) |
| `Completed` es terminal (las 4 salidas fallan) | `t_completed_is_terminal_to_*` (4, incluidas arriba) |
| La identidad no se reescribe (proyecto, stage, orden, criticidad) | `t_identity_*` (5) |
| Un stage crítico exige commitment de 32 bytes; uno no crítico no | `t_critical_needs_a_full_commitment`, `t_non_critical_completes_without_evidence` |
| Evolución del datum: completar, no completar, y los cruces inválidos | `t_evolution_*` (12, de los cuales 3 son `SPEC-017`: una transición no-terminal con `Completion` adjunto, un `evidence_root` de redeemer y datum que difieren, y un `completed_at` de redeemer y datum que difieren — las tres evaden en sustancia la garantía anti-backdating y de evidencia obligatoria si no se prueban) |
| **Property tests sobre `valid_datum_evolution`** — el único lugar del subárbol con espacio de entrada ancho de verdad; la tabla de transiciones de arriba ya está probada exhaustivamente y ahí un property test no agregaría nada (`SPEC-306`). Generador de `StageDatum` con refs/roots de largo variado, incluidos 0 y 32 | `prop_non_completing_evolution_preserves_evidence`, `prop_evolution_never_bypasses_the_transition_table` (2, 100 casos c/u) |
| Nacimiento del hilo: estado inicial, evidencia y fecha en cero, orden positivo, refs no vacías y ≤32 bytes | `t_initial_*` (7) |
| El datum codifica al mismo CBOR que el códec de `packages/cardano` espera — el "valor dorado" (ver `packages/cardano/CLAUDE.md`) | `t_golden_datum_encoding` (1) |
| El redeemer (`StageRedeemer`/`MintAction`) codifica al mismo CBOR que `encodeAdvanceRedeemer`/`encodeInitRedeemer` de `packages/cardano` — mismo boundary que el datum, cerrado el 2026-09-08 (`specs/archive/PLAN-2026-09-08-tests-aiken-robustez.md`) | `t_golden_redeemer_*` (3) |

`validators/stage.ak` — 54 (10 caminos felices + 43 puntos de rechazo + 1 sobre el `else`
genérico). Los 14 que suma `SPEC-017` (cerrado 2026-09-22) aíslan un punto de rechazo que otro test
ya tocaba de rebote, y quedan marcados abajo:

| Punto de rechazo | Test |
|---|---|
| el camino feliz tolera un output ajeno en otra dirección (`SPEC-017`) | `spend_accepts_an_unrelated_output_elsewhere` |
| el camino feliz tolera un input de wallet extra, además del del script (`SPEC-017`) | `spend_accepts_an_extra_wallet_input` |
| datum ausente | `spend_rejects_missing_datum` |
| el `own_ref` no está entre los inputs | `spend_rejects_unknown_own_ref` |
| `own_input` en una dirección de wallet, no de script (`SPEC-017`) | `spend_rejects_own_input_not_locked_by_a_script` |
| un segundo output parado en la dirección exacta del script, sin el token (aísla la cardinalidad de `at_address`, no la de `carrying_thread` — `SPEC-017`) | `spend_rejects_a_second_output_at_the_exact_script_address` |
| dos inputs del script en la misma tx | `spend_rejects_two_script_inputs` |
| dos outputs al script | `spend_rejects_two_script_outputs` |
| el hilo partido en dos outputs con el mismo payment credential y distinto staking credential — el ataque real que argumenta el comentario de SPEC-303 (`SPEC-017`) | `spend_rejects_thread_split_across_a_staking_variant_of_the_script_address` |
| ningún output de continuación | `spend_rejects_no_continuing_output` |
| falta la firma del operador | `spend_rejects_missing_admin_signature` |
| datum de salida no inline | `spend_rejects_non_inline_datum` |
| el cast a `StageDatum` del datum de continuación, con `Init` como forma estructural distinta (`SPEC-017`) | `spend_rejects_new_datum_of_the_wrong_type` |
| el valor bloqueado cambia (D-021) | `spend_rejects_value_drain` |
| solo el ADA se drena, con la unidad del thread token intacta — aísla D-021 de la cardinalidad de `carrying_thread` (`SPEC-017`) | `spend_rejects_ada_drain_while_keeping_the_token` |
| transición fuera de la tabla | `spend_rejects_invalid_transition` |
| salir del estado terminal | `spend_rejects_leaving_completed` |
| identidad del stage reescrita | `spend_rejects_identity_rewrite` |
| criticidad bajada para evitar la evidencia | `spend_rejects_criticality_downgrade` |
| stage crítico completado sin evidencia | `spend_rejects_completing_critical_without_evidence` |
| el datum nuevo no coincide con el redeemer | `spend_rejects_datum_not_matching_redeemer` |
| `completed_at` fuera de la ventana de validez | `spend_rejects_timestamp_outside_validity_range` |
| ventana de validez abierta (sin punta finita) | `spend_rejects_open_ended_validity_range` |
| `completed_at` un instante antes del borde inferior de la ventana (el borde exacto acepta — caminos felices) | `spend_rejects_timestamp_one_below_lower_bound` |
| `completed_at` un instante después del borde superior de la ventana | `spend_rejects_timestamp_one_above_upper_bound` |
| ventana semiabierta: inferior infinito, superior finito — aísla la punta inferior (`SPEC-017`) | `spend_rejects_missing_lower_bound` |
| ventana semiabierta: superior infinito, inferior finito — aísla la punta superior (`SPEC-017`) | `spend_rejects_missing_upper_bound` |
| el UTxO gastado no lleva thread token | `spend_rejects_utxo_without_thread_token` |
| el token es el de otro stage | `spend_rejects_thread_token_of_another_stage` |
| el UTxO gastado lleva 2 unidades del propio thread token, no 1 (análogo al de `mint`) | `spend_rejects_utxo_with_two_units_of_own_token` |
| lo mismo, pero con un decoy en una dirección de mismo payment credential absorbiendo el único match de `carrying_thread` — la única forma de aislar la línea 91 de la red de 104+125 (`SPEC-017`) | `spend_rejects_own_input_with_two_units_when_a_decoy_absorbs_carrying_thread` |
| la transición se queda con el token | `spend_rejects_dropping_the_thread_token` |
| acuñar sin firma del operador | `mint_rejects_missing_admin_signature` |
| acuñar 2 unidades del mismo token | `mint_rejects_two_units_of_the_thread` |
| acuñar dos hilos en la misma tx | `mint_rejects_two_threads_in_one_tx` |
| el token acuñado no queda en el script | `mint_rejects_token_not_locked_in_the_script` |
| el asset name no coincide con el `stage_ref` del datum | `mint_rejects_asset_name_not_matching_stage_ref` |
| nacer fuera de `Pending` | `mint_rejects_starting_outside_pending` |
| nacer con evidencia o fecha ya puestas | `mint_rejects_preloaded_evidence` |
| el output ya carga 2 unidades del token (el token "donado" por un input externo) | `mint_rejects_output_holding_extra_units_of_the_token` |
| dos asset names distintos, los dos presentes en el output — aísla la cardinalidad pura de `dict.to_pairs`, no el mismatch con `stage_ref` (`SPEC-017`) | `mint_rejects_two_asset_names_when_both_are_present_in_the_output` |
| dos outputs en la dirección del script, cada uno con 1 unidad del mismo asset — el mismo truco del token "donado", análogo al de `spend` (`SPEC-017`) | `mint_rejects_two_outputs_each_carrying_one_unit` |
| datum inicial no inline | `mint_rejects_non_inline_datum` |
| el cast a `StageDatum` del datum inicial, con `Init` como forma estructural distinta (`SPEC-017`) | `mint_rejects_initial_datum_of_the_wrong_type` |
| quemar el thread token (D-008: "no hay burn" era un argumento, ahora es un test — `SPEC-302`) | `mint_rejects_a_burn` |
| purpose que no es spend ni mint (withdraw, publish, vote, propose) — cerrado el 2026-09-08, antes solo se sostenía por lectura de código | `else_rejects_other_script_purposes` |

Los negativos van marcados `test ... fail` porque los `expect` abortan en vez de devolver `False`.

### Estado y deuda

- **~~El backend no espeja la tabla de transiciones.~~** Cerrado por D-059: la tabla vive en
  `packages/shared`, la ruta la aplica, y el stage nace en `Pending` como el `mint` exige.
- **~~El commitment de evidencia no lo calcula nadie.~~** Cerrado (`SPEC-013` §3): `EvidenceBundle`
  existe, `crearBundle` congela la evidencia del stage al completarlo y el Merkle root
  (`packages/shared`) viaja al datum. El estado real vive en `SPEC-013`, no acá.
- **El `stage_ref` es el id off-chain en bytes, y hoy ese id es cuid2** (24 bytes), no UUID como
  piden M1-D2 y la regla 1. El validador no opina —cualquier `ByteArray` de 1 a 32 bytes entra—
  así que si el backend migra a UUID, migra sin tocar el script. Lo que **no** se puede es cambiar
  de criterio con hilos ya acuñados: el asset name es el id, y no se puede reacuñar.
- **~~El anclaje todavía no existe del lado del backend.~~** Cerrado: `packages/cardano` tiene
  `AnchorPort` completo (puerto + simulador + adaptador real contra `Emulator`/yaci, 40/40 tests) y
  `apps/api` lo llama desde `PATCH /milestones/:id/state` y `POST /evidence/:id/anchor`
  (`apps/api/src/lib/anchor.ts`, `apps/api/src/domain/stage-transition.ts`). El detalle de qué
  falta (rebanada C — `verify()`/`reconcile()` contra la cadena real, y Preprod) vive en
  `specs/archive/SPEC-013-anchorport.md`, no acá.
- **La clave del `admin` no es rotable (D-093, `SPEC-304`).** Es un parámetro del script: la
  dirección y el policy id son función de esa clave. Si `SERVICE_WALLET_PRIVATE_KEY` se pierde o se
  compromete, todos los hilos vivos quedan congelados para siempre —`spend` exige su firma sin
  alternativa, no hay burn— y los hilos nuevos nacerían bajo otro policy id. Es más grave que las 2
  ADA bloqueadas por etapa (D-057): eso es costo, esto es pérdida de la función del producto. Para
  Preprod con datos de demo es aceptable; antes del primer mint en mainnet hay que elegir entre
  dejarlo así, un multisig M-de-N o un segundo VKH de recuperación — las tres opciones y por qué
  ninguna se implementa todavía están en `SPEC-304`.
- **Hubo un `contracts/reference/`** con 353 líneas que el compilador no leía y que describía otra
  FSM (`Certified`, salida del terminal). Se borró en **D-056**; no lo recuperes del historial.
- **La sintaxis de Aiken cambia entre versiones**: verificá contra la pineada (`aiken --version`)
  antes de asumir stdlib.

### Trampas

- **`aiken` no imprime diagnósticos si stdout no es un TTY.** Un `aiken check 2>&1 | tail` devuelve
  exit 1 y **ninguna línea de error**. Si algo falla y no ves por qué, corrélo en una terminal de
  verdad o envolvelo en un pty.
- **Los `use` van todos arriba del archivo**, incluso los que solo usan los tests. Un `use` a mitad
  de archivo es error de parseo, no advertencia.
- **Un módulo de `lib/` no puede llamarse igual que un validador**: `use propnexus/stage` junto a
  `validator stage` es "two top-level objects referred to as 'stage'". Por eso el núcleo puro es
  `fsm.ak` y no `stage.ak`.
- **2026-09-18 · `use aiken/fuzz` no anda solo con `aiken-lang/stdlib` como dependencia — hace
  falta declarar `aiken-lang/fuzz` aparte** (`SPEC-306`). Los `.test.ak` de la propia stdlib
  (`interval.test.ak`, `cbor.test.ak`) importan `aiken/fuzz` y usan property tests, y eso hizo creer
  que el módulo venía con el paquete. No: es una dependencia **de stdlib**
  (`aiken-lang/fuzz v2.1.1`, visible en `build/packages/aiken-lang-stdlib/aiken.toml`), no una
  re-exportación hacia quien consume stdlib. El error es `unknown module: 'aiken/fuzz'`, sin pista
  de que la solución es un `[[dependencies]]` nuevo en `aiken.toml` — hay que ir a mirar el `.toml`
  del propio paquete vendorizado para encontrar el nombre y la versión exactos.

### Autonomía

🟡 amarillo: el LLM propone, el humano revisa línea por línea antes de integrar. Bajó de rojo por
D-021 — no hay fondos en riesgo.

### Comandos

```bash
pnpm contracts:check      # aiken check (compila + corre los tests; ver §Coverage por el total vigente)
pnpm contracts:build      # regenera plutus.json — commitealo (el CI verifica que esté al día)
aiken fmt                 # el CI corre 'aiken fmt --check'
aiken check -m <patrón>   # solo los tests cuyo nombre matchee
```

---

# `CLAUDE.md` raíz, §Trampas transversales


Sección viva: agregá acá el mismo día que te muerda una. Las de cada frente van en su `CLAUDE.md`.

- **Las capturas de M2-D2 tienen datos mock, no datos de diseño.** M2-D1 lo dice: *"the maquette uses
  mock blockchain interactions"*. Lo normativo de una captura es la **estructura** —layout,
  componentes, jerarquía, estados—; los valores no. La captura 55 muestra tres unidades del mismo
  proyecto en tres stages distintos y casi nos hace modelar stages por unidad, cuando el dominio dice
  que un desarrollo tiene un solo trámite (D-029).
- **Antes de concluir que un entregable está mal, verificá que estás mirando el entregable.** Cuatro
  `.puml` regenerados desde los PDF de M1 tenían las flechas de la FSM invertidas, y durante una
  sesión entera creímos que el entregable estaba mal. El paquete canónico es
  `M1-D2-Architecture-and-Data-Models/`, hasheado en la Proof of Achievement.
- **Grepear solo `*.md` esconde entregables.** Una búsqueda con `--include="*.md"` concluyó que algo
  no aparecía en `docs/`; estaba en un `.csv`. Grepeá sin filtro de extensión.
- **Los códigos de entregable se reinician en cada milestone y colisionan**: `M1-D1` es el whitepaper,
  `M2-D1` es el mapa de arquitectura de información. Al citar, usá siempre la forma completa
  (`M2-D1 §4`). Y `M2-D5`/`M2-D6` son entregables de **Milestone 2** aunque vivan en la carpeta de M3.
- **Los PDF de este repo no se leen con la herramienta de lectura** (falta `pdftoppm`). Las capturas
  PNG sí. Para un PDF: `qlmanage -t -s 1800 -o <dir> archivo.pdf`.
- **Un verificador que vive dentro del corpus que verifica se encuentra a sí mismo.** Un guardia que
  matcheaba la mención de `docs/` se bloqueó al escribirse. **Antes de agregar un verificador,
  preguntá si el problema no se arregla mejor cambiando la forma de lo verificado** (D-053).
- **Editar un `package.json` sin correr `pnpm install` produce un verde falso.** Lo atrapa
  `pnpm install --frozen-lockfile` en CI, y alcanza. Un verde sobre el entorno equivocado es peor que
  un rojo.
- **`pnpm.overrides` vive en `package.json` y pnpm 10+ dejó de leerlo.** El pin
  `"packageManager": "pnpm@9.15.0"` es lo único que hoy lo sostiene: un pnpm más nuevo instalado en
  la máquina delega a 9.15.0 y el override se aplica igual —lo prueba la línea 8 de `pnpm-lock.yaml`
  y que `@types/express` resuelva a 5.0.6—, pero avisa `The "pnpm" field in package.json is no longer
  read by pnpm`. **Ese warning no es ruido: es la cuenta regresiva.** El día que se suba el pin a
  pnpm 10+, los overrides se ignoran **en silencio** y sin romper el build; hay que moverlos a
  `pnpm-workspace.yaml` en el mismo commit que sube la versión.
- **`pnpm verify` corre contra el entorno de test, no contra el que declara `render.yaml`.** Entre
  los dos no había nada, y una regresión de configuración solo se veía en los logs del deploy.
  Lo cierra `apps/api/test/render-config.test.ts` (D-076). **Si agregás una lectura de `env.*`
  nueva, declarala en `render.yaml` o el test se pone rojo** — que es el punto.
- **`pnpm verify` corría `test` sin coverage, y CI corre `test:coverage` con umbral 100%.** El
  2026-09-28 una función del `leaflet-falso.ts` que ningún test ejecutaba dejó web en 99.87% de
  funciones: verde local, rojo en CI, dos pushes seguidos. Desde entonces `verify` corre
  `test:coverage`. **Si CI agrega un paso, `verify` lo espeja** — un verde local que CI no confirma
  es el verde falso de siempre.
- **Las capturas del developer no coinciden en el header.** Documentación (46) va sin logo, Audit
  log (49) va con logo, ninguna trae campana ni idioma, y M2-D3 dice *never omit the logo*. No se
  transcribe captura por captura: D-074 unifica. Si una pantalla nueva "sigue la captura" y saca el
  logo, está mal.
