# Milestone 3 evidence — Catalyst project 1400106

> **All the evidence for the Milestone 3 submission lives in this folder.** Each subfolder
> corresponds to one item of *"Evidence of milestone completion"*, in the order Catalyst lists them.
>
> Repository: <https://github.com/Javote/real-world-real-estate> (public) · Pre-production:
> <https://propnexus-web.onrender.com> (web app) and <https://propnexus-api.onrender.com> (API), on
> Cardano **Preprod**.
>
> The documents here are English versions prepared for this submission. The project's working
> language is Spanish; each document names the working document it comes from.

## Status

| # | What Catalyst asks for | Where | Status |
|---|---|---|---|
| 1 | *"Public GitHub repo(s) for contracts/services/frontend with CI logs, coverage report, and pilot participant letter of confirmation; README marks public vs private folders"* | [`1-repo-ci-tests/`](1-repo-ci-tests/) | ✅ repository, CI logs, coverage · ⏳ pilot letters |
| 2 | *"API docs + test reports with coverage/outcomes (e.g., Postman collection)"* | [`2-api/`](2-api/) + the test report in `1-repo-ci-tests/` | ✅ |
| 3 | *"Pre-prod URL, screenshots of audit logs/latency confirming <12m median; short performance note; walkthrough video of full flow + List of transaction identifiers associated milestone test anchors"* | [`3-preprod/`](3-preprod/) | ✅ URL, TXIDs, volume test · ⏳ median with screenshots and note · ⏳ video |
| 4 | *"Security review report (findings + applied fixes)"* | [`4-security/`](4-security/) | ✅ |
| 5 | *"Ops runbook (deploy/rollback/incident) in repo + monitoring screenshots"* | [`5-ops/`](5-ops/) | ✅ |

## 1 · Repository, CI and tests

- **Test and coverage report**: [`test-report.md`](1-repo-ci-tests/test-report.md) — 1,848 tests
  (contracts, API, packages, web app and end-to-end), 0 failed; coverage per package.
- **CI logs**: the run on GitHub Actions,
  [run 35650018189](https://github.com/Javote/real-world-real-estate/actions/runs/35650018189), and
  its **full copy** in [`ci-run-35650018189.log`](1-repo-ci-tests/ci-run-35650018189.log) (GitHub
  deletes Actions logs after 90 days).
- **Public vs. private folders**: the repository [`README.md`](../../README.md), section "Este
  repositorio es público" ("This repository is public"): no folder contains secrets, credentials,
  wallet keys or personal data; secrets travel only through environment variables.
- ⏳ **Pilot participant letters of confirmation** (≥3).

## 2 · API

- **OpenAPI 3.1**: [`propnexus.openapi.json`](2-api/openapi/propnexus.openapi.json) — every
  operation with its method, path, authorization and, where it validates with Zod, its schema.
- **Postman collection**: [`propnexus.postman_collection.json`](2-api/postman/propnexus.postman_collection.json).
- Both are generated from the mounted router, and a test fails if the committed file does not match
  the code.
- **Test reports**: the same report as item 1.

## 3 · Pre-production

- **URL**: <https://propnexus-web.onrender.com>.
- **Volume test** (end-to-end UI flows on pre-production: 30 stages, 180 on-chain transactions):
  [`volume-test-report.md`](3-preprod/volume-test-report.md).
- **Transaction IDs**: [`transaction-ids.md`](3-preprod/transaction-ids.md) and the
  [`.csv`](3-preprod/txids-prueba-de-volumen-2026-09-10.csv), each TXID re-verified against the
  chain.
- ⏳ **Median reservation → escrow < 12 min**, with audit-log and latency screenshots and a short
  performance note.
- ⏳ **Walkthrough video** of the full flow.

## 4 · Security

- **Security review**: [`security-review.md`](4-security/security-review.md) — 3 P1 findings found
  and closed, 0 open; static analysis and dependency scans on every CI run.

## 5 · Operations

- **Runbook** for deploy, rollback and incident response: [`runbook.md`](5-ops/runbook.md).
- **Monitoring screenshots** (Sentry, Grafana Cloud, PostHog, Render):
  [`monitoring-screenshots.md`](5-ops/monitoring-screenshots.md), images in
  [`monitoring/`](5-ops/monitoring/).
