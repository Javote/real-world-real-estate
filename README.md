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

**`DECISIONS.md` > `CLAUDE.md` > `specs/`.**
Ante contradicción, gana el documento de mayor precedencia y el que está en conflicto se corrige en
el mismo PR. El repo es la memoria; los chats son descartables.

**`docs/` está fuera de la jerarquía y es inmutable:** son los entregables oficiales tal como se
presentaron. Un error en un entregable no se corrige editándolo — se resuelve con una decisión que
lo cite (D-022). Las discrepancias ya detectadas están en `docs/README.md`.

## Requisitos previos

- **Node.js ≥ 20 LTS** y **pnpm ≥ 9** — `corepack enable && corepack prepare pnpm@latest --activate`
- **Docker** (para PostgreSQL y MinIO cuando se migre desde SQLite y disco local)
- **Aiken v1.1.21** para los contratos:
  ```bash
  curl --proto '=https' --tlsv1.2 -LsSf https://install.aiken-lang.org | sh
  aikup install v1.1.21
  ```

## Arranque rápido

```bash
pnpm install
cp packages/api/.env.example packages/api/.env   # completar JWT_SECRET
pnpm db:generate
pnpm db:migrate                                  # crea la SQLite de dev
pnpm db:seed                                     # usuarios y proyecto demo
pnpm dev                                         # web en :3000, api en :8787
```

Login demo: `admin@example.com` / `admin123` (resto de usuarios en `packages/api/prisma/seed.ts`).
Contratos: `pnpm contracts:check`.

## Variables de entorno

Referencia completa en `.env.example` y `packages/api/.env.example`. Las que importan:

```
DATABASE_URL=file:./dev.db              # SQLite en dev; postgres://… al desplegar (D-016)
JWT_SECRET=cambiame-en-produccion
UPLOAD_DIR=./uploads                    # disco local en dev; S3 en prod (D-011)
MAX_FILE_SIZE_MB=10
CARDANO_NETWORK=Preprod                 # nunca mainnet hasta M4 (D-013)
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

Build de producción local:

```bash
docker compose -f docker-compose.prod.yml up --build
```

## Índice documental

### Documentación oficial (inmutable)

| Ruta | Contenido |
|---|---|
| `docs/README.md` | **Índice y mapa de los entregables.** Códigos, colisiones de nomenclatura y discrepancias conocidas. Empezá acá. |
| `docs/milestone-1-fundamentos/` | Whitepaper + arquitectura de sistema, modelo de dominio, ciclo de vida y flujo de anclaje (UML). |
| `docs/milestone-2-diseno/` | Arquitectura de información, catálogo de pantallas, biblioteca de 36 componentes, 10 patrones de renderizado de prueba. |
| `docs/milestone-3-implementacion/` | SOM de M3 + backlog de 53 entradas (pantalla → endpoint → test ID) + baseline de backend y contratos. |

### Documentación de trabajo (viva)

Deliberadamente **tres archivos en la raíz y nada más**. Todo lo demás vive indexado dentro de una carpeta.

| Archivo | Contenido |
|---|---|
| `CLAUDE.md` | Todo lo que un agente necesita en cada sesión: vocabulario, principios, stack y su deuda, reglas duras, prohibiciones, autonomía 🟢🟡🔴, convención de commits, comandos y gotchas. |
| `DECISIONS.md` | **El documento de mayor valor por línea.** 25 ADRs con contexto, alternativas, trigger de revisión y reversión. |
| `specs/README.md` | **El mapa de desarrollo:** criterios de aceptación de M3, estado real, rebanadas en orden de dependencia, riesgos. |

## Estructura del monorepo

```
plataforma/
├── .github/workflows/ci.yml   # CI: typecheck+build de api y web, aiken check + blueprint
├── apps/
│   └── web/                    # TanStack Start + Tailwind v4 — 4 superficies por rol
├── packages/
│   ├── api/                    # Express 4 + Prisma + SQLite dev (D-016)
│   │   ├── prisma/             # schema, migraciones, seed
│   │   └── src/                # routes, middlewares (auth 2 capas), lib, utils
│   ├── shared/                 # (a poblar) Zod compartido API↔web
│   ├── db/                     # (reservado) — el esquema vive en packages/api/prisma por D-016
│   └── cardano/                # (a poblar) AnchorPort real/simulado — D-014
├── contracts/                  # Proyecto Aiken (D-017) — Plutus V3, nunca custodia valor (D-021)
├── scripts/                    # (a poblar) walking skeleton
├── specs/                      # el mapa de desarrollo + las specs
├── docs/                       # entregables oficiales — INMUTABLE (D-022)
└── README.md · CLAUDE.md · DECISIONS.md
```

**Qué se despliega y qué no:** solo `apps/web` y `packages/api` corren como servidores.
`shared`/`cardano` son librerías que compilan dentro de la imagen de la API. `contracts/` no se
hostea: el blueprint va commiteado y los validadores viven en la blockchain. Antes del primer deploy
real: migrar el datasource de Prisma a PostgreSQL (trigger de D-016).

**Principio rector:** documentos y datos personales viven off-chain; on-chain solo van hashes
SHA-256, raíces Merkle, commitments y TXIDs. El backend es la capa de orquestación; el frontend
nunca habla directo con Cardano.

## Estado

M1 y M2 entregados. **M3 en construcción** — su alcance es el backlog completo de `M2-D5`,
corriendo íntegramente en **Preprod** (D-013). Mainnet y producción son Milestone 4.

La conformidad actual del código con los entregables es de orden **2%**: lo que existe es una
semilla que aporta decisiones de arquitectura (auth en dos capas, SHA-256 en el servidor, audit log
append-only, el patrón `ApiPort`, la topología de la FSM en Aiken), no superficie terminada.

Ver **`specs/README.md`** para el estado detallado, las fases y sus criterios de salida.

## Reglas duras del equipo

Viven en un solo lugar: **`CLAUDE.md`** (reglas duras + prohibiciones) con las decisiones que las
respaldan en **`DECISIONS.md`**. Este README no las duplica — cualquier copia divergiría en
silencio, y preferimos el link.
