# apps/api — la API

> Se carga solo al tocar este subárbol. Las reglas duras (Zod, dos capas de auth, `AuditLog`,
> bcrypt, uploads, idempotencia, claves de traducción) están en el `CLAUDE.md` de la raíz y **no
> se repiten acá**.

Express 5 + Zod + JWT + bcrypt(10) + Multer 2.x + Kysely/SQLite (`@libsql/client`), base `/api/v1`
(D-016, D-036, D-048 → D-049 — Prisma → Drizzle → Kysely, los dos migrados el 2026-08-21; los
restos que quedaban se barrieron en D-052).

Está mejor parada que el frente: **la API se evoluciona, el front se reemplaza.** Se conservan
auth JWT+bcrypt con autorización en dos capas, SHA-256 en el servidor al subir, `AuditLog`
append-only y el shape de `Project`/`Evidence`.

## Antes de tocar un endpoint

`M2-D5` §4-6 trae el path exacto, los test IDs y el work stream; `M2-D6` §9 el baseline. Los paths
van **scopeados por rol** (`/investor/`, `/developer/`, `/notary/`, `/certifier/`). El backlog de
M2-D5 §4-6 está **completo**: los 18 work streams `M3-BE-XX` tienen sus rutas montadas y con test.

Lo que queda fuera del backlog y sigue vivo: el CRUD genérico (`/projects`, `/users`, `/evidence`),
que la superficie del entregable no consume pero los tests y el seed sí.

## Checklist de un endpoint nuevo

1. Schema Zod en `packages/shared` — **antes** que el endpoint (regla 6). El front importa el
   mismo tipo. Es lo único que vuelve imposible el drift API↔web.
2. Ruta con **`authorize({ roles, acceso })`**, los dos campos obligatorios. `acceso` es
   `"soloRol"`, `{ proyecto, membresias }`, `{ dueño }` o `{ alguna: [...] }`. Nunca un `if`
   adentro del handler — **no hay otra forma**: los tres guards sueltos se borraron (D-088).
3. `safeParse` → 400 con `error.flatten()`.
4. `writeAuditLog` si es mutación relevante.
5. Test del camino feliz y de cada rechazo.
6. Path y test ID **idénticos** a los de M2-D5.
7. La ruta entra en la matriz de `test/route-guards.test.ts` — el test se pone rojo hasta que la
   sumes, y sumarla es donde mirás si los guards son los que querías. Ver §La matriz de permisos.

## Trampas verificadas

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
  (`anchorEvent(evento, stage, null)`, línea ~95 de `routes/projects-obra.routes.ts`). El síntoma
  **no es un error de la request** — D-059 escribe la declaración igual, la respuesta es 200 — es
  el `anchor.status` quedando `Failed` en silencio, exactamente el caso que ya cubre
  `test/stage-transitions.test.ts` (*"deja el evento en Failed... si el stage no tiene hilo"*), solo
  que nadie había cruzado ese test con el hecho de que el seed de demo crea stages así.
  **Primer anclaje real, resuelto sobre un stage nuevo:** se probó sobre "Terminaciones", creado con
  `POST /projects/:id/stages` para abrir el hilo, y recién después `PATCH .../state`. Confirmado con
  las dos transacciones referenciando el reference script (D-083) en vez de adjuntar el validador —
  verificado leyendo `reference: true` en los inputs de cada tx contra Blockfrost, no por
  tamaño/fee nomás. Ver `CLAUDE.md` raíz, cierre del 2026-09-03.
  **Dos arreglos que salieron de esto, para que no vuelva a sorprender:**
  1. `POST /projects/:id/stages/:stageId/retry-anchor` (admin) — reintenta el mint cuando
     genuinamente falló (red caída, wallet sin fondos) y el stage **sigue en `Pending`**. Para un
     stage que ya avanzó sin hilo —el caso de `Estructura`— da 409 `STAGE_ALREADY_ADVANCED` a
     propósito: no existe un mint retroactivo honesto una vez que el estado off-chain avanzó sin
     prueba (`domain/stage-transition.ts` → `retryStageMint`, explica el porqué en su docstring).
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
- **El warning de `url.parse()` deprecado al arrancar viene de `bcrypt`**, vía
  `@mapbox/node-pre-gyp`, no de Multer ni del código propio. El repo lo atribuyó a Multer durante
  meses y era falso: se comprobó con `tsx --trace-deprecation`, y sobrevivió intacto a la
  migración a Multer 2 (D-036). **Antes de atribuir un warning, trazalo.**
  Es la punta visible de algo que importa más: `bcrypt` es un **módulo nativo**. El argumento caro
  (toolchain en la imagen Docker) murió con D-041 — no hay imagen. Ver §Superficie 🔴 y
  `specs/stack.md` §11.
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
  (D-047). Sin `DATABASE_URL` cuenta como remota. Los helpers y sus tests están en
  `src/db/credentials.ts`.
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

## El endpoint de estado de stages, y lo que todavía no cumple

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
- **~~El path dice `/milestones/`~~ — falso desde hace tiempo, y este archivo lo afirmó de más.**
  `app.ts` monta `app.use("/api/v1/stages", stagesRoutes)` y **no existe ninguna ruta
  `/milestones`**. Lo único que conserva la palabra es `setMilestoneState` en
  `apps/web/src/api/port.ts` —un nombre de función, no un path— y las claves de i18n que
  corresponden al test ID `INV-STAGE-MILESTONE-001`, que M2-D5 obliga a transcribir literal.
- **El nombre todavía miente un poco:** `PATCH .../state` suena a editar un campo, cuando lo que
  ocurre es *registrar una transición* — un evento, no un update. Es lo único que queda de esta
  deuda; el path ya es `/stages/`.

## Superficie 🔴 — inventario

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

### ~~P1 · `JWT_SECRET` cae a un literal público~~ — cerrado el 2026-08-20

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

### El algoritmo de firma se fija; el ciclo de vida del token sigue abierto

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

### ~~El comentario del login promete más de lo que el código cumple~~ — cerrado el 2026-08-20

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

### `canAccessProject`: el default fail-open cerrado, la forma todavía no

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

### La matriz de permisos, asentada — 2026-09-04

**El problema que cierra.** La segunda capa tiene forma que no compila si te la olvidás
(`allowedMemberships` obligatorio, D-042), pero eso solo protege a quien la escribe: **nada obligaba
a poner el middleware**. Los dos agujeros de septiembre son el mismo modo de falla —
`GET /evidence/:bundleId/files` sin `requireProjectAccess`, y `POST /users` con su propio enum de
roles— y los dos los encontró una auditoría a mano. No había ninguna herramienta que los pudiera
encontrar, y con 87 handlers en 18 archivos la auditoría a mano no escala ni se repite.

**Cómo funciona.** `test/route-guards.test.ts` recorre los routers **ya montados** y reconstruye la
matriz de las 87 rutas: método, path absoluto y cadena de guards declarados. La compara contra un
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

### ~~El SHA-256 se mueve cuando llegue R2~~ — cerrado el 2026-08-23

El hash lo calcula ahora `lib/storage.ts`, y con `STORAGE_DRIVER=s3` **relee el objeto subido y lo
rehashea**: cubre los bytes que quedaron en el object storage, no los del temporal. La diferencia
no es teórica — si una subida se truncara, el hash del temporal seguiría siendo "correcto" y
estaríamos anclando la huella de un archivo que no existe en ningún lado.

`utils/hashing.ts` se borró: su única función quedó adentro del port, y dos lugares que hashean es
uno de más.

### El guard único — `authorize`, 2026-09-04 (D-088)

**Las 87 rutas montadas declaran su regla en la firma.** Las únicas dos sin `authorize` son las dos
sin sesión que M2-D5 §2.2 declara: `POST /auth/login` y `GET /public/dossier/:shareToken`.

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

### La tercera capa — la pertenencia de fila, 2026-09-04

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

### bcrypt: se queda nativo

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
y `bcryptjs` es ~30% más lento encima de eso. Queda el warning de `url.parse()` (ver Trampas) y el
riesgo genérico de módulo nativo. **Bajar el cost no es opción: la regla 4 fija 10.**


## Tests

`pnpm --filter @plataforma/api test` — vitest + supertest contra **una base SQLite propia**
(`test.db`), que `test/global-setup.ts` crea aplicando las migraciones (`src/db/migrate.ts`, D-049)
y siembra en cada corrida. Nunca contra `.data/dev.db`: un test no puede depender del seed de desarrollo
ni ensuciarlo.

Se aplican las migraciones reales (`migrations/*.sql`) **con el mismo runner que corre en producción**
(`src/db/migrate.ts`, D-052) y no una proyección ad-hoc del schema: así la
suite verifica lo mismo que va a correr en producción.

## Comandos

```bash
pnpm --filter @plataforma/api dev            # solo la API
pnpm --filter @plataforma/api db:migrate     # aplica las migraciones pendientes
pnpm --filter @plataforma/api db:seed        # datos demo
pnpm --filter @plataforma/api test:s3        # storage contra el MinIO de compose.dev.yml — NO corre en CI
pnpm --filter @plataforma/api docs:api       # regenera specs/postman/*.json desde el router montado
```

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
