# PropNexus — Anclaje de Evidencia Inmobiliaria sobre Cardano

> Catalyst Fund Project **1400106** — *Real-World Real Estate Pre-Sale with Proof & Release*.
> Monorepo: **pnpm + TanStack Start** (web) + **Express 4 + Kysely** (api) + **Aiken / Plutus V3** (contratos).

Ventas inmobiliarias en pozo: estructura el ciclo de obra en **stages**, organiza la **evidencia**
(planos, fotos, permisos, certificados) y ancla **huellas criptográficas** (SHA-256 / Merkle) en
Cardano con timestamps verificables. Cuatro roles con superficie propia: **investor**, **developer**,
**notary**, **certifier**.

**Lo que la plataforma no hace:** no custodia ni transfiere dinero, en ninguna fase (D-021). No
sustituye registros públicos, procesos notariales ni autorizaciones estatales (M1-D1 §Non-Substitution).

## Jerarquía de precedencia (regla número uno)

Dos autoridades distintas: **`docs/` manda sobre las obligaciones** (el *qué* y la vara de
aceptación — entregables aprobados por reviewers, **inmutables**), y **`DECISIONS.md` > `CLAUDE.md`
> `specs/` mandan sobre la implementación** (el *cómo*).

**La regla completa —cuándo un desvío es legítimo, cómo se registra y cuáles están vigentes— vive
en el encabezado de `DECISIONS.md` y en D-022.** Acá no se repite: llegó a estar escrita en cuatro
archivos, que es exactamente lo que el principio 1 prohíbe.

El repo es la memoria; los chats son descartables.

## Requisitos previos

- **Node.js ≥ 20 LTS** y **pnpm ≥ 9** — `corepack enable && corepack prepare pnpm@latest --activate`
- **Docker** (para MinIO cuando se migre desde disco local — D-011). PostgreSQL ya no es el
  destino: se mantiene SQLite (D-038)
- **Aiken v1.1.21** para los contratos:
  ```bash
  curl --proto '=https' --tlsv1.2 -LsSf https://install.aiken-lang.org | sh
  aikup install v1.1.21
  ```

## Arranque rápido

```bash
pnpm install
cp packages/api/.env.example packages/api/.env   # completar JWT_SECRET: openssl rand -hex 32
pnpm db:migrate                                  # crea la SQLite de dev
pnpm db:seed                                     # usuarios y proyecto demo
pnpm dev                                         # web en :3000, api en :8787
```

Login demo: `admin@example.com` / `admin123` (resto de usuarios en `packages/api/src/db/seed.ts`).
Son credenciales **de desarrollo y publicadas**, y por eso el seed solo las usa contra un SQLite
local: contra cualquier otra base se niega a correr sin `SEED_ADMIN_PASSWORD` (D-047).
Contratos: `pnpm contracts:check`.

## Verificación

Un comando, y es el mismo que corre el CI:

```bash
pnpm verify        # typecheck + tests + build
```

El CI agrega el job de Aiken (`fmt --check`, `check`, `build` y que `plutus.json` esté al día) y
`pnpm install --frozen-lockfile`, que falla si el lockfile no refleja los `package.json`.

**No hay harness.** Hubo uno entre el 2026-08-20 y el 2026-08-23 —puerta ejecutable, hooks
bloqueantes, subagentes, skills, árboles por track— y se borró entero: 1099 líneas que en tres días
necesitaron cinco commits de arreglo a sí mismas y no atajaron ninguno de los bugs reales del
período. El razonamiento completo, con los números, está en **D-053**.

Lo que queda como regla escrita y no como bloqueo: no editar `docs/` (es una copia de los
entregables aprobados), no editar una migración ya aplicada, no commitear secretos.

## Variables de entorno

**Un archivo por servicio, y son la referencia:** [`packages/api/.env.example`](packages/api/.env.example)
y [`apps/web/.env.example`](apps/web/.env.example). Acá no se copian — una lista duplicada se
desactualiza en la copia, no en el original.

Lo único que no se deduce leyéndolos:

- **`JWT_SECRET` es obligatoria y no tiene default.** Si falta o queda vacía, la API **no arranca**.
  Es a propósito (D-042): el free tier no da shell para ir a mirar qué variables quedaron cargadas,
  así que el fallo tiene que ser el arranque y no una request de producción.
- **Las de `apps/web` son de build time.** Cambiarlas exige rebuild, no restart.
- **`TRUST_PROXY_HOPS` vale 0 en local y 1 detrás de Render.** Con 0 detrás del proxy, todos los
  clientes comparten balde de rate limit y la app queda inusable (D-045).

**Secretos solo por env.** Si ves una seed o una key commiteada: frenar y avisar.

## Deploy

Todo corre en **free tier, $0/mes** — y eso es una restricción de arquitectura, no una nota de
presupuesto (D-040). El artefacto es **`render.yaml`** en la raíz: dos servicios Node sobre Render
(sin Docker, D-041) contra una base **Turso**.

**El procedimiento completo —alta, deploy diario, rollback, incidentes y limitaciones— está en
[`specs/RUNBOOK-deploy.md`](specs/RUNBOOK-deploy.md).** Acá solo lo que hay que saber antes de abrirlo:

- Falta **crear las cuentas** (Render, Turso) y pegar cuatro variables. No falta código.
- El web **proxea** `/api/**` hacia la API: no hay CORS y el navegador nunca ve la URL de la API.
- `API_ORIGIN` es de **build time**: cambiarla exige redeploy del web, no un restart.
- **Keep-warm está prohibido.** Dos servicios despiertos 24/7 son ~1460 h contra las 750 del plan
  y quedan suspendidos cerca del día 15. Se calienta la URL a mano antes de una demo.
- **La evidencia subida no persiste** (filesystem efímero). Aceptado y marcado en D-051; R2 sale en
  su propia rebanada y vuelve a ser bloqueante el día del primer anclaje.

## Pasos de infraestructura pendientes

Todavía no ejecutados; hacen falta para el **anclaje real**, no para el deploy:

1. **Blockfrost** — crear cuenta, proyecto **Preprod**, setear `BLOCKFROST_API_KEY`.
2. **Wallet de servicio** — generar una seed *nueva y exclusiva de Preprod* para que el backend firme
   las transacciones de anclaje, y fondearla desde el [faucet de testnet](https://docs.cardano.org/cardano-testnets/tools/faucet).
3. **`packages/cardano`** — el package está vacío: no hay `AnchorPort`, ni adaptador simulado, ni real (D-014).
4. **Cloudflare R2** — storage S3-compatible para la evidencia, y mover el SHA-256 para que cubra los
   bytes que terminan en el object storage (D-011, superficie 🔴).

El inventario honesto de qué existe y qué no está en [`specs/stack.md`](specs/stack.md) §8 y §12.

## Índice documental

### Documentación oficial (inmutable)

> `docs/` contiene **únicamente entregables** (D-033). El mapa de qué archivo es qué entregable
> está en `specs/entregables.md`, que sí se puede mantener.

| Ruta | Contenido |
|---|---|
| `docs/milestone-1-fundamentos/` | Whitepaper + arquitectura de sistema, modelo de dominio, ciclo de vida y flujo de anclaje (UML). |
| `docs/milestone-2-diseno/` | Arquitectura de información, catálogo de pantallas, biblioteca de 36 componentes, 10 patrones de renderizado de prueba. |
| `docs/milestone-3-implementacion/` | SOM de M3 + backlog de 53 entradas (pantalla → endpoint → test ID) + baseline de backend y contratos. |

### Documentación de trabajo (viva)

Deliberadamente **tres archivos en la raíz y nada más**. Todo lo demás vive indexado dentro de una carpeta.

| Archivo | Contenido |
|---|---|
| `CLAUDE.md` | Lo transversal de cada sesión: vocabulario, principios, reglas duras, prohibiciones, autonomía 🟢🟡🔴, commits, comandos y trampas. |
| `<frente>/CLAUDE.md` | Lo propio de `apps/web`, `packages/api` y `contracts`: qué leer, trampas verificadas, deuda y comandos. Se cargan solos al tocar el subárbol. |
| `DECISIONS.md` | **El documento de mayor valor por línea.** 32 ADRs con contexto, alternativas, trigger de revisión y reversión. |
| `specs/README.md` | **El mapa de desarrollo:** criterios de aceptación de M3, estado medido, rebanadas en orden de dependencia, tracks paralelos, riesgos. |
| `specs/SPEC-NNN-*.md` | Una por rebanada: invariantes, casos borde (que son los tests) y definición de terminado. |
| `specs/stack.md` | **Inventario completo del stack:** front, back, contratos, datos, blockchain, infraestructura y verificación, con qué corre hoy y qué está solo decidido. |
| `specs/entregables.md` | **Mapa de los entregables oficiales:** qué archivo es cuál y qué contiene. Es un mapa, no una transcripción: ante una duda de contenido, abrí el entregable. |

## Estructura del monorepo

```
plataforma/
├── .claude/settings.json       # comandos preaprobados de sesión (comodidad, no reglas)
├── .github/workflows/ci.yml    # CI: typecheck + tests + build, y el job de Aiken
├── render.yaml                 # Blueprint de deploy (2 servicios Node, free tier)
├── apps/
│   └── web/                    # TanStack Start + Tailwind v4 — 4 superficies por rol
├── packages/
│   ├── api/                    # Express 4 + Kysely + SQLite dev (D-016, D-049)
│   │   ├── migrations/         #   migraciones SQL escritas a mano (D-052)
│   │   └── src/                #   routes, middlewares (auth 2 capas), lib, utils, db (schema/seed)
│   ├── shared/                 # contrato único API↔web: schemas Zod + tipos
│   └── cardano/                # (a poblar) AnchorPort real/simulado — D-014
├── contracts/                  # Proyecto Aiken (D-017) — Plutus V3, nunca custodia valor (D-021)
├── specs/                      # el mapa de desarrollo + las specs de rebanada
├── docs/                       # entregables oficiales — INMUTABLE (D-022)
└── README.md · CLAUDE.md · DECISIONS.md

Cada frente tiene además su propio `CLAUDE.md` (`apps/web/`, `packages/api/`, `contracts/`), que se
carga solo cuando un agente toca ese subárbol.
```

**Qué se despliega y qué no:** solo `apps/web` y `packages/api` corren como servidores.
`shared`/`cardano` son librerías que compilan dentro de la imagen de la API. `contracts/` no se
hostea: el blueprint va commiteado y los validadores viven en la blockchain. El destino de datos es
mantener SQLite vía Turso en Render, no migrar a PostgreSQL — D-038. El deploy entero corre en
**free tier, $0/mes**, y eso es una restricción de arquitectura: sin disco persistente, la evidencia
va a R2 antes del primer deploy y el worker de confirmaciones es un cron de GHA — D-040.

**Principio rector:** documentos y datos personales viven off-chain; on-chain solo van hashes
SHA-256, raíces Merkle, commitments y TXIDs. El backend es la capa de orquestación; el frontend
nunca habla directo con Cardano.

## Estado

M1 y M2 entregados. **M3 en construcción** — su alcance es el backlog completo de `M2-D5`,
corriendo íntegramente en **Preprod** (D-013). Mainnet y producción quedan fuera de alcance.

Lo que existe hoy es una **semilla**: aporta decisiones de arquitectura, no superficie terminada.

**El estado medido —conformidad, qué bloquea el arranque, rebanadas, tracks paralelos y riesgos—
vive en `specs/README.md` y solo ahí.** Un número de estado copiado en dos archivos se desactualiza
en uno de los dos.

## Carpetas públicas y privadas

Este repositorio es **público**. No contiene, en ninguna carpeta, secretos, credenciales, seeds de
wallet ni datos personales: los secretos viajan **solo por variables de entorno** y nunca se
versionan (regla 12 de `CLAUDE.md`).

| Ruta | Visibilidad | Qué contiene |
|---|---|---|
| `apps/`, `packages/`, `contracts/`, `.claude/`, `.github/` | **Pública** | Código, contratos y CI |
| `docs/`, `specs/`, `README.md`, `CLAUDE.md`, `DECISIONS.md` | **Pública** | Entregables oficiales y documentación de trabajo |
| `packages/api/.env`, `apps/web/.env` | **Privada** — nunca versionada | Secretos locales. El ejemplo público es `.env.example` |
| `packages/api/dev.db` | **Privada** — nunca versionada | Base SQLite de desarrollo |
| `packages/api/uploads/` | **Privada** — nunca versionada | Evidencia subida en runtime |
| `apps/web/e2e/.artifacts/` | **Privada** — nunca versionada | Capturas, videos y traces de la suite E2E |

La wallet de servicio de Preprod y la API key de Blockfrost se configuran por entorno en el
proveedor de deploy y **no existen en el repositorio**.

## Reglas duras del equipo

Viven en un solo lugar: **`CLAUDE.md`** (reglas duras + prohibiciones) con las decisiones que las
respaldan en **`DECISIONS.md`**. Este README no las duplica — cualquier copia divergiría en
silencio, y preferimos el link.
