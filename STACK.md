# STACK.md — Stack técnico canónico

**Por qué existe este archivo.** Los entregables oficiales en `docs/` son deliberadamente
agnósticos de stack: el único requisito técnico que el proyecto comprometió es que los smart
contracts sean en **Aiken**. Framework web, ORM, base de datos, almacenamiento y hosting son
decisiones nuestras, y por lo tanto **cambiables sin tocar un entregable**. Este archivo es la
respuesta canónica y única a "¿con qué está hecho esto?".

**Precedencia.** `DECISIONS.md` decide; `STACK.md` describe el estado vigente. Cada fila cita la
decisión que la fijó. Si ambos se contradicen, manda `DECISIONS.md` y esta tabla está
desactualizada: corregirla en el mismo PR.

**Cambiar el stack requiere una `D-0XX` nueva**, no una edición de este archivo.

---

## Lo que es requisito oficial (no negociable sin renegociar el proyecto)

| Requisito | Fuente |
|---|---|
| Smart contracts en **Aiken** | Compromiso del proyecto Catalyst 1400106 |
| Anclaje en **Cardano** | M1-D1 §System Overview, §On-Chain/Off-Chain Boundaries |
| Documentos y PII **fuera de la cadena** | M1-D1 §Privacy Boundaries; M2-D6 §6.1 |
| Integridad por **hash criptográfico** verificable de forma independiente | M1-D1 §Evidence Model; M2-D4 §6.2 |
| Bilingüe **es-AR (default) + en-US** | M2-D3 §Principio 6, §Localization |
| **WCAG 2.1 AA** | M2-D3 §Accessibility |

Todo lo de abajo es implementación.

---

## Stack vigente

### Workspace

| Pieza | Elección | Versión real | Decisión |
|---|---|---|---|
| Gestor de paquetes | pnpm workspaces | `pnpm@9.15.0` | D-001 |
| Runtime | Node | `>=20` | — |
| Lenguaje | TypeScript estricto | `5.8` (api) / `6.0` (web) ⚠️ | — |
| Monorepo | Un repo; `contracts/` adentro pero fuera del workspace pnpm | — | D-001 |

⚠️ **Deuda:** hay skew de TypeScript entre `packages/api` (^5.8.2) y `apps/web` (^6.0.2).
Unificar antes de poblar `packages/shared`, que los tipa a ambos.

### `apps/web` — frontend

| Pieza | Elección | Versión real | Decisión |
|---|---|---|---|
| Framework | TanStack Start (SSR) | `^1.168.28` | D-002 |
| Router | TanStack Router | `^1.170.18` | D-002 |
| Estado servidor | TanStack Query | `^5.90.5` | D-002 |
| UI | React | `^19.2.0` | D-002 |
| Estilos | Tailwind CSS v4 (vía `@tailwindcss/vite`) | `^4.1.18` | D-024 |
| Componentes | shadcn/ui | **pendiente de instalar** | D-002, D-024 |
| Iconos | Lucide (`lucide-react`) | `^0.545.0` | M2-D3 §Iconography |
| Build | Vite | `^8.0.0` | — |
| Server runtime | Nitro | `nitro-nightly@3.0.1-…` ⚠️ | — |
| Tests | Vitest + jsdom + Testing Library | `vitest@^4.1.5` | — |

⚠️ **Deuda:** Nitro está pineado a un **nightly** (`3.0.1-20260714-164552-c6e6168b`) que trajo el
scaffold de TanStack Start. Migrar a un release estable antes del deploy de pre-prod.

**Estado del sistema de diseño.** Tailwind y Lucide ya están instalados, pero `apps/web/src/styles.css`
son todavía ~1000 líneas de CSS portadas de la maqueta PropTrust anterior. El sistema de tokens
normativo de M2-D3 (color, tipografía, espaciado 4px, radios, elevación) **no está implementado**.
Ver D-024.

### `packages/api` — backend

| Pieza | Elección | Versión real | Decisión |
|---|---|---|---|
| Framework HTTP | Express 4 | `^4.21.2` | D-016 |
| Tipos Express | `@types/express` **línea 4** | `^4.17.25` | D-016 · ver Gotchas de CLAUDE.md |
| Validación | Zod | `^3.24.2` | D-016 |
| Auth | JWT (`jsonwebtoken`) + bcrypt cost 10 | `^9.0.2` / `^5.1.1` | D-016 |
| Uploads | Multer 1.x | `^1.4.5-lts.1` ⚠️ | D-016 |
| ORM | Prisma | `^6.6.0` (resuelve a 6.19.x) | D-016 |
| Base de datos | SQLite en dev → **PostgreSQL al desplegar** | — | D-016 |
| Almacenamiento | Disco local en dev → **S3 genérico** (MinIO dev / R2 prod) | — | D-011 |
| Base path | `/api/v1` | — | M2-D5 §2.2 |

⚠️ **Deuda:** Multer 1.x emite un warning de `url.parse()` deprecado. Migrar a 2.x requiere
decisión nueva (cambia la API).

### `packages/shared` · `packages/cardano` · `packages/db`

| Pieza | Elección | Estado | Decisión |
|---|---|---|---|
| Contrato API↔web | Zod, schemas compartidos | **placeholder vacío** | D-012 |
| Puerto Cardano | `AnchorPort` con adaptadores `blockfrost` \| `simulated` | **placeholder vacío** | D-014 |
| Librería Cardano | Lucid Evolution + Blockfrost | **sin implementar** | D-005 (default → spike) |
| `packages/db` | El schema Prisma vive en `packages/api/prisma` | placeholder | D-016 |

**Regla dura:** nada importa Lucid ni Blockfrost fuera del adaptador real de `packages/cardano`.
El adaptador `simulated` **es producto**: lo usan tests, CI, seed de demo y desarrollo offline.

### `contracts/` — Aiken

| Pieza | Elección | Versión real | Decisión |
|---|---|---|---|
| Lenguaje | Aiken | `v1.1.21` | D-017 |
| Target | **Plutus V3** | `plutus.json` → `"plutusVersion": "v3"` | D-019 |
| stdlib | `aiken-lang/stdlib` | `v3.0.0` | D-017 |
| Blueprint | `plutus.json` commiteado, verificado en CI | — | Regla 11 de CLAUDE.md |
| Versionado | Entero, se incrementa con cualquier cambio de validador | `0.0.0` ⚠️ | D-015 |
| Custodia de valor | **Ninguna, en ninguna fase** | — | D-021 |

⚠️ **Deuda:** `aiken.toml` conserva el naming del scaffold (`name = "j/milestone-fsm"`,
`repository.user = "j"`) y `version = "0.0.0"`, que no respeta D-015. Corregir a naming PropNexus.

### Infraestructura

| Pieza | Elección | Decisión |
|---|---|---|
| Red Cardano | **Preprod** en todos los entornos hasta M4 | D-013 |
| Contenedores | Docker | D-010 |
| Hosting | Railway con "Wait for CI" (reversión barata a VPS + Coolify) | D-010 |
| CI | GitHub Actions — **solo valida, nunca despliega ni toca la red** | D-010 |
| Versionado de servicios | CalVer `YYYY.MM.N` | D-015 |
| Secretos | Solo por env | Regla 12 de CLAUDE.md |

---

## Decisiones de stack todavía abiertas

| Qué | Estado | Cierra en |
|---|---|---|
| Lucid Evolution vs Mesh SDK | Default → spike; el walking skeleton **es** el spike | D-005, Fase 2 |
| Custodia de firmas de certificador/notario: co-firma CIP-30 vs wallet por rol | Default → spike | D-009 |
| Express → Hono | Solo se reabre con evidencia medida, no por preferencia | D-016 |
| Multer 1.x → 2.x | Requiere decisión nueva | — |
| Unificar TypeScript 5.8 / 6.0 | Deuda, sin decisión formal | antes de `packages/shared` |
| Nitro nightly → estable | Deuda, sin decisión formal | antes de pre-prod |
