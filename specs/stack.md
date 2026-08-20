# Stack — inventario completo

> **Los entregables oficiales son agnósticos de stack.** El único requisito técnico comprometido
> con Catalyst es que los contratos sean en **Aiken**. Todo lo demás es nuestro, y cambiarlo
> requiere una decisión nueva en `DECISIONS.md` — no una edición de estas tablas (D-022).
>
> **Este documento se escribe contra la realidad, no contra las intenciones** (principio 5). Una
> fila marcada ○ significa que la decisión existe y el código **no**: leerla como si estuviera
> hecha es cómo tres documentos llegaron a describir una infraestructura que no existe.

**Estado:** ● corre hoy · ◐ parcial · ○ decidido, sin ejecutar · ? abierto

---

## 1 · Workspace y lenguaje

| Pieza | Versión | Estado | Decisión |
|---|---|---|---|
| pnpm workspaces (monorepo, `contracts/` adentro pero aislado) | `pnpm@9.15.0` | ● | D-001 |
| Node | `engines: >=20` · CI usa **22** | ● | D-001 |
| TypeScript, estricto, unificado en los tres packages | `6.0.3` | ● | SPEC-008 |
| Resolución de módulos | `node16` en api y shared · `bundler` en web | ● | SPEC-008 |

`tsconfig.base.json` existe pero **no lo extiende nadie**: es configuración muerta. Los tres
packages tienen su propio `tsconfig.json` autocontenido.

## 2 · Frontend — `apps/web`

| Pieza | Versión | Estado | Nota |
|---|---|---|---|
| TanStack Start (SSR) | `1.168.28` | ● | D-002 — SSR por el browse público y el dossier compartido |
| TanStack Router + Query | `1.170` / `5.90` | ● | rutas por archivo, `routeTree.gen.ts` generado |
| React | `19.2.7` | ● | |
| Vite | `8.1.4` | ● | |
| **Nitro** | `3.0.1-20260714-…` **nightly** | ◐ | pineado a un nightly del scaffold; su proxy de dev rompe `POST`+`401` |
| Tailwind CSS | `4.3.2` | ● | vía `@tailwindcss/vite` |
| Lucide (iconos) | `0.545` | ● | M2-D3 reserva pares icono-significado |
| **shadcn/ui** | — | ○ | D-024. Primitivos accesibles para los 36 componentes de M2-D3 |
| **Tokens de diseño de M2-D3** | — | ○ | D-024. Hoy hay ~1000 líneas de CSS de la maqueta vieja en `styles.css` |
| **i18n es-AR/en-US** | — | ○ | D-025. Diccionarios propios, sin librería |
| Vitest + jsdom + Testing Library | `4.1.10` | ● | 4 tests |
| Playwright (E2E) | `1.62` | ● | solo Chromium · **no corre en CI**, a mano |

El front está a ~2% de conformidad con el diseño aprobado. Lo que se conserva es el patrón
`ApiPort`; la superficie se reemplaza. Ver `apps/web/CLAUDE.md`.

## 3 · Backend — `packages/api`

| Pieza | Versión | Estado | Nota |
|---|---|---|---|
| Express | `4.22.2` | ● | D-016. `@types/express` **pineado a v4**: los tipos v5 rompen todas las rutas |
| Prisma (ORM + CLI) | `6.19.3` | ● | D-016 |
| Zod | `4.4.3` | ● | D-035. Rutas heredadas aún con formas de la 3, que v4 acepta |
| JWT (`jsonwebtoken`) | `9.0.2` | ● | 7 días, con revalidación de `isActive` por request |
| **bcrypt** (módulo nativo) | `5.1.1` | ◐ | cost 10. Nativo ⇒ toolchain en la imagen Docker, y es el origen del warning de `url.parse()` vía `node-pre-gyp` |
| Multer | `2.2.0` | ● | D-036 |
| dotenv | `16.4.5` | ● | |
| Vitest + supertest | `4.1.10` / `7.0` | ● | 11 tests, base SQLite propia |

Base `/api/v1`. De los ~80 endpoints del backlog de M2-D5, **conforman 2**.

## 4 · Contrato compartido — `packages/shared`

| Pieza | Versión | Estado | Nota |
|---|---|---|---|
| Zod como contrato único API↔web | `4.4.3` | ◐ | SPEC-008: **auth migrado**, el resto migra por rebanada |

Es lo único que vuelve el drift API↔web *imposible* en vez de prohibido. La mecánica de
resolución (por qué `types` apunta al `.d.ts` y no al fuente) está en `packages/shared/CLAUDE.md`.

## 5 · Contratos inteligentes — `contracts/`

| Pieza | Versión | Estado | Nota |
|---|---|---|---|
| Aiken | `v1.1.21` (CLI local y CI pineados) | ● | |
| **Plutus** | **V3** | ● | D-019 — desvío del SOM, que dice V2. V3 es lo que Aiken 1.1.x emite |
| `aiken-lang/stdlib` | `v3.0.0` | ● | |
| Blueprint `plutus.json` | commiteado, CI verifica que esté al día | ● | D-017 |
| Validadores | `milestone.ak` + `milestone2.ak` | ◐ | casi idénticos; consolidación abierta (D-017) |
| `lib/` puro y testeable | — | ○ | D-008, patrón state-thread de Fase B |
| **Tests** | **0** | ○ | El criterio 2 del SOM pide **≥95% de coverage** |
| Naming del proyecto | `j/milestone-fsm`, `version = "0.0.0"` | ◐ | scaffold; incumple D-015. Se corrige con el rename D-023 |

Ningún validador custodia ni transfiere valor, en ninguna fase (D-021).

## 6 · Datos y almacenamiento

| Pieza | Hoy | Destino | Estado | Decisión |
|---|---|---|---|---|
| Base de datos | **SQLite** (`prisma/dev.db`) | **PostgreSQL** | ○ | D-016 — el trigger es *antes del primer deploy real* |
| Migraciones | Prisma Migrate, 1 migración (`init`) | idempotentes en el entrypoint | ◐ | D-012 |
| Archivos de evidencia | **disco local** (`UPLOAD_DIR`, Multer) | **S3 genérico**: MinIO dev / R2 prod | ○ | D-011 |
| URLs de archivos | descarga por endpoint autenticado | prefirmadas, TTL ≤15 min | ○ | D-011 |
| Base de tests | SQLite propia (`prisma/test.db`), sembrada por corrida | — | ● | SPEC-008 |

## 7 · Blockchain

| Pieza | Estado | Decisión |
|---|---|---|
| Red: **Preprod en todos los entornos**. Mainnet fuera del alcance de M3 | ● (por configuración) | D-013 |
| `packages/cardano` con `AnchorPort` (`anchor`/`verify`/`awaitConfirmation`) | ○ — **el package está vacío** | D-014 |
| Adaptador `simulated` (determinístico; es producto, no stub) | ○ | D-014 |
| Adaptador real: **Lucid Evolution** + Blockfrost | ? — default a refutar por el walking skeleton | D-005 |
| Anclaje Fase A: metadata de tx, label `1904`, strings ≤64 bytes | ○ | D-006 |
| Cuenta Blockfrost (proyecto Preprod) | ○ — **no creada** | — |
| Wallet de servicio (seed nueva y exclusiva de Preprod, fondeada por faucet) | ○ — **no creada** | 🔴 |
| Co-firma CIP-30 para notario/certificador | ? | D-009 |

## 8 · Infraestructura y despliegue

> **Esta capa está en 0%.** No existe ningún `Dockerfile`, ni `docker-compose*.yml`, ni
> configuración de Railway. Es el hueco más grande del proyecto y afecta a cuatro criterios del
> SOM (12 · URL pública, 9 · telemetría, 14 · runbook y monitoreo, 11 · security review).

| Pieza | Estado | Decisión |
|---|---|---|
| **Dockerfile de `apps/web`** | ○ — no existe | D-010 |
| **Dockerfile de `packages/api`** | ○ — no existe | D-010 |
| `docker-compose.prod.yml` | ○ — no existe, **aunque `README.md` y D-010 lo citan como existente** | D-010 |
| Plataforma de deploy: **Railway**, con "Wait for CI" y watch paths por servicio | ○ — cuenta no creada | D-010 (Default, reversión barata) |
| Entrypoint que corre migraciones antes de arrancar | ○ | D-012 |
| `GET /health` | ● — existe en la API | — |
| Healthcheck de contenedor / rollout | ○ | D-010 |
| Entorno de **pre-producción con URL pública** | ○ | criterio 12 del SOM |
| Secretos por entorno (`JWT_SECRET`, `BLOCKFROST_API_KEY`, `SERVICE_WALLET_SEED`) | ◐ — solo `.env` local; nada en un gestor | regla 12 |
| Telemetría / métrica *reserva → escrow < 12 min* | ○ | criterio 9 · D-021 define qué se mide |
| Monitoreo y capturas de monitoreo | ○ | criterio 14 |
| **Runbook** (deploy / rollback / incidente) | ○ — no existe | criterio 14 |
| Versionado de servicios: CalVer `vYYYY.MM.N` en tags | ○ — sin releases | D-015 |
| Backups de la base | ? — nunca se discutió | — |

## 9 · Verificación — CI, puerta y harness

| Pieza | Versión | Estado |
|---|---|---|
| GitHub Actions: dos jobs (**la puerta** + **contratos Aiken**) | `checkout@v4`, `setup-node@v4` (Node 22), `pnpm/action-setup@v4`, `setup-aiken@v1` | ● |
| `scripts/gate.sh` — el mismo script en local y en CI (~31 s) | — | ● |
| Hooks bloqueantes (`docs/`, migraciones, generados, secretos, push) | — | ● |
| `scripts/check-lockfile.py` — lockfile vs `package.json` | — | ● |
| `scripts/worktree.sh` — árboles por track con puertos y base propios | — | ● |
| Subagentes `spec` · `conformance` · `contracts` y skills `slice` · `run-app` | — | ● |
| Tests: **21** (web 4 · api 11 · shared 6) · contratos 0 | — | ◐ |
| Coverage medido | — | ○ — el criterio 2 pide ≥95% en contratos |
| Análisis estático / scan de dependencias | — | ○ — criterio 11 (*"static analysis, dependency scans"*) |
| E2E Playwright | — | ● pero **fuera de CI**, por decisión |

Ver `CLAUDE.md` §Cómo se trabaja acá y D-032.

## 10 · Lo que NO está decidido

| Pregunta | Default vigente | Qué la cierra |
|---|---|---|
| D-005 · Lucid Evolution vs Mesh | Lucid | el walking skeleton (rebanada 3) |
| D-009 · custodia de firmas profesionales | co-firma CIP-30 | prototipo con un certificador real (rebanada 9) |
| D-017 · `milestone.ak` vs `milestone2.ak` | conservar `milestone.ak` | spike ≤1 día |
| Vocabulario "certificate" en la UI | calificar levemente | postura del dueño (sub-ítem de D-026) |
| `/verify` como pantalla o como documento | sin default | M1-D1 la promete, M2-D5 no la tiene |
| Backups y retención de datos | sin default | nunca se discutió |
| Gestor de secretos en pre-prod | sin default | lo fuerza el primer deploy |

## 11 · Deuda del stack

| Deuda | Costo de arrastrarla |
|---|---|
| **Nitro pineado a un nightly** | Builds no reproducibles, y su proxy de dev convierte `POST`+`401` en `502`: el camino de error más común de auth es indebuggeable en local |
| **`bcrypt` es nativo** | La imagen Docker necesita toolchain de compilación (`node-pre-gyp`), y ese mismo camino emite el warning de `url.parse()` deprecado en cada arranque. Alternativa: `bcryptjs`, JS puro y compatible en formato de hash, ~30% más lento. Es código 🔴: lo decide el humano |
| **`contracts/` con 0 tests** | Único criterio duro del SOM sin plan B |
| **`aiken.toml` con naming de scaffold** | Incumple D-015 (versión entera incremental) |
| **`tsconfig.base.json` huérfano** | Configuración que aparenta gobernar y no gobierna nada |
| **`milestone` en el dominio** | D-023 pendiente; encarece con cada pantalla nueva |
