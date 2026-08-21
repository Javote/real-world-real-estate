# packages/api — la API

> Se carga solo al tocar este subárbol. Las reglas duras (Zod, dos capas de auth, `AuditLog`,
> bcrypt, uploads, idempotencia, claves de traducción) están en el `CLAUDE.md` de la raíz y **no
> se repiten acá**.

Express 4 + Zod + JWT + bcrypt(10) + Multer 2.x + Prisma/SQLite, base `/api/v1` (D-016, D-036).

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
2. Ruta con `requireRole` + `canAccessProject` (🔴 `canAccessProject` lo lidera el humano).
3. `safeParse` → 400 con `error.flatten()`.
4. `writeAuditLog` si es mutación relevante.
5. Test del camino feliz y de cada rechazo.
6. Path y test ID **idénticos** a los de M2-D5.

## Trampas verificadas

- **2026-08-20 · `storagePath` se filtraba en las cuatro respuestas de `/evidence`.** D-011 dice
  explícitamente que la clave de almacenamiento jamás se expone, pero `POST/GET/GET-by-id/PATCH
  /evidence` devolvían el registro Prisma completo — incluida la ruta absoluta en disco del
  servidor. Se detectó leyendo la ruta al migrar Multer, no por un test (no había ninguno).
  **Fix:** `omit: { storagePath: true }` en cada query que responde al cliente
  (`evidence.routes.ts`); las dos rutas que sí necesitan la ruta real internamente (`download`,
  `delete`) siguen consultándola sin `omit`, porque nunca la devuelven en el body. Cualquier
  endpoint nuevo que toque `Evidence` tiene que repetir el `omit` — no hay un select compartido
  todavía porque la superficie es chica; si crece, vale la pena centralizarlo.
- **Prisma ≥6.16 ya no carga `.env` desde el client.** Todo entrypoint que use `PrismaClient`
  fuera del server necesita `import "dotenv/config"` primero (el server ya lo hace en `app.ts`).
  El CLI de Prisma (`migrate`, `studio`) sí lo sigue cargando solo.
- **`@types/express` v5 con Express 4 rompe el typecheck** (21 errores `string | string[]` en
  `req.params`). Está pineado a `^4.17.21`: no lo "actualices" por su cuenta.
- **El warning de `url.parse()` deprecado al arrancar viene de `bcrypt`**, vía
  `@mapbox/node-pre-gyp`, no de Multer ni del código propio. El repo lo atribuyó a Multer durante
  meses y era falso: se comprobó con `tsx --trace-deprecation`, y sobrevivió intacto a la
  migración a Multer 2 (D-036). **Antes de atribuir un warning, trazalo.**
  Es la punta visible de algo que importa más: `bcrypt` es un **módulo nativo**. El argumento caro
  (toolchain en la imagen Docker) murió con D-041 — no hay imagen. Ver §Superficie 🔴 y
  `specs/stack.md` §11.
- **`pnpm install` se lleva puesto el cliente Prisma generado.** Después de cualquier install,
  `node_modules/.prisma/client` desaparece y el typecheck falla con "Module '@prisma/client' has no
  exported member 'UserRole'" — que **parece** un problema de resolución de módulos y no lo es.
  Antes de tocar `moduleResolution` por ese error, corré `pnpm --filter @plataforma/api db:generate`.
  La puerta lo regenera sola si falta.
- **El puerto sale de `PORT` en `packages/api/.env`** (lo escribe `scripts/worktree.sh` por árbol).
  No lo hardcodees.

## Superficie 🔴 — inventario

> 🔴 = **el humano lidera y escribe; el LLM asiste**, y el revisor tiene que poder explicar cada
> línea sin mirar el chat (`CLAUDE.md` raíz §Niveles de autonomía). **Hoy el 100% del código 🔴 del
> proyecto vive en este package.** Auditado el 2026-08-20 leyendo los 27 endpoints, no estimado.

| Archivo | Qué lo hace 🔴 | Estado |
|---|---|---|
| `lib/jwt.ts` | manejo de la clave de firma | ⚠️ **P1 abierto** — ver abajo |
| `routes/auth.routes.ts` | bcrypt en login | ⚠️ oráculo de tiempos abierto |
| `routes/users.routes.ts` | bcrypt al crear y al cambiar password | ✔ correcto (cost 10, nunca se loguea ni se devuelve) |
| `middlewares/auth.ts` · `canAccessProject` | la lógica de membresía | ✔ correcto hoy · forma frágil |
| `utils/hashing.ts` | SHA-256 de evidencia | ✔ correcto · R2 lo va a mover |
| `SERVICE_WALLET_SEED`, construcción de commitments | — | **no existen todavía** (`packages/cardano` vacío) |

### P1 · `JWT_SECRET` cae a un literal público

```js
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";   // lib/jwt.ts
```

Si la variable falta **o está vacía**, la API firma con un literal que está en el repo. Y
`.env.example` trae `JWT_SECRET=""`, que en JS es falsy: verificado, `"" || "dev-secret"` resuelve
al fallback. Con eso cualquiera forja `{userId, role:"admin"}` y lo firma. No es escalar
privilegios — es saltear la autenticación entera.

**Hoy no es explotable: no hay deploy.** El riesgo es que se arma solo el día que lo haya, y el free
tier de Render no da shell para ir a ver qué variables quedaron cargadas (D-040): fallaría en
silencio. **Esto bloquea el primer deploy** — se arregla antes de que exista una URL pública, no
después. Es además el criterio 11 del SOM (*sin hallazgos P1*).

Forma correcta: reventar al arrancar si falta. Sin fallback, nunca.

### El comentario del login promete más de lo que el código cumple

`auth.routes.ts` devuelve el mismo body para "no existe" y "password incorrecta", y el comentario
explica bien por qué. Pero **el tiempo de respuesta no es el mismo**: si el usuario no existe, corta
antes y nunca corre `bcrypt.compare`. Medido: **~81 ms de diferencia** en una máquina rápida.

El oráculo que el comentario dice cerrar sigue abierto — se consulta con un cronómetro en vez de
leyendo el body. Se cierra comparando contra un hash dummy cuando el usuario no está, para pagar
siempre el mismo costo.

### `canAccessProject`: bien hoy, con una forma que no escala

Auditados los 27 endpoints: **no hay agujeros**. `evidence` 6/6, `milestones` 6/6, y los de
`projects` que no lo llaman son admin-only o filtran por membresía en el query (el listado scopea
correctamente a no-admins). Dicho eso, dos cosas de **forma**:

1. **Es una función que hay que acordarse de llamar**, no un middleware que no se puede olvidar.
   `requireRole` está en la cadena o no está; `canAccessProject` devuelve un booleano que alguien
   tiene que chequear. Un endpoint nuevo que se olvide **no tiene segunda capa, y nada lo detecta**:
   ni el compilador, ni un test, ni la puerta. Hoy son 27 endpoints y el backlog son ~80.
2. **El 4º parámetro es opcional y omitirlo abre, no cierra.** Sin `allowedMemberships`, cualquier
   membresía pasa. Quien quiso decir "solo developer" y se olvidó del argumento obtiene "cualquier
   miembro", en silencio. Un default fail-open en la función 🔴 por excelencia.

Ninguna de las dos es un bug hoy. Las dos cobran cuando la superficie crezca, así que el momento
barato de cambiar la forma es **antes** de la tanda grande de endpoints, no después.

### El SHA-256 se mueve cuando llegue R2

`sha256File` streamea y está correcto, pero hashea **un archivo ya escrito en disco**. D-040
convirtió R2 en prerequisito del primer deploy: cuando eso pase, el hash tiene que cubrir
exactamente los bytes que terminan en el object storage, no un temporal que después se sube. Es
🔴 por definición y es el momento donde estas cosas se rompen.

### bcrypt: se queda nativo

El uso es correcto — cost 10 (regla 4), `compare` en login, `hash` al crear y al cambiar password,
y `auth.routes.ts` tipa la respuesta explícitamente para que `passwordHash` no se escape por un
spread distraído.

Sobre `bcrypt` vs `bcryptjs`, la recomendación **se dio vuelta** y conviene saber por qué: D-041
mató el argumento caro (sin Docker, no hay toolchain que meter en una imagen), y apareció un dato
nuevo — **Render free da 0.1 CPU**, donde los ~81 ms de una máquina rápida se van a varios cientos,
y `bcryptjs` es ~30% más lento encima de eso. Queda el warning de `url.parse()` (ver Trampas) y el
riesgo genérico de módulo nativo. **Bajar el cost no es opción: la regla 4 fija 10.**


## Tests

`pnpm --filter @plataforma/api test` — vitest + supertest contra **una base SQLite propia**
(`prisma/test.db`), que `test/global-setup.ts` crea con `prisma migrate deploy` y siembra en cada
corrida. Nunca contra `dev.db`: un test no puede depender del seed de desarrollo ni ensuciarlo.

Se usa `migrate deploy` y no `db push` a propósito: así la suite verifica las migraciones reales
que van a correr en producción, no una proyección del schema.

## Comandos

```bash
pnpm --filter @plataforma/api dev            # solo la API
pnpm --filter @plataforma/api db:generate    # tras tocar el schema
pnpm --filter @plataforma/api db:migrate     # migración nueva (nunca editar una aplicada)
pnpm --filter @plataforma/api db:seed        # datos demo
pnpm --filter @plataforma/api db:studio      # inspeccionar la base
```
