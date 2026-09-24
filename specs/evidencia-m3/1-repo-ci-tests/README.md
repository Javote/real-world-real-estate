# 1 · Repository, CI and tests

> Milestone 3 evidence, item 1: *"Public GitHub repo(s) for contracts/services/frontend with CI
> logs, coverage report, and pilot participant letter of confirmation; README marks public vs
> private folders."*

## What is in this folder

| File | What it is |
|---|---|
| [`test-report.pdf`](test-report.pdf) | The test and coverage report: unit/integration tests across contracts, API, packages and web app (plus a separate, non-blocking E2E job), and coverage per package |
| [`aiken-coverage-report.pdf`](aiken-coverage-report.pdf) | The validator's own coverage evidence: every `expect` mapped to the test that aborts there, and mutation testing on every other rejection check. **Kept separate from `test-report.pdf` on purpose**: Aiken has no line-coverage percentage like `vitest`/`v8` does for the TypeScript parts, so its evidence takes a different shape — this document explains why in its first section |
| [`ci-run-36004503722.log`](ci-run-36004503722.log) | Full copy of the CI run `test-report.pdf` is based on ([run 36004503722](https://github.com/Javote/real-world-real-estate/actions/runs/36004503722) on GitHub Actions), kept here because GitHub deletes Actions logs after 90 days. Test names in it are in Spanish; the log is kept verbatim |

## Covered elsewhere

- **Public repository:** <https://github.com/Javote/real-world-real-estate>.
- **Public vs. private folders:** the
  [repository's README](https://github.com/Javote/real-world-real-estate#readme), section
  "This repository is public".

## Status

| Part | Status |
|---|---|
| Public repository | ✅ |
| CI logs | ✅ |
| Coverage report | ✅ |
| README marks public vs. private folders | ✅ |
| Pilot participant letters of confirmation (≥3) | ⏳ pending |
