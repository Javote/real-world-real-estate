# PROPUESTA-2026-09-30 — Refactor estructural post-M3 (serie `6xx`)

> **Origen:** revisión de arquitectura de `apps/web` y `apps/api` pedida por el dueño el 2026-09-30,
> leyendo el código (no las decisiones) y midiendo contra producción. **Nada de esta serie es
> mandato mientras M3 no se entregue**: ninguna spec toca los 16 criterios del SOM. Se numera en
> `6xx` porque `5xx` es Milestone 4 y la numeración no se recicla.

## La arquitectura, como está hoy

```
 Navegador ──HTTPS──▶ propnexus-web   Render static site: index.html + chunks JS
     │
     │ fetch + Authorization: Bearer <JWT>   (CORS, otro origen)
     ▼
 propnexus-api   Render free, región Oregon — Express 5 (carcasa) + oRPC (handlers) + Zod
     ├──▶ Turso (libSQL), AWS us-east-1, vía Kysely
     ├──▶ Cloudflare R2 (evidencia)
     └──▶ Blockfrost → Cardano Preprod (anclaje)
```

- **Web:** SPA sin SSR (D-065). React 19 + Vite 8 + TanStack Router (rutas por archivo,
  `autoCodeSplitting`) + TanStack Query. Todo `fetch` pasa por `src/api/port.ts`. Sesión (token +
  usuario) en `sessionStorage`; idioma en `localStorage`; datos de servidor en la caché de Query.
  **Ninguna ruta tiene `loader` ni `beforeLoad`.**
- **API:** Express resuelve CORS, helmet, rate limit y los guards (`authenticate` + `authorize`,
  legibles por `route-guards.test.ts`); casi todo handler es un procedimiento oRPC con input/output
  Zod, conectado por `delegarAOrpc`. `authenticate` relee `User` en cada request.
- **Contrato:** `packages/shared` (Zod). La web usa solo sus tipos.

## Del login a la primera pantalla, medido

Recorrido de un buyer (`/login` → `/investor/buy`):

| # | Qué | Viajes a Turso |
|---|---|---|
| 1 | `POST /auth/login` (+ preflight): `SELECT User`, `bcrypt`, `INSERT AuditLog` | 2 |
| 2 | Navegación → baja el chunk de `/investor/buy` | — |
| 3 | La pantalla renderiza **`null`** (`useRoleGuard`, `ready=false`) | — |
| 4 | `GET /auth/me` (+ preflight): `authenticate` + handler | 2 |
| 5 | `ready=true` → en paralelo `GET /projects`, `/investor/favorites`, `/notifications/unread-count` | 2 c/u |

**En el camino crítico hay 5 viajes navegador↔API y ~6 viajes API↔Turso en serie.** Medido contra
producción el 2026-09-30 (6 muestras cada una, en caliente):

| Request | Mediana |
|---|---|
| `GET /api/v1/no-existe` (404, no toca la base) | ~0.28 s |
| `GET /health` (`SELECT 1`) | ~0.40 s |
| **Diferencia ≈ un viaje a Turso** | **~90–120 ms** |
| Primera request con el servicio dormido | **95.9 s** |

Y los pasos 3–5 **se repiten en cada navegación**, no solo después del login: 40 de las 44 rutas
llaman a `useRoleGuard`, que pide `/auth/me` sin caché y pinta en blanco hasta que vuelve.

## Lo que está bien y no se toca

- **El contrato único en Zod** y la validación de input *y* output en la API.
- **`authorize` declarativo, marcado con `GUARD`, auditado por `route-guards.test.ts`.** Lo que
  vale es que la matriz de permisos se pueda **leer desde un test**, no que viva en Express.
  `SPEC-607` la muda a la `meta` de cada procedimiento con la misma `MATRIZ` (ver §Decisiones
  reabiertas).
- **Un prefijo por router** (`MONTAJE`), el arranque que no espera al `AnchorPort`, el healthcheck
  que consulta la base, el cierre ordenado.

## La serie

| Spec | Qué | Nivel | Depende de | Cuándo |
|---|---|---|---|---|
| [`SPEC-601`](archive/SPEC-601-el-guard-de-rol-vive-en-el-router.md) | El guard de rol pasa al router: `beforeLoad` por rol y `me` cacheado | 🟡 | — | post-M3 |
| [`SPEC-602`](archive/SPEC-602-los-datos-arrancan-con-la-ruta.md) | Loaders que precargan: los datos arrancan con la ruta y el preload por intent sirve | 🟢 | 601 | post-M3 |
| [`SPEC-603`](SPEC-603-la-api-y-la-base-en-la-misma-region.md) | La API y la base en la misma región | 🟡 | — | post-M3, la más barata |
| [`SPEC-604`](archive/SPEC-604-la-capa-de-datos-sale-de-los-routers.md) | Las lecturas repetidas salen de los routers (`queries/<entidad>.ts`), sin partir routers por largo (`SPEC-015` §6) | 🟢 | — | con la primera feature que las necesite |
| [`SPEC-605`](SPEC-605-la-cadena-fuera-del-camino-de-la-request.md) | La cadena fuera del camino de la request (outbox) | 🟡 | decisión del dueño | **condicional**: contradice D-077 |
| [`SPEC-606`](SPEC-606-la-sesion-por-pestana.md) | La sesión: por pestaña, legible por JS, y un logout que el servidor no se entera | 🟡 | decisión del dueño | **condicional** |
| [`SPEC-607`](SPEC-607-una-sola-capa-de-api.md) | Una sola capa de API: el contrato en `shared` y los guards como `meta` de cada procedimiento. Express queda como carcasa de transporte | 🟡 | — | post-M3 · **reabre `SPEC-212` inv. 3** |
| [`SPEC-608`](archive/SPEC-608-los-archivos-por-concepto.md) | Los archivos de la API por concepto, no por prefijo | 🟢 | 607 | post-M3 |
| [`SPEC-609`](SPEC-609-el-cliente-sale-del-contrato.md) | El cliente de la web sale del contrato: `OpenAPILink` + `Serialized`, con `port.ts` como fachada | 🟢 | 607 | post-M3 · **reabre `SPEC-111`** |

**Orden sugerido:** `603` primero (es configuración y es la mejora de latencia más grande por
unidad de trabajo). Después `601` → `602` (se sienten en cada navegación). Después `607` con su
piloto `notary`, y ahí `608` y `609` en paralelo. `604` se disuelve en `608` si se hace esa, o va
sola si no. `605`/`606`, solo si se dispara su condición.

## Decisiones reabiertas (el dueño, 2026-09-30)

La primera versión de esta propuesta dejaba fuera la carcasa Express y el cliente oRPC, citando
`SPEC-212`, `SPEC-216` y `SPEC-111`. **El dueño pidió reabrirlos**, y la revisión, con experimentos
descartables sobre oRPC 1.15.2, muestra que las tres cosas son **una sola decisión**:

1. **La invariante 3 de `SPEC-212`** (guards en Express) era una regla de **migración segura**, no
   un destino. Probado: un guard como `meta` + un middleware oRPC da 200/403 bien, y la matriz se
   puede leer desde el router armado → `SPEC-607`.
2. **Partir los routers grandes** ya lo pedía la regla de `SPEC-015` §6 (partir por concepto). No
   se hacía por el costo de los guards de router compartidos, que `SPEC-607` elimina. `app.ts` mismo
   admite que agrupa por prefijo y no por concepto → `SPEC-608`.
3. **El cliente oRPC** era la mitad de D-066 que no se cumplió. De las tres objeciones de
   `SPEC-111`: el costo lo paga `SPEC-607`, Zod no entra con un contrato minificado en build, y las
   fechas se tipan honestas con `Serialized` (probado con `tsc` y una mutación) → `SPEC-609`.

## Lo que queda fuera, y por qué

| Qué | Por qué |
|---|---|
| **Reemplazar Express** (Hono, Fastify, el adaptador node de oRPC a secas) | Con `SPEC-607`, Express queda como carcasa de transporte (helmet, CORS, rate limit, Multer, Sentry). Otro framework no daría nada que esa carcasa no dé ya, y D-054/D-066 no tienen evidencia nueva para reabrirse |
| **`RPCLink` en la web** | Revive fechas, pero manda las requests a `/rpc/...` en lugar de los paths REST de M2-D5 (ver `SPEC-609`) |
| **Los dos `.tsx` sueltos en `apps/api/`** | No era refactor sino basura: copias huérfanas de `29bfce9`. Se borraron el 2026-09-30, en el mismo trabajo que abrió esta serie |
| **PWA** | Ya tiene su spec: [`SPEC-222`](SPEC-222-la-pwa-que-d-065-decidio.md) |
| **Mainnet** | `CLAUDE.md` §Antes de mainnet |
