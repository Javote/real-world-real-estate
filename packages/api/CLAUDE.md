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

- **Prisma ≥6.16 ya no carga `.env` desde el client.** Todo entrypoint que use `PrismaClient`
  fuera del server necesita `import "dotenv/config"` primero (el server ya lo hace en `app.ts`).
  El CLI de Prisma (`migrate`, `studio`) sí lo sigue cargando solo.
- **`@types/express` v5 con Express 4 rompe el typecheck** (21 errores `string | string[]` en
  `req.params`). Está pineado a `^4.17.21`: no lo "actualices" por su cuenta.
- **El warning de `url.parse()` deprecado al arrancar viene de Multer 1.x**, no del código.
  Inofensivo; migrar a Multer 2.x requiere decisión nueva.
- **El puerto sale de `PORT` en `packages/api/.env`** (lo escribe `scripts/worktree.sh` por árbol).
  No lo hardcodees.

## Deuda que bloquea la puerta

**No hay script `test`**, así que `pnpm -r test` saltea este paquete en silencio y la puerta no
puede verificar la API. Por eso `scripts/gate.sh` **falla** si tocás este paquete: la deuda
bloquea a quien la usa. Se cierra en SPEC-008.

## Comandos

```bash
pnpm --filter @plataforma/api dev            # solo la API
pnpm --filter @plataforma/api db:generate    # tras tocar el schema
pnpm --filter @plataforma/api db:migrate     # migración nueva (nunca editar una aplicada)
pnpm --filter @plataforma/api db:seed        # datos demo
pnpm --filter @plataforma/api db:studio      # inspeccionar la base
```
