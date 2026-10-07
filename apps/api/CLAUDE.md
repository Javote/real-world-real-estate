# apps/api — la API

> Se carga solo al tocar este subárbol. Las reglas duras (Zod, dos capas de auth, `AuditLog`,
> bcrypt, uploads, idempotencia, claves de traducción) están en el `CLAUDE.md` de la raíz.

Express 5 + oRPC + Zod + JWT + bcrypt(10) + Multer 2.x + Kysely/SQLite (`@libsql/client`), base
`/api/v1`. ESM (D-102). Los paths van **scopeados por rol** y salen de M2-D5 §4-6; fuera del
backlog quedan el CRUD de `/projects` y `/users` (admin, `SPEC-221`).

## Checklist de un endpoint nuevo

Desde A2 (SPEC-607), un endpoint nuevo puede nacer como procedimiento oRPC en `routerRaiz`
(`platform/router.ts`): sale de `procedimiento(guard)` (`platform/procedimiento.ts`), con el mismo
guard que `authorize` en su `meta`, y `route-guards.test.ts` lo lee de ahí. Lo de abajo es la forma
Express, que sigue siendo la de las rutas existentes hasta A3/A4.

1. Schema Zod en `packages/shared` **antes** que el endpoint (regla 6).
2. **`authorize({ roles, acceso })`**, los dos obligatorios (D-088): `"soloRol"`,
   `{ proyecto, membresias }`, `{ dueño }`, `{ alguna: [...] }` o `{ scopeEnQuery: "<el filtro>" }`.
   Si tu query filtra por el usuario o por `projectScope`, es `scopeEnQuery` y el texto nombra el
   campo. Nunca un `if` de autorización suelto en el handler.
3. `safeParse` → 400 con `error.flatten()`.
4. Un path param con nombre nuevo va a `packages/shared/src/params.ts`, a su `router.param(...)` y a
   `PARAM_SCHEMAS` de `generate-openapi.ts`.
5. `writeAuditLog` si es mutación relevante, con el `txid` en el metadata si ancla.
6. Test del camino feliz y de cada rechazo.
7. Path y test ID **idénticos** a los de M2-D5.
8. La ruta entra en el literal de `test/route-guards.test.ts`: sumarla es la revisión de sus guards.
9. Si valida con `safeParse` a mano (no oRPC), su schema va a `REQUEST_SCHEMAS` de
   `generate-openapi.ts`.

## Trampas

**Autorización y dominio**

- **Una regla sobre el valor del body no la modela `authorize()`**: por eso `PATCH /stages/:id/state`
  rechaza con 403 todo lo que no sea `→ InProgress` para un no-admin; certificar y observar son del
  certifier (M2-D1 §4).
- **`auditScope` es fail-closed**: una entidad nueva en el audit log no aparece hasta sumarla al
  mapeo. `User` queda afuera por diseño.
- **El bypass de `admin` vive adentro de `projectScope`/`auditScope`/`evaluarDueño`**, en ningún otro
  lado, y un dueño `null` es 403.
- **La cola del notary es compartida**: `/dossiers/:id`, `/sign` y `/reject` no tienen regla de
  pertenencia, y los listados filtran por `signedById` como scope, no como autorización.
- **Un seed que planta a mano una fila que el producto crea esconde el bug del endpoint** (pasó con
  la membresía `buyer` al aceptar una invitación). Antes de sembrarla, preguntá qué endpoint la crea.
- **Un schema local que coincide con el compartido se queda atrás en silencio**: importá el de
  `packages/shared`.
- **Una FSM terminal no protege a los otros pipelines**: subir evidencia a un stage `Completed` da 409
  `STAGE_ALREADY_COMPLETED`; `Observed` sigue aceptando.
- **El hilo es un subconjunto de `eventIndex`**: los `EVIDENCE_ANCHOR` comparten el contador. La
  cabeza del hilo es `cabezaDelHilo`, que filtra `outputRef is not null`; un txid no es un hilo.
- **Un stage sembrado directo en la base no tiene hilo**: su transición queda `Failed` en silencio.
  Mirá `hasOnChainThread` antes de usarlo en una demo; `retry-anchor` solo sirve en `Pending`.
- **Antes de anclar algo nuevo, definí cómo se vuelve del registro a su TXID**: `OnChainEvent.referenceId`.
- **Toda lectura que devuelve `anchorStatus` reconcilia su alcance** (`reconciliarParaLectura`, D-077)
  y entra en `test/reconcile-on-read.test.ts`, que se mantiene a mano.
- **`crearBundle` es idempotente por contenido**: el acta vigente con el mismo root se devuelve, no se
  duplica.
- **`storagePath` nunca sale al cliente** (D-011): toda respuesta con `Evidence` usa
  `EVIDENCE_SAFE_COLUMNS`.

**Express, oRPC y errores**

- **El router oRPC raíz atiende antes que Express**: lo que no conoce sigue de largo con `next()`, y
  cada request suma un span `routerOrpc`. Una ruta en los dos lados es un error de `rutasConGuards`.
- **El guard de un procedimiento corre antes de validar el input** (`guardOrpc`): sin sesión es 401
  aunque el body sea inválido. Un middleware que se agregue antes de `.input()` corre con el input
  crudo; `test/guard-orpc.test.ts` fija el orden.
- **El orden de montaje en `app.ts` es semántico**: un `router.use(guard)` corre para todo lo que le
  entra. Cada router con guard va bajo su prefijo, y los que lo comparten declaran los mismos guards.
- **Una restricción de la base es 409/400, no 500**: lo mapea `errorHandler` (`codigoDeRestriccion`).
  Un `select` previo no alcanza con requests concurrentes.
- **oRPC escribe su propio 500 y nunca llama a `next(err)`**: un procedimiento que inserta contra un
  índice único envuelve el insert con `relanzarRestriccionComoOrpc`.
- **El parser multipart de oRPC bufferea todo sin límite**: las rutas de archivos siguen con Multer.
- **Sentry ve el error antes que `errorHandler`**: filtra con `statusDeError(err) >= 500`, la misma
  clasificación compartida.
- **Un error del parser del body es del cliente**: `errorDelCliente` lo reconoce por el `expose` de
  `http-errors` (400 JSON mal formado, 413 body grande). Un `status` sin `expose` sigue siendo 500.
- **CORS lista los métodos a mano en `app.ts`**: un método nuevo en la web se suma ahí, y se prueba
  desde un navegador (`curl` no hace preflight).
- **`req.params[x]` es `string | string[]`** con Express 5.
- **Un body de archivo es `(await fs.promises.open(p)).createReadStream()` con `close()` en un
  `finally`**: `fs.createReadStream(path)` abre tarde y su `ENOENT` sale sin listener.

**Módulos, Kysely y la base**

- **Todo import relativo lleva `.js`** (`nodenext`), y un directorio, `/index.js`.
- **`tsc` no avisa de `require`, `__dirname` ni `module`**: `@types/node` los declara igual, pero en
  ESM no existen y fallan recién al arrancar. Van `import.meta.dirname` y
  `esPuntoDeEntrada(import.meta.url)` (`lib/punto-de-entrada.ts`).
- **Vitest verde no prueba que el build arranque**: resuelve con su propio loader. Un nombre que Node
  no encuentra en un paquete CommonJS aparece recién con `node`; lo agarra el smoke test de CI.
- **`lib/kysely.ts` y `lib/libsql-client.ts` son costuras de tests** (`vi.doMock`): se importa de
  ahí, no del paquete.
- **TypeScript hoistea los `import`**: `import "dotenv/config"` va primero, sin código intercalado.
- **`LibsqlDialect` recibe `{ url, authToken }`, no un `Client`**: trae su propia versión de
  `@libsql/client` y los tipos no casan.
- **El `LibsqlDialect` es el de `lib/libsql-dialect.ts`, no el del paquete**: el original usa el
  `SqliteAdapter` de Kysely, que pone un mutex global y vuelve serie todo `Promise.all` y toda request
  concurrente (`SPEC-610`; lo fija `test/viajes-por-request.test.ts`).
- **Un reclamo ("lo gana uno solo") es una sola escritura condicional, nunca un `db.transaction()`**:
  con dos a la vez sobre libSQL, la que pierde tira `SQLITE_BUSY` en vez de esperar. Para anclar,
  `anclarConReclamo` (`platform/anclaje.ts`).
- **El audit y las notificaciones nuevas salen de `platform/`**: `audit(ejecutor, entrada)` devuelve
  la consulta sin ejecutar (sirve en una transacción y en un `enLote`); `notify(ejecutor, entradas)` no
  tira. `writeAuditLog` y el `notify` de `domain/` son la forma vieja, escrita sobre las mismas piezas.
- **Un código de error nuevo va primero a `ERROR_CODES`** (`packages/shared/src/errors.ts`), o
  `test/error-codes.test.ts` se pone rojo; su clave tiene que existir en el diccionario de la web.
- **Una columna nueva va a la migración y a `db/types.ts` en el mismo commit**:
  `test/esquema-contra-tipos.test.ts` los compara.
- **Escrituras que no dependen de una lectura intermedia van con `enLote`, no con `db.transaction()`**:
  sobre Turso, una transacción interactiva cuesta un viaje por sentencia más el COMMIT; `enLote` es un
  `batch`, un viaje y atómico. El audit va con `insertAuditLog` adentro del lote.
- **Una columna nueva de fecha o booleana se suma a `SqliteTypeCoercionPlugin`**; nada lo fuerza.
- **Kysely no genera ids ni timestamps**: cada insert pasa `createId()` y fechas, y cada update suma
  `updatedAt`.
- **Si tu `dev.db` es de antes de un cambio de esquema, borrala**: el runner registra por nombre de
  archivo. Con Turso vivo, toda corrección es una migración nueva (D-063).

**Deploy y observabilidad**

- **Render free duerme a los 15 min sin requests y mata también el deploy en curso** ("Timed Out"):
  no es el código (`specs/RUNBOOK-deploy.md` §2).
- **`app.listen()` va antes que `initAnchorPort()`**: el puerto HTTP no espera a Blockfrost, y el
  `AnchorPort` tarda ~25 s más en estar listo. El dominio lo pide con `await anchorPortListo()`;
  `anchorPort()` tira hasta entonces y queda para los tests.
- **Todo paso del `startCommand` anuncia que empieza y que termina**, y `migrate` tiene techo de 120 s.
- **`--import` necesita `./`**: sin él se busca como paquete. Probá el comando literal del deploy.
- **Un cambio del `startCommand` en `render.yaml` llega en un deploy aparte**: el push dispara el
  autodeploy con el comando viejo del dashboard, y el sync del Blueprint otro con el nuevo. Si el
  código nuevo no arranca con el comando viejo, el primero falla sin bajar el servicio y el segundo
  queda live (pasó con `--require` → `--import`, `ERR_REQUIRE_ASYNC_MODULE`). Mirá
  `render deploys list` antes de dar el deploy por bueno.
- **Un solo hook de `import-in-the-middle`, registrado antes de cargar OTel y Sentry**: Sentry va con
  `registerEsmLoaderHooks: false` y se importa después de que el loader confirmó qué envolver. Si se
  carga antes, su `node:http` queda sin instrumentar (sin `http.client.request.duration`).
- **`envVars` de Render es un solo balde para build y start**: `NODE_ENV` va inline en el comando
  (`test/render-config.test.ts`).
- **Sentry v10 registra sus propios globals de OTel**: `skipOpenTelemetrySetup: true`, o los traces
  se pierden sin error. Con eso nadie instala su `SentryContextManager`: lo pone `initSentry`, o
  todos los eventos salen con la request de la primera.
- **Sin `diag.setLogger` un exporter OTLP que falla no dice nada**.
- **El wizard OTLP de Grafana da el header sin `Authorization=Basic%20`**: hay que anteponérselo.
- **Detrás de Render, `TRUST_PROXY_HOPS=1`**: con 0 todos comparten balde, con `true` se falsifica
  (D-045).
- **Contra R2, `S3_REGION=auto` y `S3_FORCE_PATH_STYLE=false`**: los defaults son de MinIO.
- **Dos seeds, el mismo mundo** (`db/demo.ts`): `db:seed` es el local, con las passwords del repo,
  ignora `SEED_*` y no corre fuera de un SQLite en disco; `db:seed:produccion` exige
  `SEED_ADMIN_PASSWORD`/`SEED_DEMO_PASSWORD` y nunca las imprime (D-047). Los dos reescriben el
  `passwordHash`.
- **El puerto sale de `PORT` en `apps/api/.env`.**
- **El entorno se lee con `entorno()` (`platform/config.ts`), nunca con `process.env.X`**: una
  variable nueva va al schema con su parseo y su default, y a `render.yaml`. `entorno()` lee el
  `process.env` del momento: se llama donde se usa (al importar o por llamada), no se guarda en un
  módulo aparte. Ninguna variable tira ahí: lo que frena el arranque lo decide quien la usa, y lo mal
  formado sale en el log de arranque (`avisosDelEntorno`).

## Tests

Vitest + supertest contra una SQLite propia que `test/global-setup.ts` crea con las migraciones
reales y el mismo runner de producción. Nunca contra `.data/dev.db`.

## Comandos

```bash
pnpm --filter @plataforma/api dev            # solo la API; antes migra la base si es local
pnpm --filter @plataforma/api db:migrate     # aplica las migraciones pendientes
pnpm --filter @plataforma/api db:seed        # datos demo en la base local (passwords del repo)
pnpm --filter @plataforma/api db:seed:produccion  # la demo desplegada: RUNBOOK §1.3
pnpm --filter @plataforma/api test:s3        # storage contra MinIO — NO corre en CI
pnpm --filter @plataforma/api docs:api       # regenera la colección Postman de specs/evidencia-m3/2-api/
pnpm --filter @plataforma/api docs:openapi   # regenera el OpenAPI de specs/evidencia-m3/2-api/
```

Una migración nueva se escribe a mano en `migrations/*.sql`, con `--> statement-breakpoint` entre
statements. No hay `db:generate` ni `db:studio` (D-049).
