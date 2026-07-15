# Plataforma — Anclaje de Evidencia Inmobiliaria sobre Cardano

> Monorepo: **pnpm + TanStack Start** (web) + **Express 4 + Prisma** (api, D-016) + **Aiken** (contratos on-chain).
> Estructurado según el **playbook estándar de 7 fases** (`docs/playbook-flujo-de-trabajo.md`). Consolida tres frentes previos: la guía de implementación, el backend PoC funcionando y la maqueta visual PropTrust (snapshots en `docs/context/`).

## Jerarquía de precedencia (regla número uno)

**`DECISIONS.md` > `CLAUDE.md` > `specs/` > `ROADMAP.md` y `docs/` (históricos).**
Ante contradicción, gana el documento de mayor precedencia y el que está en conflicto se corrige en el mismo PR. El repo es la memoria; los chats son descartables.

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

| Archivo | Contenido |
|---|---|
| `DECISIONS.md` | **El documento de mayor valor por línea.** 17 ADRs con estado, alternativas y reversión. |
| `CLAUDE.md` | Contexto para LLMs: reglas duras, prohibiciones, método, autonomía, gotchas. |
| `ROADMAP.md` | Mandato, "listo" binario, sprints, riesgos (con nota de estado post-consolidación). |
| `SETUP.md` | Bootstrap ya ejecutado; referencia del método y de los pasos pendientes (Cardano). |
| `specs/` | Registro + template + 6 specs escritas (índice y mapa de paralelización en `specs/README.md`). |
| `docs/context/` | Snapshots congelados: maqueta PropTrust, análisis funcional, registro original del backend, extracto técnico. |
| `docs/GUIA-COMMITS.md` | Conventional commits (scopes cerrados), autonomía LLM 🟢🟡🔴, versionado por artefacto. |
| `docs/01…08` | Arquitectura, dominio, API, contratos, backlog, prompts, devops (referencia técnica del diseño objetivo). |
| `docs/playbook-flujo-de-trabajo.md` | El playbook madre de 7 fases. |

## Estructura del monorepo

```
plataforma/
├── .github/workflows/ci.yml   # CI: typecheck+build de api y web, aiken check
├── apps/
│   └── web/                    # TanStack Start — pantallas portadas de la maqueta PropTrust
├── packages/
│   ├── api/                    # Express 4 + Prisma + SQLite dev (backend adoptado, D-016)
│   │   ├── prisma/             # schema, migraciones, seed
│   │   └── src/                # routes, middlewares (auth 2 capas), lib, utils
│   ├── shared/                 # (a poblar) Zod compartido API↔web — SPEC-005 §1
│   ├── db/                     # (reservado) — el esquema vive en packages/api/prisma por D-016
│   └── cardano/                # (a poblar) AnchorPort real/simulado — D-014, SPEC-001
├── contracts/                  # Proyecto Aiken (D-017): milestone.ak V1 + reference/ de Fase B
├── scripts/                    # (a poblar) skeleton.ts — walking skeleton, SPEC-001
├── specs/                      # registro + specs
├── docs/                       # referencia técnica + context/ congelado
└── DECISIONS.md · CLAUDE.md · ROADMAP.md · SETUP.md
```

**Qué se despliega y qué no:** solo `apps/web` y `packages/api` corren como servidores. `shared`/`cardano` son librerías que compilan dentro de la imagen de la API. `contracts/` no se hostea: el blueprint va commiteado y los validadores viven en la blockchain. Ver `docs/07-devops-cicd.md`. Antes del primer deploy real: migrar el datasource de Prisma a PostgreSQL (trigger de D-016).

**Principio rector:** documentos y datos personales viven off-chain; on-chain solo van hashes SHA-256, raíces Merkle, commitments y TXIDs. El backend es la capa de orquestación; el frontend nunca habla directo con Cardano.

## Cómo seguir (frentes en paralelo, sin pisarse)

1. **UX/UI:** rediseño de identidad + shadcn/ui sobre las pantallas ya portadas en `apps/web` (D-002). No toca `ApiPort`.
2. **Contratos:** tests de SPEC-002 (hoy 0 tests) y consolidación `milestone.ak`/`milestone2.ak` (D-017). No está conectado a nada todavía.
3. **API/DB:** contrato Zod en `packages/shared` al tocar endpoints para el front (SPEC-005 §1); después, walking skeleton (SPEC-001) e integración del anclaje (Sprint 2 del ROADMAP).

Cada tarea se pide al LLM con su prompt de `docs/06-prompts-llm.md`, dentro del nivel de autonomía de `docs/GUIA-COMMITS.md`. Lo que emerja se persiste en el mismo PR: decisiones → `DECISIONS.md`; sorpresas → Gotchas de `CLAUDE.md`; interfaces nuevas → su spec.

## Reglas duras del equipo

Viven en un solo lugar: **`CLAUDE.md`** (reglas duras + prohibiciones) con las decisiones que las respaldan en **`DECISIONS.md`**. Este README no las duplica — cualquier copia divergiría en silencio, y preferimos el link.
