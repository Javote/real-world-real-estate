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
| **2** | Off-chain services & API (hash/timestamp, proof objects, Merkle root) | ✅ Completo — proof objects con `hash + timestamp + signer`, Merkle root por bundle de evidencia, endpoints documentados: OpenAPI 3.1 (85 operaciones, `specs/openapi/`) + colección Postman (`specs/postman/`) | — |
| **3** | UI Implementation & Integration (flujos end-to-end en pre-prod, audit logs) | ✅ 53/53 superficies de M2-D5, audit log append-only y paginable. **Flujos end-to-end en pre-prod: cerrado el 2026-09-10** con la prueba de volumen (30/30 etapas `Completed`, 180/180 eventos on-chain `Confirmed`, las 4 aristas de la FSM ejercitadas en 3 proyectos reales). **La mediana "reserva → creación de escrow < 12 min": cerrada el 2026-09-11** — flujo real de compra del investor contra Preprod, TXID verificado por Koios, mediana medida 2.76 min. El ejercicio destapó y cerró en el mismo día un bug de UX (la UI no reconciliaba sola sin recargar); ver criterio 9 en `specs/README.md` | — |
| **4** | Testing & Security (unit/integration, static analysis, dependency scans, telemetría) | ✅ Tests + coverage corriendo en CI (`pnpm test:coverage`), Semgrep (`security-audit` + `owasp-top-ten`) automático en cada CI run, **`pnpm audit` en cada CI desde el 2026-09-11** (gate en crítico + reporte completo no bloqueante), `specs/SECURITY-REVIEW-2026-09.md` con 3 P1 cerrados y 0 abiertos, Sentry + OTel→Grafana Cloud verificados con traces reales en producción | — |
| **5** | Pre-production Environment & Ops (seed, monitoring, URL pública, walkthrough, runbook) | ✅ URL pública viva (`propnexus-web.onrender.com` / `propnexus-api.onrender.com`), `specs/RUNBOOK-deploy.md` completo, Sentry/Grafana encendidos y con traces reales confirmados en Tempo | ⬜ **Video walkthrough** — nunca grabado (criterio 13 del SOM) · ⬜ **Screenshot formal de monitoring** para la evidencia de entrega — el monitoreo ya está encendido y verificado, falta solo la captura (3.11 en `CLAUDE.md`) |

## Lo que falta, consolidado

Ninguno de estos ítems es código pendiente de escribir — son evidencia por juntar o un flujo por
ejercitar una vez contra Preprod.

| Pendiente | Tipo | Depende de |
|---|---|---|
| Hacer el repo de GitHub público | Decisión ya tomada, para el momento del envío | Dueño — repo hoy en `PRIVATE`; la Evidencia del Output 1 pide explícitamente "Public GitHub repo(s)", y `README.md` línea 75 ya dice *"Este repositorio es público"*, así que el cambio de visibilidad es lo único que falta para que esa frase deje de ser falsa |
| 3 pilotos confirmando (criterio 4 del SOM) | Externo | Recontactar developers/notary socios — `M1-D3-PilotPlan.pdf` |
| Video walkthrough (criterio 13) | Falta grabar | Se graba sobre lo que ya existe y funciona |
| Screenshot de monitoring (3.11 de `CLAUDE.md`) | Falta la captura | Trivial — Sentry/Grafana ya están prendidos |
| Lista formal de TXIDs publicada (3.10 / criterio 15) | Falta publicarla en un lugar formal | Los 180 TXIDs ya están: `specs/REPORTE-2026-09-10-prueba-de-volumen.md` §Apéndice |

## Próxima sesión

No queda nada técnico. La muestra real de reserva → escrow (criterio 9) y `pnpm audit` en CI
(criterio 4) se cerraron el 2026-09-11. Lo que sigue es exclusivamente evidencia/publicación —
3.10/3.11/3.12 — y lo externo (3.13, los 3 pilotos).
