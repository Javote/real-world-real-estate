# PropNexus — Anclaje de Evidencia Inmobiliaria sobre Cardano

> Catalyst Fund Project **1400106** — *Real-World Real Estate Pre-Sale with Proof & Release*.
> Monorepo: **pnpm + TanStack Start** (web) + **Express 4 + Prisma** (api) + **Aiken / Plutus V3** (contratos).

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
pnpm db:generate
pnpm db:migrate                                  # crea la SQLite de dev
pnpm db:seed                                     # usuarios y proyecto demo
pnpm dev                                         # web en :3000, api en :8787
```

Login demo: `admin@example.com` / `admin123` (resto de usuarios en `packages/api/prisma/seed.ts`).
Son credenciales **de desarrollo y publicadas**, y por eso el seed solo las usa contra un SQLite
local: contra cualquier otra base se niega a correr sin `SEED_ADMIN_PASSWORD` (D-047).
Contratos: `pnpm contracts:check`.

## Trabajar con agentes

Todo el harness está en el repo y commiteado: no hay que configurar nada por máquina.

```bash
claude                            # y adentro:  /slice
```

`/slice` es el protocolo completo de una sesión — ubicarse, spec, plan, implementar, verificar,
documentar, commitear, pushear. Para trabajar en paralelo:

```bash
scripts/worktree.sh create contracts   # árbol propio: rama, deps, base y puertos
cd ../pn-contracts && claude
```

Lo que el harness **bloquea** (no advierte): editar `docs/`, editar una migración aplicada o un
archivo generado, escribir una clave privada, pushear con la puerta cerrada, pushear forzado.

```bash
scripts/gate.sh                   # LA PUERTA: lo mismo que corre el CI y el hook de push
scripts/worktree.sh list          # árboles, ramas y puertos
scripts/hooks/test-guards.sh      # regresión de los guardias
```

Detalle en `CLAUDE.md` §Cómo se trabaja acá y en D-032.

## Variables de entorno

Referencia completa en `.env.example` y `packages/api/.env.example`. Las que importan:

```
DATABASE_URL=file:./dev.db              # SQLite en dev; postgres://… al desplegar (D-016)
JWT_SECRET=<openssl rand -hex 32>    # obligatorio: sin esto la API no arranca (D-042)
UPLOAD_DIR=./uploads                    # disco local en dev; S3 en prod (D-011)
MAX_FILE_SIZE_MB=10
SEED_ADMIN_PASSWORD=                     # obligatoria si el seed corre contra una base no local (D-047)
SEED_DEMO_PASSWORD=                      # idem, para los tres usuarios de demo
LOGIN_RATE_LIMIT_MAX=20                 # intentos de login por IP / 15 min (D-045)
TRUST_PROXY_HOPS=0                      # 0 en local; al desplegar detrás de Render, 1 (D-045)
CARDANO_NETWORK=Preprod                 # nunca mainnet (D-013)
ANCHOR_MODE=simulated                   # simulated | real (D-014)
BLOCKFROST_API_KEY=preprod_xxx
SERVICE_WALLET_SEED=…                   # jamás commitear (regla 12 de CLAUDE.md)
EXPLORER_BASE=https://preprod.cardanoscan.io
ANCHOR_METADATA_LABEL=1904              # D-006
```

**Secretos solo por env.** Si ves una seed o una key commiteada: frenar y avisar.

## Pasos de infraestructura pendientes

Todavía no ejecutados; hacen falta para el anclaje real y para pre-producción:

1. **Blockfrost** — crear cuenta, proyecto **Preprod**, setear `BLOCKFROST_API_KEY`.
2. **Wallet de servicio** — generar una seed *nueva y exclusiva de Preprod* para que el backend firme
   las transacciones de anclaje, y fondearla desde el [faucet de testnet](https://docs.cardano.org/cardano-testnets/tools/faucet).
3. **`GET /health`** en la API devolviendo `{"ok":true}` — lo usan el HEALTHCHECK de Docker y el monitoreo.
4. **Migrador en el entrypoint** del contenedor de la API, que corra antes de arrancar el server (D-012:
   migraciones aditivas e idempotentes).
5. **PostgreSQL y S3** reemplazando SQLite y disco local (triggers de D-016 y D-011).

**No hay build de producción todavía.** No existe `render.yaml` (y no habrá Dockerfiles: el deploy
usa el runtime nativo de Node — D-041):
la capa de infraestructura está en 0% y es el hueco más grande del proyecto. El inventario
honesto de qué existe y qué no está en `specs/stack.md` §8.

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
| `CLAUDE.md` | Lo transversal de cada sesión: vocabulario, principios, stack y deuda, reglas duras, prohibiciones, autonomía 🟢🟡🔴, commits, comandos, trampas y cómo se trabaja con el harness. |
| `<frente>/CLAUDE.md` | Lo propio de `apps/web`, `packages/api` y `contracts`: qué leer, trampas verificadas, deuda y comandos. Se cargan solos al tocar el subárbol. |
| `DECISIONS.md` | **El documento de mayor valor por línea.** 32 ADRs con contexto, alternativas, trigger de revisión y reversión. |
| `specs/README.md` | **El mapa de desarrollo:** criterios de aceptación de M3, estado medido, rebanadas en orden de dependencia, tracks paralelos, riesgos. |
| `specs/SPEC-NNN-*.md` | Una por rebanada: invariantes, casos borde (que son los tests) y definición de terminado. |
| `specs/stack.md` | **Inventario completo del stack:** front, back, contratos, datos, blockchain, infraestructura y verificación, con qué corre hoy y qué está solo decidido. |
| `specs/entregables.md` | **Mapa de los entregables oficiales:** qué archivo es cuál y qué contiene. Es un mapa, no una transcripción: ante una duda de contenido, abrí el entregable. |

## Estructura del monorepo

```
plataforma/
├── .claude/                    # harness de agentes, commiteado
│   ├── settings.json           #   hooks (lo que se bloquea) + permisos
│   ├── agents/                 #   spec · conformance · contracts
│   └── skills/                 #   slice (protocolo de sesión) · run-app
├── .github/workflows/ci.yml    # CI: corre scripts/gate.sh --ci + aiken
├── scripts/
│   ├── gate.sh                 #   LA PUERTA — la misma en local y en CI
│   ├── worktree.sh             #   árboles por track con puertos y base propios (D-031)
│   └── hooks/                  #   guardias + su suite de regresión
├── apps/
│   └── web/                    # TanStack Start + Tailwind v4 — 4 superficies por rol
├── packages/
│   ├── api/                    # Express 4 + Prisma + SQLite dev (D-016)
│   │   ├── prisma/             #   schema, migraciones, seed
│   │   └── src/                #   routes, middlewares (auth 2 capas), lib, utils
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
versionan (regla 12 de `CLAUDE.md`, verificada por `scripts/gate.sh` en cada push).

| Ruta | Visibilidad | Qué contiene |
|---|---|---|
| `apps/`, `packages/`, `contracts/`, `scripts/`, `.claude/`, `.github/` | **Pública** | Código, contratos, harness y CI |
| `docs/`, `specs/`, `README.md`, `CLAUDE.md`, `DECISIONS.md` | **Pública** | Entregables oficiales y documentación de trabajo |
| `packages/api/.env`, `apps/web/.env` | **Privada** — nunca versionada | Secretos locales. El ejemplo público es `.env.example` |
| `packages/api/prisma/dev.db` | **Privada** — nunca versionada | Base SQLite de desarrollo |
| `packages/api/uploads/` | **Privada** — nunca versionada | Evidencia subida en runtime |
| `apps/web/e2e/.artifacts/` | **Privada** — nunca versionada | Capturas, videos y traces de la suite E2E |

La wallet de servicio de Preprod y la API key de Blockfrost se configuran por entorno en el
proveedor de deploy y **no existen en el repositorio**.

## Reglas duras del equipo

Viven en un solo lugar: **`CLAUDE.md`** (reglas duras + prohibiciones) con las decisiones que las
respaldan en **`DECISIONS.md`**. Este README no las duplica — cualquier copia divergiría en
silencio, y preferimos el link.
