# Estado contra el Milestone 3 de Catalyst — 2026-09-10

> Documento de trabajo, para retomar en la próxima sesión. Compara el código y la evidencia que
> existen hoy contra los **5 Outputs oficiales** del Milestone 3 tal como están publicados en
> [milestones.projectcatalyst.io/projects/1400106/milestones/3](https://milestones.projectcatalyst.io/projects/1400106/milestones/3)
> (proyecto 1400106, "Real-World Real Estate Pre-Sale with Proof & Release", ADA 19.000 / 29.23% del
> presupuesto, entrega prevista Mes 6 - Mayo 2026, **sin Proof of Achievement enviada todavía**).
>
> No reemplaza a `specs/README.md` (los 16 criterios del SOM, mapeados contra el código con más
> detalle) ni a `CLAUDE.md` raíz (`§El plan de entrega del Milestone 3`, que manda sobre cualquier
> otra lista). Es el cruce contra la fuente primaria — el texto que Catalyst realmente publicó —
> hecho el mismo día que se cerró la prueba de volumen
> (`specs/REPORTE-2026-09-10-prueba-de-volumen.md`).

## Los 5 Outputs oficiales, uno por uno

| # | Output (Catalyst) | Tenemos | Falta |
|---|---|---|---|
| **1** | Smart-contract suite (Plutus, ≥8 etapas, roles parametrizados, timeouts/fallback) | ✅ Validador con thread token, 82 tests Aiken, 10 etapas reales (`torre-a` y las 3 de la prueba de volumen). Timeouts/fallback re-leídos como robustez del pipeline de anclaje (`Pending`/`Failed`/reconciliación/retry-anchor), decisión documentada en `DECISIONS.md` D-089 | ⬜ **Pilot participants (≥3, elegidos por los developers socios) confirmando** que la plataforma refleja bien el progreso de obra y la lógica de certificación — es la Acceptance Criteria 1 del Output 1, y es externo. `M1-D3-PilotPlan.pdf` ya trae cartas de M1; recontactar |
| **2** | Off-chain services & API (hash/timestamp, proof objects, Merkle root) | ✅ Completo — proof objects con `hash + timestamp + signer`, Merkle root por bundle de evidencia, endpoints documentados: OpenAPI 3.1 (85 operaciones, `specs/evidencia-m3/2-api/openapi/`) + colección Postman (`specs/evidencia-m3/2-api/postman/`) | — |
| **3** | UI Implementation & Integration (flujos end-to-end en pre-prod, audit logs) | ✅ 53/53 superficies de M2-D5, audit log append-only y paginable. **Flujos end-to-end en pre-prod: cerrado el 2026-09-10** con la prueba de volumen (30/30 etapas `Completed`, 180/180 eventos on-chain `Confirmed`, las 4 aristas de la FSM ejercitadas en 3 proyectos reales). **La mediana "reserva → creación de escrow < 12 min": cerrada el 2026-09-11** — flujo real de compra del investor contra Preprod, TXID verificado por Koios, mediana medida 2.76 min. El ejercicio destapó y cerró en el mismo día un bug de UX (la UI no reconciliaba sola sin recargar); ver criterio 9 en `specs/README.md` | — |
| **4** | Testing & Security (unit/integration, static analysis, dependency scans, telemetría) | ✅ Tests + coverage corriendo en CI (`pnpm test:coverage`), Semgrep (`security-audit` + `owasp-top-ten`) automático en cada CI run, **`pnpm audit` en cada CI desde el 2026-09-11** (gate en crítico + reporte completo no bloqueante), `specs/SECURITY-REVIEW-2026-09.md` con 3 P1 cerrados y 0 abiertos, Sentry + OTel→Grafana Cloud verificados con traces reales en producción | — |
| **5** | Pre-production Environment & Ops (seed, monitoring, URL pública, walkthrough, runbook) | ✅ URL pública viva (`propnexus-web.onrender.com` / `propnexus-api.onrender.com`), `specs/RUNBOOK-deploy.md` completo, Sentry/Grafana/PostHog encendidos y con datos reales. **Screenshot formal de monitoring: cerrado el 2026-09-11** (`specs/EVIDENCIA-2026-09-11-monitoring-screenshots.md`) | ⬜ **Video walkthrough** — nunca grabado (criterio 13 del SOM) |

## Lo que falta, consolidado

> **2026-09-21:** la evidencia para enviar está reunida en
> [`evidencia-m3/`](evidencia-m3/README.md), con su estado por ítem. Se sumó un pendiente que este
> documento no tenía: la mediana reserva → escrow se sostiene con **una sola muestra**, y hay que
> juntar más (`CLAUDE.md` §Lo que queda del plan, ítem 3.14).

> **2026-09-21, más tarde:** el dueño releyó el criterio *"unit tests ≥95% coverage"* como de toda
> la app, no solo de los contratos. Eso sí es código: tests por escribir, en
> [`SPEC-017`](SPEC-017-cobertura-95-en-toda-la-app.md) (`CLAUDE.md` ítem 3.15).

Salvo la cobertura (SPEC-017, hoy SPEC-018 y SPEC-019), ninguno de estos ítems es código pendiente de escribir — son
evidencia por juntar o un flujo por ejercitar una vez contra Preprod.

| Pendiente | Tipo | Depende de |
|---|---|---|
| ~~Hacer el repo de GitHub público~~ | **Hecho** — verificado `PUBLIC` el 2026-09-21 | — |
| 3 pilotos confirmando (criterio 4 del SOM) | Externo | Recontactar developers/notary socios — `M1-D3-PilotPlan.pdf` |
| Video walkthrough (criterio 13) | Falta grabar | Se graba sobre lo que ya existe y funciona |
| Cobertura ≥95% con unit tests en toda la app (criterio 2) | Código — tests | [`SPEC-017`](SPEC-017-cobertura-95-en-toda-la-app.md) cerró shared, cardano, contratos y la API en líneas (2026-09-22); **falta la web**, en [`SPEC-019`](SPEC-019-cobertura-de-apps-web.md). La vara más estricta de la API, en [`SPEC-018`](SPEC-018-cobertura-de-apps-api.md) |

## Próxima sesión

No queda nada técnico salvo el video walkthrough. La muestra real de reserva → escrow
(criterio 9), `pnpm audit` en CI (criterio 4), la lista formal de TXIDs (3.10 / criterio 15) y el
screenshot de monitoring (3.11 / criterio 14) se cerraron el 2026-09-11. Lo que sigue: grabar el
video (3.12) y lo externo (3.13, los 3 pilotos).
