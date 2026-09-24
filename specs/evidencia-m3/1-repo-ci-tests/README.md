# 1 · Repository, CI and tests

> Milestone 3 evidence, item 1: *"Public GitHub repo(s) for contracts/services/frontend with CI
> logs, coverage report, and pilot participant letter of confirmation; README marks public vs
> private folders."*

## What is in this folder

| File | What it is |
|---|---|
| [`test-report.md`](test-report.md) · [PDF](test-report.pdf) | The test and coverage report: 2,732 unit/integration tests across contracts, API, packages and web app (plus a separate, non-blocking E2E job) — 2,728 passed, 3 skipped on purpose, 1 expected fail, 0 failed — plus 100% coverage on all four metrics for all four TypeScript parts, all measured in CI |
| [`aiken-coverage-report.md`](aiken-coverage-report.md) · [PDF](aiken-coverage-report.pdf) | The validator's own coverage evidence: every `expect` mapped to the test that aborts there (18/18), and mutation testing on every other rejection check (51/51 killed). **Kept separate from `test-report.md` on purpose**: Aiken has no line-coverage percentage like `vitest`/`v8` does for the TypeScript parts, so its evidence takes a different shape — this document explains why in its first section |
| [`ci-run-36004503722.log`](ci-run-36004503722.log) | Full copy of the CI run the report is based on ([run 36004503722](https://github.com/Javote/real-world-real-estate/actions/runs/36004503722) on GitHub Actions), kept here because GitHub deletes Actions logs after 90 days. Test names in it are in Spanish, the team's working language; the log is kept verbatim |

## Covered elsewhere

- **Public repository:** <https://github.com/Javote/real-world-real-estate>.
- **Public vs. private folders:** the repository's [`README.md`](../../../README.md), section
  "This repository is public".

## Status

| Part | Status |
|---|---|
| Public repository | ✅ |
| CI logs | ✅ |
| Coverage report | ✅ |
| README marks public vs. private folders | ✅ |
| Pilot participant letters of confirmation (≥3) | ⏳ pending |
