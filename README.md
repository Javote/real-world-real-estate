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

**`DECISIONS.md` > `CLAUDE.md` > `STACK.md` > `specs/` > `ROADMAP.md`.**
Ante contradicción, gana el documento de mayor precedencia y el que está en conflicto se corrige en
el mismo PR. El repo es la memoria; los chats son descartables.

**`docs/` está fuera de la jerarquía y es inmutable:** son los entregables oficiales tal como se
presentaron. Un error en un entregable no se corrige editándolo — se resuelve con una decisión que
lo cite (D-022). Las discrepancias ya detectadas están en `docs/README.md`.

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
Contratos: `pnpm contracts:check` (requiere `aiken` v1.1.21, instalable con `aikup`).

## Índice documental

### Documentación oficial (inmutable)

| Ruta | Contenido |
|---|---|
| `docs/README.md` | **Índice y mapa de los entregables.** Códigos, colisiones de nomenclatura y discrepancias conocidas. Empezá acá. |
| `docs/milestone-1-fundamentos/` | Whitepaper + arquitectura de sistema, modelo de dominio, ciclo de vida y flujo de anclaje (UML). |
| `docs/milestone-2-diseno/` | Arquitectura de información, catálogo de pantallas, biblioteca de 36 componentes, 10 patrones de renderizado de prueba. |
| `docs/milestone-3-implementacion/` | SOM de M3 + backlog de 53 entradas (pantalla → endpoint → test ID) + baseline de backend y contratos. |

### Documentación de trabajo (viva)

| Archivo | Contenido |
|---|---|
| `DECISIONS.md` | **El documento de mayor valor por línea.** 25 ADRs con contexto, alternativas, trigger de revisión y reversión. |
| `CLAUDE.md` | Contexto para LLMs: vocabulario, reglas duras, prohibiciones, método, autonomía, gotchas. |
| `STACK.md` | El stack canónico y su deuda técnica conocida. Separado porque los entregables son agnósticos de stack. |
| `ROADMAP.md` | Fases hasta M4, criterios de salida binarios, riesgos. |
| `specs/` | Registro + template + specs (índice y mapa de paralelización en `specs/README.md`). |
| `GUIA-COMMITS.md` | Conventional commits (scopes cerrados), autonomía LLM 🟢🟡🔴, versionado por artefacto. |
| `PLAYBOOK.md` | El playbook madre de 7 fases que estructura el repo. |
| `SETUP.md` | Bootstrap ya ejecutado; referencia del método y de los pasos pendientes. |

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
├── specs/                      # registro + specs
├── docs/                       # entregables oficiales — INMUTABLE (D-022)
└── DECISIONS.md · CLAUDE.md · STACK.md · ROADMAP.md · GUIA-COMMITS.md · PLAYBOOK.md · SETUP.md
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

Ver `ROADMAP.md` para las fases y sus criterios de salida.

## Reglas duras del equipo

Viven en un solo lugar: **`CLAUDE.md`** (reglas duras + prohibiciones) con las decisiones que las
respaldan en **`DECISIONS.md`**. Este README no las duplica — cualquier copia divergiría en
silencio, y preferimos el link.
