# Evidencia del Milestone 3 — Catalyst 1400106

> **Toda la evidencia de la entrega del Milestone 3 vive en esta carpeta.** Cada subcarpeta
> corresponde a uno de los cinco ítems de *"Evidence of milestone completion"*, en el mismo orden en
> que los lista Catalyst (`docs/milestone-3-implementacion/Milestone-3-info.md`). Para el formulario
> de Proof of Achievement, cada ítem se completa con los links de su fila.
>
> Repo: <https://github.com/Javote/real-world-real-estate> (público) · Pre-prod:
> <https://propnexus-web.onrender.com> (web) y <https://propnexus-api.onrender.com> (API), sobre
> Cardano **Preprod**.

## Estado

| # | Lo que pide Catalyst | Dónde está | Estado |
|---|---|---|---|
| 1 | *"Public GitHub repo(s) for contracts/services/frontend with CI logs, coverage report, and pilot participant letter of confirmation; README marks public vs private folders"* | [`1-repo-ci-tests/`](1-repo-ci-tests/) | ✅ repo, CI, coverage · ⬜ **cartas de los pilotos** |
| 2 | *"API docs + test reports with coverage/outcomes (e.g., Postman collection)"* | [`2-api/`](2-api/) y el reporte de tests de `1-repo-ci-tests/` | ✅ |
| 3 | *"Pre-prod URL, screenshots of audit logs/latency confirming <12m median; short performance note; walkthrough video of full flow + List of transaction identifiers associated milestone test anchors"* | [`3-preprod/`](3-preprod/) | ✅ URL, TXIDs, prueba de volumen · ⬜ **mediana con capturas** (agendada) · ⬜ **video** |
| 4 | *"Security review report (findings + applied fixes)"* | [`4-seguridad/`](4-seguridad/) | ✅ |
| 5 | *"Ops runbook (deploy/rollback/incident) in repo + monitoring screenshots"* | [`5-ops/`](5-ops/) | ✅ |

## 1 · Repo, CI y tests — [`1-repo-ci-tests/`](1-repo-ci-tests/)

- **Reporte de tests y coverage**: [`EVIDENCIA-2026-09-21-reporte-de-tests.md`](1-repo-ci-tests/EVIDENCIA-2026-09-21-reporte-de-tests.md)
  — 1.848 tests (contratos, API, paquetes, web y E2E), 0 fallidos; coverage por paquete.
- **Logs de CI**: la corrida en GitHub Actions,
  [run 35650018189](https://github.com/Javote/real-world-real-estate/actions/runs/35650018189), y
  su **copia completa** en [`ci-run-35650018189.log`](1-repo-ci-tests/ci-run-35650018189.log)
  (GitHub borra los logs a los 90 días).
- **Carpetas públicas y privadas**: [`README.md`](../../README.md) §"Este repositorio es público".
- ⬜ **Carta de confirmación de los pilotos** (≥3, criterio de aceptación del Output 1). Externo:
  recontactar a los developers y notaries socios; `M1-D3-PilotPlan.pdf` trae las cartas de M1.

## 2 · API — [`2-api/`](2-api/)

- **OpenAPI 3.1**: [`openapi/propnexus.openapi.json`](2-api/openapi/propnexus.openapi.json) —
  cada operación con su método, path, autorización y, donde validan con Zod, su schema.
- **Colección Postman**: [`postman/propnexus.postman_collection.json`](2-api/postman/propnexus.postman_collection.json).
- Los dos se generan del router montado (`pnpm --filter @plataforma/api docs:openapi` y `docs:api`)
  y un test falla si el archivo commiteado no coincide con el código.
- **Test reports**: el mismo reporte del ítem 1.

## 3 · Pre-prod — [`3-preprod/`](3-preprod/)

- **URL**: <https://propnexus-web.onrender.com>.
- **Lista de TXIDs**: [`EVIDENCIA-2026-09-11-lista-formal-de-txids.md`](3-preprod/EVIDENCIA-2026-09-11-lista-formal-de-txids.md)
  y el [`.csv`](3-preprod/txids-prueba-de-volumen-2026-09-10.csv).
- **Prueba de volumen** (flujos end-to-end en pre-prod, 30 etapas, 180 eventos on-chain):
  [`REPORTE-2026-09-10-prueba-de-volumen.md`](3-preprod/REPORTE-2026-09-10-prueba-de-volumen.md).
- ⬜ **Mediana reserva → escrow < 12 min, con capturas y nota de performance.** Hoy hay una sola
  muestra real. Agendado: [`PLAN-muestras-reserva-escrow.md`](3-preprod/PLAN-muestras-reserva-escrow.md),
  que también fija qué se mide: desde que el investor acepta hasta que el TXID entra en un bloque.
- ⬜ **Video walkthrough**: el guion está en
  [`GUION-2026-09-21-video-walkthrough.md`](../GUION-2026-09-21-video-walkthrough.md). El video, una
  vez montado, se sube (YouTube no listado u otro) y el link va acá.

## 4 · Seguridad — [`4-seguridad/`](4-seguridad/)

- **Security review**: [`SECURITY-REVIEW-2026-09.md`](4-seguridad/SECURITY-REVIEW-2026-09.md) —
  3 P1 encontrados y cerrados, 0 abiertos.
- El análisis estático (Semgrep) y el dependency scan corren en cada CI: ver el reporte del ítem 1.

## 5 · Operación — [`5-ops/`](5-ops/)

- **Runbook** de deploy, rollback e incidentes: [`RUNBOOK-deploy.md`](5-ops/RUNBOOK-deploy.md).
- **Capturas de monitoreo** (Sentry, Grafana Cloud, PostHog, Render):
  [`EVIDENCIA-2026-09-11-monitoring-screenshots.md`](5-ops/EVIDENCIA-2026-09-11-monitoring-screenshots.md),
  con las imágenes en [`monitoring/`](5-ops/monitoring/).
