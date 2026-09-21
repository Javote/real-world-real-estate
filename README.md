# PropNexus — Anclaje de Evidencia Inmobiliaria sobre Cardano

> Catalyst Fund Project **1400106** — *Real-World Real Estate Pre-Sale with Proof & Release*.

Ventas inmobiliarias en pozo: estructura el ciclo de obra en **stages**, organiza la **evidencia**
(planos, fotos, permisos, certificados) y ancla **huellas criptográficas** (SHA-256 / Merkle) en
Cardano con timestamps verificables. Cuatro roles con superficie propia: **investor**, **developer**,
**notary**, **certifier**.

**El problema.** Hoy es imposible verificar el estado de los trámites de una obra en pozo: la
evidencia está dispersa en canales informales y nada garantiza que lo que se muestra hoy sea lo que
existía ayer. Esa opacidad ya causó daño económico real a compradores.

**Lo que la plataforma NO hace.** No certifica, no valida y no decide nada. No custodia ni transfiere
dinero, en ninguna fase (D-021). No sustituye registros públicos, procesos notariales ni
autorizaciones estatales. Solo puede sostener cuatro afirmaciones: *este archivo tiene este hash* ·
*se registró en este momento* · *declara provenir de esta autoridad externa* · *esta persona
atestiguó haberlo revisado* (D-026).

**Stack.** pnpm monorepo: TanStack Router + Vite (web, SPA) · Express 5 + Kysely (api) · Aiken /
Plutus V3 (contratos) · SQLite en dev, Turso en prod · Cardano **Preprod siempre** (D-013).

## Arranque rápido

Node ≥ 22.12 y pnpm ≥ 9 (`corepack enable`). Para los contratos, Aiken v1.1.21
(`curl --proto '=https' --tlsv1.2 -LsSf https://install.aiken-lang.org | sh && aikup install v1.1.21`).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # completar JWT_SECRET: openssl rand -hex 32
pnpm db:migrate                          # crea la SQLite de dev
pnpm db:seed                             # usuarios y proyecto demo
pnpm dev                                 # web en :3000, api en :8787
```

**En `/login` no hace falta tipear nada:** tocar la solapa del rol prefilla usuario y contraseña.

| Solapa | Usuario | Aterriza en |
|---|---|---|
| Developer | `developer@example.com` / `developer123` | `/developer` |
| Certifier | `verifier@example.com` / `verifier123` | `/certifier` |
| Notary | `notary@example.com` / `notary123` | `/notary` |
| Investor | `buyer@example.com` / `buyer123` | `/investor/buy` |

El **admin** (`admin@example.com` / `admin123`) no tiene solapa: se tipea el usuario y aterriza en
`/admin`, desde donde entra a los cuatro paneles e invita certifiers a los proyectos (D-095).

Son credenciales **de desarrollo y publicadas**: el seed solo las usa contra un SQLite local, y
contra cualquier otra base se niega a correr sin `SEED_ADMIN_PASSWORD` (D-047).

## Verificación

```bash
pnpm verify        # lint + typecheck + trazabilidad de test IDs + tests + build
pnpm verify:all    # lo anterior, encadenado con la suite de Aiken
```

Es lo mismo que corre el CI, y nada se commitea sin que dé verde. `pnpm --filter @plataforma/api
test:s3` y `test:yaci` corren contra infraestructura real y **no** están incluidos: van a mano. Cada
uno levanta el contenedor que necesita y lo baja al terminar, así que alcanza con tener Docker
corriendo. Si ya lo tenías levantado, lo usan y lo dejan como estaba.

## Dónde vive todo

Deliberadamente **tres archivos en la raíz y nada más** —este, `CLAUDE.md` y `DECISIONS.md`—; el
resto vive indexado en una carpeta. **El mapa completo de qué vive dónde está en `CLAUDE.md`
§Estructura**, y no se copia acá: una copia diverge del original en silencio.

Lo mismo con las variables de entorno. La referencia es
[`apps/api/.env.example`](apps/api/.env.example) y [`apps/web/.env.example`](apps/web/.env.example).

## Deploy

Free tier, **$0/mes**, y eso es una restricción de arquitectura y no de presupuesto (D-040). El
artefacto es `render.yaml`: dos servicios en Render contra Turso, evidencia en Cloudflare R2.
Procedimiento completo en [`specs/RUNBOOK-deploy.md`](specs/RUNBOOK-deploy.md).

## Este repositorio es público

No contiene, en ninguna carpeta, secretos, credenciales, claves de wallet ni datos personales: los
secretos viajan **solo por variables de entorno** y nunca se versionan (regla 12 de `CLAUDE.md`).

Nunca versionado: `apps/api/.env`, `apps/web/.env`, `apps/api/.data/` (bases SQLite locales),
`apps/api/uploads/` (evidencia de runtime) y `apps/web/e2e/.artifacts/`.

La clave de la wallet de servicio y la API key de Blockfrost se configuran por entorno en el
proveedor de deploy y **no existen en el repositorio**.
