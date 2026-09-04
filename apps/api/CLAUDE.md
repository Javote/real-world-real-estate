# apps/api — la API

> Se carga solo al tocar este subárbol. Las reglas duras (Zod, dos capas de auth, `AuditLog`,
> bcrypt, uploads, idempotencia, claves de traducción) están en el `CLAUDE.md` de la raíz y **no
> se repiten acá**.

Express 4 + Zod + JWT + bcrypt(10) + Multer 2.x + Kysely/SQLite (`@libsql/client`), base `/api/v1`
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
2. Ruta con `requireRole` + `canAccessProject`, diciendo **qué membresías** acepta —
   `ANY_MEMBERSHIP` si alcanza con ser miembro. No es opcional: omitirlo no compila (D-042).
   (🔴 `canAccessProject` lo lidera el humano.)
3. `safeParse` → 400 con `error.flatten()`.
4. `writeAuditLog` si es mutación relevante.
5. Test del camino feliz y de cada rechazo.
6. Path y test ID **idénticos** a los de M2-D5.

## Trampas verificadas

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
- **`@types/express` v5 con Express 4 rompe el typecheck** (21 errores `string | string[]` en
  `req.params`). Está pineado a `^4.17.21`: no lo "actualices" por su cuenta.
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

`PATCH /api/v1/stages/:id/state` es hoy el único lugar donde el registro avanza, y hace cuatro cosas
(D-059): aplica la tabla de transiciones, exige evidencia para completar un stage
`validationCritical`, escribe el estado, y registra un `OnChainEvent` **pendiente** — la
declaración queda registrada y la prueba queda `Pending` hasta que exista TXID. Al revés no puede
pasar.

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

### ~~El SHA-256 se mueve cuando llegue R2~~ — cerrado el 2026-08-23

El hash lo calcula ahora `lib/storage.ts`, y con `STORAGE_DRIVER=s3` **relee el objeto subido y lo
rehashea**: cubre los bytes que quedaron en el object storage, no los del temporal. La diferencia
no es teórica — si una subida se truncara, el hash del temporal seguiría siendo "correcto" y
estaríamos anclando la huella de un archivo que no existe en ningún lado.

`utils/hashing.ts` se borró: su única función quedó adentro del port, y dos lugares que hashean es
uno de más.

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
```

**Una sola migración**, `0000_init.sql`, y describe la base entera. Las seis que existieron hasta el
2026-08-23 se colapsaron ahí (D-063): nada estaba desplegado, así que el esquema real —que había que
reconstruir mentalmente aplicando seis archivos en orden, incluida una reconstrucción de tabla— pasó
a leerse en un solo lugar.

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
