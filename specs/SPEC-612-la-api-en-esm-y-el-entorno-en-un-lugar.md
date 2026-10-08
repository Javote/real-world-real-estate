# SPEC-612 — A0: la API en ESM y el entorno en un solo lugar

> Fase 2, paso A0 ([`SPEC-611`](SPEC-611-la-migracion-fase-2.md)); el estado, en
> [`specs/README.md`](README.md). Nivel 🟡: cambia el `startCommand` de Render y cómo arranca la
> observabilidad. **Sin cambio de comportamiento**: ni una respuesta, ni un path, ni el OpenAPI.

## Lo que hay hoy, medido el 2026-10-02

**CommonJS con paquetes ESM puros.** `apps/api` compila a CJS (`module: node16`, sin `"type"`), y
seis dependencias son ESM puro: `kysely`, `@libsql/client`, `@libsql/kysely-libsql`,
`@paralleldrive/cuid2`, y `@orpc/*`. Se cargan con `require()` (Node 22.12+ hace `require(esm)`) y
se tipan con `resolution-mode: "require"`:

| Archivo | Qué hace |
|---|---|
| `src/lib/kysely.ts` | `require("kysely")` y reexporta valores y tipos |
| `src/lib/libsql-client.ts` | `require("@libsql/client")` |
| `src/lib/libsql-dialect.ts` | `require("@libsql/kysely-libsql")` |
| `src/lib/orpc.ts` | `require` de `@orpc/openapi`, `@orpc/openapi/node`, `@orpc/server`, `@orpc/zod/zod4` |
| `src/db/id.ts` | `require("@paralleldrive/cuid2")` |
| `src/instrumentation.ts` | `require` de los 8 paquetes de OpenTelemetry, para cargarlos solo si hay endpoint |
| `test/helpers/orpc.ts`, `test/helpers/viajes.ts` | lo mismo en los tests |

Eso deja tres trampas en `apps/api/CLAUDE.md` (*"No cambies `moduleResolution`"*, *"Un `require()`
sin tipar saltea a `tsc`"*, *"Un `import()` dinámico en un test lleva `.js`"*).

**Más piezas que dependen de CJS:**

- `require.main === module` en `src/db/migrate.ts`, `src/db/seed.ts`,
  `scripts/generate-openapi.ts` y `scripts/generate-api-docs.ts`.
- `__dirname` en `src/lib/upload.ts`, `src/db/migrate.ts`, los dos scripts y cuatro tests.
- **706 imports relativos sin extensión** en `src/`, `test/` y `scripts/`, más 28 `import()`.
- **El arranque:** `--require ./apps/api/dist/src/instrumentation.js` en el `startCommand` de
  Render, en el smoke test de CI y en `pnpm dev` (`tsx watch --require ./src/instrumentation.ts`).
- **Render y CI corren Node 22** (`NODE_VERSION: "22"`); el `.nvmrc` dice `22.12.0`. Esta máquina
  tiene 24. `import.meta.main` no existe en 22.

**El entorno se lee en 12 archivos**, cada uno con su parseo: `app.ts` (`WEB_ORIGIN`), `server.ts`
(`PORT`), `lib/jwt.ts` (`JWT_SECRET`, falla al importar si falta), `middlewares/rateLimit.ts`
(`TRUST_PROXY_HOPS`, `LOGIN_RATE_LIMIT_MAX`, con fallback ante valores inválidos), `lib/anchor.ts`
(`ANCHOR_MODE`, `CARDANO_NETWORK`, `BLOCKFROST_*`, `SERVICE_WALLET_PRIVATE_KEY`, `DATABASE_URL`),
`lib/storage.ts` (`STORAGE_DRIVER`, `S3_*`), `lib/upload.ts` (`UPLOAD_DIR`), `lib/db.ts`,
`db/local-db.ts`, `db/migrate.ts`, `db/credentials.ts` (`DATABASE_*`, `SEED_*`) e
`instrumentation.ts` (`SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `NODE_ENV`).
**15 archivos de test cambian `process.env` en caliente** y esperan el efecto en la próxima llamada
(`DATABASE_URL` 20 veces, `ANCHOR_MODE` 12, `SENTRY_DSN` 7…).
`test/render-config.test.ts` busca con regex qué variables lee el código y exige que `render.yaml`
las declare.

## Alcance

Dos commits, en este orden. Cada uno se prueba entero (§Verificación) antes de commitear.

### A0.1 — ESM

1. `apps/api/package.json`: `"type": "module"`. `tsconfig.json`: `module` y `moduleResolution`
   `nodenext`.
2. **Los imports relativos llevan `.js`.** Es mecánico y lo exige `tsc`: un import sin extensión no
   compila con `nodenext`. Se hace con un script que reescribe y se borra; no queda en el repo.
3. **Los shims se van.** Todos los `require()` pasan a `import`. `kysely.ts` y `libsql-client.ts`
   quedan como reexport porque son costuras de tests (`vi.doMock` en `app-health-coverage` y
   `migrate-url-coverage`); `id.ts` y `libsql-dialect.ts`, sin `require`. Las cinco exclusiones de
   `biome.json` que existían por la sintaxis `resolution-mode` se van.
4. **`require.main === module`** pasa a un helper que compara `import.meta.url` con
   `process.argv[1]` (Node 22 no tiene `import.meta.main`). **`__dirname`** pasa a
   `import.meta.dirname`.
5. **La observabilidad arranca con `--import`, no con `--require`.** En ESM, `--require` no ve los
   módulos que carga el grafo ESM. `instrumentation.ts` registra **un solo** hook de
   `import-in-the-middle` (dependencia directa, la misma 3.4.0 que usan OTel y Sentry) antes de
   importar nada instrumentable; los paquetes de OTel pasan a `await import()` (condicional al
   endpoint, como antes), y **Sentry se importa después** de que OTel arrancó y el loader confirmó qué
   envolver, con `registerEsmLoaderHooks: false` para no registrar un segundo hook.
   Cambian el `startCommand` de `render.yaml`, el smoke de `.github/workflows/ci.yml` y `pnpm dev`.
   `render-config.test.ts` ya acepta `--import` en su chequeo de rutas con `./`.
6. **`packages/shared` y `packages/cardano` no cambian**: siguen en CommonJS (D-102). La API los
   importa desde ESM, y Node resuelve sus nombres exportados. Si algún nombre no se resuelve, se ve
   en el arranque con `node`, no en Vitest (por eso §Verificación arranca el build real).
7. **La documentación, en el mismo commit**: las tres trampas de `apps/api/CLAUDE.md` se reemplazan
   por las que dejen ESM; la mención a CommonJS de `apps/api/CLAUDE.md`, de
   `packages/shared/CLAUDE.md` y del comentario de `packages/shared/tsconfig.json` se corrige;
   `specs/RUNBOOK-deploy.md` y su versión en inglés (`specs/evidencia-m3/5-ops/runbook.md` + PDF)
   si citan el `startCommand`.

### A0.2 — El entorno en `platform/config.ts`

1. **Un schema Zod con todas las variables que lee la API** (`src/platform/config.ts`), y una
   función `entorno(env = process.env)` que lo parsea y devuelve el objeto tipado.
2. **Cada uno de los 12 archivos lee de `entorno()`** en vez de `process.env`, en el **mismo
   momento** en que lee hoy: lo que hoy se lee al importar (`JWT_SECRET`), se sigue leyendo al
   importar; lo que se lee por llamada (`ANCHOR_MODE`, `DATABASE_URL`), se sigue leyendo por llamada.
   Así los 15 tests que cambian `process.env` en caliente siguen andando sin tocarse.
3. **Cada campo reproduce el parseo de hoy, incluidos los valores inválidos.** Si hoy
   `TRUST_PROXY_HOPS=abc` cae al default, el schema cae al mismo default (`.catch`), no tira. Un
   test por campo fija el caso inválido contra el comportamiento de antes.
4. **`server.ts` llama a `entorno()` una vez al arrancar**, antes de escuchar, para que una variable
   mal formada se vea en el log de arranque y no en la primera request que la usa. Lo que hoy no
   frena el arranque, no lo frena después: solo se loguea.
5. **`render-config.test.ts` lee las variables del schema**, no con regex sobre el código.
6. Los scripts de `scripts/` (`repair-thread.ts`, los generadores) quedan con `process.env`: corren
   a mano, fuera del proceso de la API.

## Invariantes

1. **Ni una respuesta cambia.** Los tests de `apps/api` pasan sin cambiar ninguna expectativa.
2. **El OpenAPI y la colección Postman no cambian ni un byte** (`openapi-freshness.test.ts`,
   `api-docs-freshness.test.ts`).
3. **La observabilidad ve lo mismo que antes**: las mismas instrumentaciones de OpenTelemetry
   emiten spans (por nombre de scope) y Sentry recibe el mismo error. Se mide antes y después (§3).
4. **Arranca con el comando literal de Render, en Node 22.**
5. **La cobertura de `apps/api` no baja** del umbral de `vitest.config.mts`.

## Verificación

Antes de cada commit, todo esto en verde. Si algo no se puede correr, se dice cuál y por qué.

1. `pnpm verify:all`.
2. **El build y el arranque reales, en Node 22**: el `buildCommand` y el `startCommand` de
   `render.yaml` literales, sobre una base local migrada, y después:
   - `GET /health` 200;
   - login → `GET /auth/me` → una lectura con proyecto (`GET /projects/:id/stages`) → una mutación
     con audit, con las mismas respuestas que el build de antes (se guardan las dos y se comparan,
     sin los ids y fechas);
   - `pnpm db:seed` y `pnpm --filter @plataforma/api docs:openapi` corren desde el build nuevo.
3. **La observabilidad, antes y después.** Un colector OTLP mínimo en local (un `http.createServer`
   que guarda los `POST /v1/traces` en JSON), con `OTEL_EXPORTER_OTLP_ENDPOINT` apuntándolo, y un DSN
   de Sentry hacia otro servidor local que guarda los sobres. Se hace la misma secuencia de requests
   **con el build de `main` y con el nuevo**: el conjunto de `scope.name` de los spans (`http`,
   `express`, `undici`…) y los sobres de Sentry ante un 500 tienen que coincidir.
4. `pnpm e2e` completo (levanta la API con `pnpm dev`, que también cambia).
5. `pnpm --filter @plataforma/api test:s3` contra MinIO (storage es uno de los 12 archivos de A0.2).
6. En producción, después del deploy: `/health`, un login y un trace nuevo en Tempo.

## A0.1, medido el 2026-10-02

Con un arnés descartable: la base de `main` y la nueva buildeadas cada una con el `buildCommand`
literal en un worktree limpio, en Node 22, y arrancadas con el `startCommand` literal contra la misma
base sembrada. Cada corrida hace **683 requests**: login de los cinco roles, todas las rutas GET del
OpenAPI con cada rol y sin sesión, antes y después de 13 mutaciones (perfil, favorito, notificación,
transición de etapa, subida de evidencia real y falsa, alta de proyecto, compartir y firmar un
dossier), más un 500 forzado. Dos corridas de la misma build dan idéntico: el arnés no mete ruido.

| Escenario | Respuestas (status + cuerpo) | OpenTelemetry | Sentry |
|---|---|---|---|
| DSN + endpoint | idénticas | mismas instrumentaciones y cantidad de spans de `http`, `express` y `router`; las mismas 17 métricas | los mismos 3 eventos |
| solo DSN | idénticas | — | los mismos 3 eventos e integraciones |
| solo endpoint | idénticas | idéntico | — |
| ninguna | idénticas | — | — |

**Lo que cambió, y por qué está bien:**

- **En CommonJS, Sentry instrumentaba Express dos veces.** Cada request daba el doble de spans de
  `@sentry/node` (1.370 `helmetMiddleware` para 685 requests) con la ruta repetida
  (`/api/v1/auth/api/v1/auth/login`), y los spans de `router` salían con un nombre de más
  (`middleware - patched`). En ESM es una vez: 685 para 685 y `/api/v1/auth/login`. El total de spans
  de `router` es el mismo (4.314).
- **El log de OTel sale antes que el de Sentry**, porque Sentry ahora se carga después. Por eso los
  eventos de Sentry traen una miga de consola menos al principio.
- **Las migas `http` de Sentry** son los POST del exporter OTLP: su cantidad depende de cuándo se
  vacía el lote, en las dos builds.

**Lo que se probó además:** `pnpm verify:all` (la API sigue en 100/100/100/100; los tests pasan de
771 a 775 por los 4 de `esPuntoDeEntrada`), `pnpm e2e` 100/100 con `pnpm dev`, `test:s3` 6/6 contra
MinIO, migrate + seed sobre una base vacía con el build nuevo (mismo esquema y mismos conteos que
`main`), `db:migrate` y `db:seed` por `tsx`, y `docs:openapi`/`docs:api` sin un byte de diferencia.

**Un intento que no sirvió:** registrar el hook solo para OTel y dejar que Sentry registre el suyo.
Quedan dos registros (Node avisa *"The 'import-in-the-middle' hook has already been initialized"*) y,
con Sentry cargado antes del hook, falta `http.client.request.duration`.

**En producción** (`cb7197a`, live el 2026-10-02 22:11 UTC): el push disparó dos deploys. El
autodeploy arrancó con el `startCommand` viejo del dashboard (`--require`) y falló con
`ERR_REQUIRE_ASYNC_MODULE` sin pasar a live; el sync del Blueprint trajo `--import` y ese quedó live,
con OTel y Sentry activos y los logs limpios. La trampa quedó en `apps/api/CLAUDE.md`.

**Dos bugs que ya estaban en CommonJS**, iguales en las dos builds, arreglados después en un commit
aparte (2026-10-02):

- **Un JSON mal formado respondía 500** y llegaba a Sentry: `errorHandler` no reconocía los errores
  de `http-errors` del parser. Ahora es 400 (y un body demasiado grande, 413).
- **Todo evento de Sentry decía venir de `GET /health`**: con `skipOpenTelemetrySetup` nadie instalaba
  el `SentryContextManager`, y todas las requests compartían un isolation scope. Ahora cada evento
  trae su request y su `transaction`. Medido contra producción con el mismo arnés: de las 683
  requests solo cambia la del JSON mal formado, y OpenTelemetry da idéntico (spans por scope, tipo,
  padre y nombre, y las 17 métricas).

## A0.2, medido el 2026-10-07

En `main` desde el 2026-10-07 (`5f07934`) y en producción con `fb81ba9`. `platform/config.ts` tiene 27 variables, cada una con
el parseo literal que tenía en su archivo (`parseInt` con fallback, `??` contra `||`, `=== "true"`);
`platform-config.test.ts` fija 55 casos (ausente, vacía e inválida) y exige uno por campo. Las funciones
que ya recibían el entorno por parámetro (`trustProxyHops(env)`, `urlDeLaBase(env)`…) lo siguen
recibiendo, y los 15 tests que cambian `process.env` en caliente no se tocaron.

**Lo que agrega:** `server.ts` loguea al arrancar lo mal formado, con el valor que usa en su lugar y sin
el crudo (`[arranque] TRUST_PROXY_HOPS no tiene la forma esperada (^\d+$); se usa 3`), y no frena.
`render-config.test.ts` lee las variables del schema y suma un test que se pone rojo si un archivo de
`src/` lee `process.env.X` suelto (probado en rojo con una mutación). Los `SEED_*` entran al schema y a
las opcionales de ese test: el seed de producción corre a mano.

**Verificado:** la API en 100/100/100/100 (857 tests); `pnpm precommit`; el e2e 100/100 con la API sin
`watch`. Con el mismo arnés de A0.1, la build de `main` (`0cda4d9`) y la nueva, cada una con el
`buildCommand` y el `startCommand` literales en Node 22.23.3 y la misma base sembrada, con DSN y
endpoint OTLP locales: **653 requests idénticas** (status y cuerpo, sin ids ni fechas: 246 × 200,
58 × 400, 104 × 401, 239 × 403, un 404 y un 500 provocado), los mismos spans por scope
(`http` 653, `express` 4.070, `router` 4.832, `@sentry/node` 4.723), el mismo evento de Sentry ante el
500 y las mismas líneas de log de arranque. Sin DSN ni endpoint, arranca con los dos apagados y
`/health` 200.

**`test:s3`, corrido el 2026-10-07:** 6/6 contra MinIO, con `80a3bed`, y con
`COMPOSE_PROJECT_NAME=propnexus-s3` porque el Docker local tenía un contenedor de MinIO que
`docker ps -a` lista pero `inspect` y `rm` no encuentran, y `compose up` falla al recrearlo. Es un
problema de la máquina, no del código. De lo de producción (§Verificación 6), `/health` da 200
con `fb81ba9`; faltan un login y un trace nuevo en Tempo.

## Rollback

Revertir el commit y redeployar. No toca la base ni el estado de los navegadores.
