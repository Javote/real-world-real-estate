# packages/api — la API

> Se carga solo al tocar este subárbol. Las reglas duras (Zod, dos capas de auth, `AuditLog`,
> bcrypt, uploads, idempotencia, claves de traducción) están en el `CLAUDE.md` de la raíz y **no
> se repiten acá**.

Express 4 + Zod + JWT + bcrypt(10) + Multer 1.x + Prisma/SQLite, base `/api/v1` (D-016).

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
  Es la punta visible de algo que importa más: `bcrypt` es un **módulo nativo**, así que la imagen
  Docker va a necesitar toolchain de compilación. Ver `specs/stack.md` §11.
- **`pnpm install` se lleva puesto el cliente Prisma generado.** Después de cualquier install,
  `node_modules/.prisma/client` desaparece y el typecheck falla con "Module '@prisma/client' has no
  exported member 'UserRole'" — que **parece** un problema de resolución de módulos y no lo es.
  Antes de tocar `moduleResolution` por ese error, corré `pnpm --filter @plataforma/api db:generate`.
  La puerta lo regenera sola si falta.
- **El puerto sale de `PORT` en `packages/api/.env`** (lo escribe `scripts/worktree.sh` por árbol).
  No lo hardcodees.

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
