# packages/api — la API

> Se carga solo al tocar este subárbol. Las reglas duras (Zod, dos capas de auth, `AuditLog`,
> bcrypt, uploads, idempotencia, claves de traducción) están en el `CLAUDE.md` de la raíz y **no
> se repiten acá**.

Express 4 + Zod + JWT + bcrypt(10) + Multer 2.x + Drizzle/SQLite (`@libsql/client`), base `/api/v1`
(D-016, D-036, D-048 — migrado de Prisma el 2026-08-21).

Está mejor parada que el frente: **la API se evoluciona, el front se reemplaza.** Se conservan
auth JWT+bcrypt con autorización en dos capas, SHA-256 en el servidor al subir, `AuditLog`
append-only y el shape de `Project`/`Evidence`.

## Antes de tocar un endpoint

`M2-D5` §4-6 trae el path exacto, los test IDs y el work stream; `M2-D6` §9 el baseline. Los paths
van **scopeados por rol** (`/investor/`, `/developer/`, `/notary/`, `/certifier/`) — de los ~80
endpoints del backlog **hoy conforman 2**: `POST /auth/login` y `GET /auth/me`.

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
- **2026-08-20 · Un `import()` dinámico en un test necesita la extensión `.js`.** `packages/api`
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
- **El puerto sale de `PORT` en `packages/api/.env`** (lo escribe `scripts/worktree.sh` por árbol).
  No lo hardcodees.

## Superficie 🔴 — inventario

> 🔴 = **el humano lidera y escribe; el LLM asiste**, y el revisor tiene que poder explicar cada
> línea sin mirar el chat (`CLAUDE.md` raíz §Niveles de autonomía). **Hoy el 100% del código 🔴 del
> proyecto vive en este package.** Auditado el 2026-08-20 leyendo los 27 endpoints, no estimado.

| Archivo | Qué lo hace 🔴 | Estado |
|---|---|---|
| `lib/jwt.ts` | manejo de la clave de firma | ✔ cerrado 2026-08-20 — sin fallback (D-042, `SPEC-010`) |
| `routes/auth.routes.ts` | bcrypt en login | ✔ cerrado 2026-08-20 — hash dummy (`SPEC-010`) |
| `routes/users.routes.ts` | bcrypt al crear y al cambiar password | ✔ correcto (cost 10, nunca se loguea ni se devuelve) · política endurecida 2026-08-21 (D-046) |
| `middlewares/auth.ts` · `canAccessProject` | la lógica de membresía | ✔ correcto · fail-closed desde 2026-08-21 · falta que sea middleware |
| `utils/hashing.ts` | SHA-256 de evidencia | ✔ correcto · R2 lo va a mover |
| `SERVICE_WALLET_SEED`, construcción de commitments | — | **no existen todavía** (`packages/cardano` vacío) |

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
`packages/api/.env`: es el comportamiento buscado, no una regresión.

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

**Mitigado el 2026-08-21, no resuelto · es una función que hay que acordarse de llamar**, no un
middleware que no se puede olvidar. `scripts/check-project-access.py` corre en la sección 1 de la
puerta y falla nombrando el endpoint: *una ruta con parámetro en el path, o que liste proyectos,
necesita `canAccessProject`/`projectScope` o ser admin-only* — y `requireRole("admin", "developer")`
no cuenta como admin-only. Eso vuelve ruidoso el olvido; no lo vuelve imposible (D-044). La forma
sigue abierta: `requireRole` está en la cadena o no está; `canAccessProject` devuelve un booleano
que alguien tiene que chequear. Un endpoint nuevo que se olvide **no tiene segunda capa, y nada lo
detecta**: ni el compilador, ni un test, ni la puerta. Hoy son 27 endpoints y el backlog son ~80, así
que el momento barato de cambiar la forma es **antes** de la tanda grande, no después. Default
propuesto: un `requireProjectAccess(...)` de Express que lea `req.params.projectId`. Dueño: humano
(`specs/SPEC-010` §Preguntas abiertas).

**Cerrado el 2026-08-21 · la regla estaba escrita tres veces.** `canAccessProject`, el bypass de
`admin` repetido en 5 call sites, y un query a mano en `GET /projects` que no llamaba a la función.
Las tres coincidían por casualidad y solo una tenía tests. Ahora hay una sola —`projectScope`, una
condición `SQL` de Drizzle (`EXISTS` correlacionado, D-048)— que `canAccessProject` aplica a un id y el listado aplica a la
colección; el bypass de admin vive adentro y en ningún otro lado. Al unificarlas cayeron dos bugs de
la copia: el listado de un no-admin salía sin orden, y un usuario con dos membresías en el mismo
proyecto lo veía **duplicado**. Ojo con la consecuencia deliberada: `admin` sobre un proyecto que no
existe ahora da `false`, no `true`. Todo en D-043.

**Deuda que queda a la vista acá.** `GET /projects` sigue leyendo `status` y `city` de la query sin
Zod (`String(status) as any`). No es autorización y no es 🔴, pero es la regla 6 sin cumplir en el
único lugar donde el body no aplica.

### El SHA-256 se mueve cuando llegue R2

`sha256File` streamea y está correcto, pero hashea **un archivo ya escrito en disco**. D-040
convirtió R2 en prerequisito del primer deploy: cuando eso pase, el hash tiene que cubrir
exactamente los bytes que terminan en el object storage, no un temporal que después se sube. Es
🔴 por definición y es el momento donde estas cosas se rompen.

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
(`test.db`), que `test/global-setup.ts` crea aplicando las migraciones de Drizzle y siembra en
cada corrida. Nunca contra `dev.db`: un test no puede depender del seed de desarrollo ni ensuciarlo.

Se aplican las migraciones reales (`drizzle/*.sql`) y no una proyección ad-hoc del schema: así la
suite verifica lo mismo que va a correr en producción.

## Comandos

```bash
pnpm --filter @plataforma/api dev            # solo la API
pnpm --filter @plataforma/api db:generate    # tras tocar src/db/schema.ts — genera la migración SQL
pnpm --filter @plataforma/api db:migrate     # aplica las migraciones pendientes (nunca editar una aplicada)
pnpm --filter @plataforma/api db:seed        # datos demo
pnpm --filter @plataforma/api db:studio      # inspeccionar la base (drizzle-kit studio)
```
