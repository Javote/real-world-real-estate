# 05 — Backlog de tareas con orden de ejecución

> La numeración de sprints es la misma que en `ROADMAP.md` (que define los criterios de salida binarios; este doc detalla las tareas — no duplicar). Convención: cada fila = una rama = un PR. Los Test IDs se implementan como `data-testid` y tests E2E. Niveles de autonomía 🟢🟡🔴 en `docs/GUIA-COMMITS.md`.

## Sprint 0 — Bootstrap (orden: docs → scaffold auditado → CI)

| # | Tarea | Refs | Depende de |
|---|---|---|---|
| 0.1 | Commit 1: documentación fundacional (CLAUDE, DECISIONS, ROADMAP, specs, docs/context) | — | — |
| 0.2 | Commit 2: scaffold monorepo auditado (SETUP.md §2) | — | 0.1 |
| 0.3 | Commit 3: CI + protección de `main` + deploy conectado (Railway/Coolify, watch paths, "Wait for CI") | — | 0.2 |
| 0.4 | `GET /health` + `packages/api/src/migrate.ts` (los asume el entrypoint de deploy) 🟡 | — | 0.2 |
| 0.5 | Build local de producción (`docker compose -f docker-compose.prod.yml up --build`) | — | 0.4 |

## Sprint 1 — Tres frentes en paralelo (mapa: `specs/README.md`)

**T0 (bloquea a todos; los frentes A y B lo escriben juntos):**

| # | Tarea | Refs | Depende de |
|---|---|---|---|
| 1.0 | Contrato Zod del dominio demo en `packages/shared/src/schemas/demo.ts` (SPEC-005 §1) + tests de contrato | SPEC-004/005 | 0.2 |

**Frente A — Demo frontend (SPEC-004)** — agente/dev confinado a `apps/web`:

| # | Tarea | Refs | Depende de |
|---|---|---|---|
| 1.A1 | `ApiPort` + adaptador `mock` con seed y latencia simulada | SPEC-004 | 1.0 |
| 1.A2 | Login demo + guard de sesión (`/login`) | SPEC-004 | 1.A1 |
| 1.A3 | `/projects`: grid Airbnb-like (`ProjectCard`) + `/projects/new` (form validado con Zod) | SPEC-004 | 1.A1 |
| 1.A4 | `/projects/:id`: detalle + dropzone + tabla de documentos con `HashChip` y `StatusPill` (`pending`) | SPEC-004 | 1.A3 |
| 1.A5 | Casos borde 1–7 de SPEC-004 como tests + `pnpm demo` | SPEC-004 | 1.A4 |

**Frente B — API demo (SPEC-005)** — confinado a `packages/api` + `packages/db`:

| # | Tarea | Refs | Depende de |
|---|---|---|---|
| 1.B1 | Esquema Drizzle mínimo (accounts, projects, units, documents) + seed con usuario demo 🟡 | SPEC-005 | 1.0 |
| 1.B2 | `POST /auth/login` + `GET /auth/me` (usuario seed) 🟡 | SPEC-005 | 1.B1 |
| 1.B3 | Projects: GET/POST/GET:id (genera unidades = pisos × unidades/piso) | SPEC-005 | 1.B2 |
| 1.B4 | Documentos: multipart → MinIO → sha256 del stream → `pending` + `anchorQueue` noop 🟡 | SPEC-005 | 1.B3 |
| 1.B5 | Casos borde 1–7 de SPEC-005 como tests + `pnpm demo:full` | SPEC-005 | 1.B4 |

**Frente C — Walking skeleton (SPEC-001)** — confinado a `packages/cardano` + `scripts/`:

| # | Tarea | Refs | Depende de |
|---|---|---|---|
| 1.C1 | SHA-256 + Merkle con vectores de test (casos 1–4 de SPEC-001) 🟡 | SPEC-001 | 0.2 |
| 1.C2 | `AnchorPort` + adaptador `simulated` (casos 5–6, 10) 🟡 | SPEC-001, D-014 | 1.C1 |
| 1.C3 | Adaptador `blockfrost` real (Lucid) + wallet Preprod fondeada 🟡 | SPEC-001, D-005 | 1.C2 |
| 1.C4 | `scripts/skeleton.ts` en ambos modos; el simulado entra al CI | SPEC-001 | 1.C3 |
| 1.C5 | Cerrar D-005 en DECISIONS.md con la evidencia del skeleton | — | 1.C4 |

**Integración 1 (cierra el sprint; requiere A y B):**

| # | Tarea | Refs | Depende de |
|---|---|---|---|
| 1.I1 | `VITE_API_MODE=real`: front contra API real; E2E del flujo demo completo | SPEC-004/005 | 1.A5, 1.B5 |

## Sprint 2 — Integración 2 + engordar el hilo

| # | Tarea | Refs | Depende de |
|---|---|---|---|
| 2.1 | **Integración 2:** `anchorQueue` real → `AnchorPort`; worker de confirmaciones; documentos `pending → anchored`+txid (el front no se toca) 🟡 | SPEC-001/005 | 1.I1, 1.C4 |
| 2.2 | Esquema Drizzle completo + migraciones + seed extendido 🟡 | — | 1.B1 |
| 2.3 | `packages/shared`: enums + máquina de estados de milestone (pura, testeada) | — | 0.2 |
| 2.4 | Auth definitiva multi-rol (refresh, guards por rol) 🟡 | M3-BE-01 | 2.2 |
| 2.5 | Projects CRUD completo + detalle público | M3-BE-03 | 2.4 |
| 2.6 | Construction Stages API + máquina de estados persistida | M3-BE-04 | 2.5, 2.3 |
| 2.7 | Evidencia por milestone (multipart→S3→Merkle→AnchorPort; casos 7–9 SPEC-001) 🟡 | M3-BE-13, M3-SC-02 | 2.1, 2.6 |
| 2.8 | Audit log append-only + filtros | M3-BE-16 | 2.4 |
| 2.9 | Escribir SPEC-002 (máquina de estados TS + validador) — su código llega en Sprints 3/5 | — | 2.3 |

## Sprint 3 — Superficie developer (frontend) + resto de APIs de developer

| # | Tarea | Refs |
|---|---|---|
| 2.1 | Login multi-rol + layout + tema + componentes de dominio (HashChip, TxidModal, StatusPill, VerificationBadge, ProgressTimeline, StageChip) | M3-FE-01, M3-FE-09 |
| 2.2 | Developer Panel (KPIs + notificaciones) | M3-BE-11, M3-FE-14 |
| 2.3 | Projects: list/create/detail (+LocationMapModal) | M3-FE-15 |
| 2.4 | Units management (por proyecto y cross-proyecto) | M3-BE-06, M3-FE-16 |
| 2.5 | **Evidence upload + AnchoringSuccessModal** (Merkle + TXID) | M3-FE-18 · Test: DEV-EVIDENCE-UPLOAD-001, DEV-ANCHOR-SUCCESS-001 |
| 2.6 | Invite investor flow (anchor TXID) | M3-BE-10, M3-SC-01, M3-FE-17 |
| 2.7 | Contracts & releases surface | M3-BE-08, M3-FE-19 |
| 2.8 | Capital + Progress dashboards | M3-FE-20/21 |
| 2.9 | Documentation surface (anchor de documentos) | M3-BE-14, M3-SC-06, M3-FE-22 |
| 2.10 | Investors list + Audit log + verification modal | M3-BE-15, M3-FE-23/24 |

## Sprint 4 — Superficie investor

| # | Tarea | Refs |
|---|---|---|
| 3.1 | Browse API pública (filtros, búsqueda, geo) | M3-BE-02 |
| 3.2 | Buy surface: lista/mapa/búsqueda/filtros | M3-FE-02 |
| 3.3 | Project detail + Progress + Stage detail (DocumentViewer, hashes, Merkle proof) | M3-FE-03/04 |
| 3.4 | Favorites | M3-BE-05, M3-FE-05 |
| 3.5 | My Units + unit detail (gallery, location, building schematic, news) | M3-FE-06 |
| 3.6 | Notifications (role-scoped) | M3-BE-07, M3-FE-07 |
| 3.7 | Contract & payments + TxidModal | M3-FE-08 |
| 3.8 | Dossier + share token público + export PDF | M3-BE-12, M3-FE-10 |
| 3.9 | Profile + Menu + Invitation accept modal (TXID) | M3-BE-09, M3-FE-11/12/13 |

## Sprint 5 — Notary y Certifier + validadores fase B (incluye spike D-009; stage_release es 🔴)

| # | Tarea | Refs |
|---|---|---|
| 4.1 | Validador `certification.ak` + tests + blueprint | M3-SC-05 |
| 4.2 | Validador `notary_commit.ak` + tests | M3-SC-04 |
| 4.3 | Notary workflow API (queue, sign→TXID, reject) | M3-BE-17 |
| 4.4 | Notary surfaces (Panel, Dossier review, Signed, Profile) | M3-FE-25 |
| 4.5 | Certifier workflow API (assignments, certify→TXID, observe) | M3-BE-18 |
| 4.6 | Certifier surfaces (Panel, Certify stage, Observe modal, Issued) | M3-FE-26 |
| 4.7 | Validador `stage_release.ak` + integración releases | M3-SC-03 |

## Sprint 6 — E2E, hardening, pase de coherencia y demo

| # | Tarea |
|---|---|
| 5.1 | Playwright E2E por rol usando los Test IDs del backlog completo |
| 5.2 | Flujo demo E2E en Preprod: upload→anchor→verify→certify→sign→release |
| 5.3 | Hardening: rate limiting, TTL de URLs prefirmadas, revisión de logs sin PII |
| 5.4 | **Pase de coherencia documental**: grep de términos superados en DECISIONS/CLAUDE/specs/docs; corregir contradicciones (regla de precedencia) |
| 5.5 | Documento de verificación pública para stakeholders (cómo auditar un TXID) |
| 5.6 | Guion de demo como script E2E ejecutable + staging presentable |

## Criterios de aceptación transversales (todo PR)

1. Schema Zod en `shared` primero; tipos importados por API y web.
2. Test unitario del caso feliz + 1 caso de error mínimo.
3. Mutaciones escriben `audit_log`.
4. Cero PII on-chain o en logs.
5. `pnpm typecheck && pnpm test` (y `aiken check` si aplica) en verde.
