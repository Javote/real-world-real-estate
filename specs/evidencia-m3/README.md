# Milestone 3 evidence — Real-World Real Estate Pre-Sale with Proof & Release (#1400106)

> **All the evidence for the Milestone 3 submission lives in this folder.** Each subfolder
> corresponds to one item of *"Evidence of milestone completion"*.
>
> Repository: <https://github.com/Javote/real-world-real-estate> (public) · Pre-production:
> <https://propnexus-web.onrender.com> (web app) and <https://propnexus-api.onrender.com> (API), on
> Cardano **Preprod**.

| # | Requirement | Where |
|---|---|---|
| 1 | *"Public GitHub repo(s) for contracts/services/frontend with CI logs, coverage report, and pilot participant letter of confirmation; README marks public vs private folders"* | [`1-repo-ci-tests/`](1-repo-ci-tests/); the pilot letter was sent separately |
| 2 | *"API docs + test reports with coverage/outcomes (e.g., Postman collection)"* | [`2-api/`](2-api/) + the test report in `1-repo-ci-tests/` |
| 3 | *"Pre-prod URL, screenshots of audit logs/latency confirming <12m median; short performance note; walkthrough video of full flow + List of transaction identifiers associated milestone test anchors"* | [`3-preprod/`](3-preprod/) |
| 4 | *"Security review report (findings + applied fixes)"* | [`4-security/`](4-security/) |
| 5 | *"Ops runbook (deploy/rollback/incident) in repo + monitoring screenshots"* | [`5-ops/`](5-ops/) |

## How we read the SOM

Six phrases of the SOM are implemented with a different shape than their words suggest: the
Plutus version, roles and configurable signers, configurable percentages, timeouts and fallback
branches, *"rejects unsigned evidence"*, and error budgets. Each one, with its code and tests, in
[`reading-of-the-som.pdf`](reading-of-the-som.pdf).

## 1 · Repository, CI and tests

- **Test and coverage report**: [`test-report.pdf`](1-repo-ci-tests/test-report.pdf) — tests and
  coverage for the four TypeScript parts (contracts excluded: see next bullet), plus a separate
  non-blocking E2E job.
- **Validator coverage report**: [`aiken-coverage-report.pdf`](1-repo-ci-tests/aiken-coverage-report.pdf)
  — Aiken has no line-coverage percentage, so the validator's evidence is a rejection-point → test
  table plus mutation testing, kept as its own document.
- **CI logs**: the run on GitHub Actions,
  [run 36004503722](https://github.com/Javote/real-world-real-estate/actions/runs/36004503722), and
  its **full copy** in [`ci-run-36004503722.log`](1-repo-ci-tests/ci-run-36004503722.log) (GitHub
  deletes Actions logs after 90 days).
- **Public vs. private folders**: the
  [repository's README](https://github.com/Javote/real-world-real-estate#readme), section "This
  repository is public": no folder contains secrets, credentials, wallet keys or personal data;
  secrets travel only through environment variables.
- **Pilot participant letter of confirmation**: it exists and has already been sent separately, so
  it is not included in this repository.

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
  [`volume-test-report.pdf`](3-preprod/volume-test-report.pdf).
- **Transaction IDs**: [`transaction-ids.pdf`](3-preprod/transaction-ids.pdf) and the
  [`.csv`](3-preprod/txids-volume-test-2026-09-10.csv), each TXID re-verified against the
  chain.
- **Median reservation → escrow < 12 min**: measured **0.33 min** over 6 purchases on Preprod, with
  audit-log and explorer screenshots —
  [`reservation-to-escrow-report.pdf`](3-preprod/reservation-to-escrow-report.pdf).
- **Walkthrough video** of the full flow (~16 min, narrated in English, Preprod):
  [`walkthrough-video.mp4`](3-preprod/walkthrough-video.mp4), with English subtitles in
  [`walkthrough-video.srt`](3-preprod/walkthrough-video.srt).

## 4 · Security

- **Security review**: [`security-review.pdf`](4-security/security-review.pdf) — 3 P1 findings
  found and closed, 0 open; static analysis and dependency scans on every CI run.

## 5 · Operations

- **Runbook** for deploy, rollback and incident response: [`runbook.pdf`](5-ops/runbook.pdf).
- **Monitoring screenshots** (Sentry, Grafana Cloud, PostHog, Render):
  [`monitoring-screenshots.pdf`](5-ops/monitoring-screenshots.pdf), images in
  [`monitoring/`](5-ops/monitoring/). The same document sets the error-budget target (99% of API
  requests without a 5xx over 30 days) that Output 4's telemetry asks for, measured at 99.98%.
