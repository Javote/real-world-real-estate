# Test report — 2026-09-21

> Milestone 3 evidence for Catalyst: *"Public GitHub repo(s) … with **CI logs, coverage report**
> …"* and *"API docs + **test reports with coverage/outcomes**"*.
>
> Every result comes from the CI run of commit
> [`31fc854`](https://github.com/Javote/real-world-real-estate/commit/31fc854198bbf9de3b751d6edd27a3b8b716574e).
> The only exception is the coverage of three packages, marked **measured locally**, because CI
> only measures coverage for the API.
>
> *English translation of the working document `specs/EVIDENCIA-2026-09-21-reporte-de-tests.md`,
> as of 2026-09-21.*

## The CI run

**[Run 35650018189](https://github.com/Javote/real-world-real-estate/actions/runs/35650018189)**,
2026-09-21 20:16 UTC, all four jobs green.

GitHub deletes Actions logs after 90 days, so a **full copy lives in the repository**:
[`ci-run-35650018189.log`](ci-run-35650018189.log). It is the raw output of
`gh run view 35650018189 --log`, with color codes stripped. The only secrets that appear in it are
CI test values (`JWT_SECRET: ci-secret-jamas-en-produccion`, "never in production").

| Job | What it runs | Result |
|---|---|---|
| App TS | lint (Biome) · typecheck · test ID traceability · API tests with coverage · web, shared and cardano tests · dependency scan · build · smoke test of the compiled start command | ✅ |
| Aiken contracts | `aiken fmt --check` · `aiken check` · `aiken build`, and that the committed `plutus.json` is up to date | ✅ |
| Static analysis | Semgrep, rulesets `p/security-audit` + `p/owasp-top-ten` | ✅ 127 rules, 434 files, **0 findings** |
| E2E Playwright | the whole app against a migrated and seeded database, on mobile (390 px) and desktop (1440 px) | ✅ **90 passed** |

## Results per package

| Package | What it covers | Tests | Result |
|---|---|---|---|
| `contracts/` (Aiken) | the on-chain validator: stage state machine, thread token, evidence rules | 85 (83 unit + 2 property) | ✅ 85/85 |
| `apps/api` | the API: routes, authorization, anchoring, state machine, migrations | 544 | ✅ 541 passed · 3 skipped |
| `packages/cardano` | the anchoring port (simulated and real) | 92 | ✅ 92/92 |
| `packages/shared` | the shared Zod contract, the state machine, Merkle trees | 101 | ✅ 101/101 |
| `apps/web` (unit) | components, i18n, `ApiPort` checked against the OpenAPI document | 936 | ✅ 936/936 |
| `apps/web` (E2E) | the flows of the four roles plus admin, on two viewports | 90 | ✅ 90/90 |
| **Total** | | **1,848** | **1,845 passed · 3 skipped · 0 failed** |

**The 3 skipped tests are intentional:** they are `apps/api/test/storage-s3.test.ts`, which runs
against a real S3 (MinIO). The same applies to `packages/cardano/src/yaci.test.ts`, which runs
against a local Cardano node and is excluded by that package's test script. CI does not start that
infrastructure; both are run by hand with `pnpm --filter @plataforma/api test:s3` and
`pnpm --filter @plataforma/cardano test:yaci`.

**Until this report, CI only ran the API tests.** The web, shared and cardano tests ran locally in
`pnpm verify` and never in CI. This was found while preparing this report and fixed in the same
commit this run verifies (`31fc854`).

## Coverage

| Package | Lines | Statements | Branches | Functions | Source |
|---|---|---|---|---|---|
| `apps/api` | **89.3%** | 83.2% | 71.1% | 86.7% | CI (`pnpm test:coverage`), with minimum thresholds that fail the build |
| `packages/cardano` | **90.1%** | 89.5% | 82.2% | 94.4% | measured locally |
| `packages/shared` | 61.2% | 63.7% | 96.6% | 94.7% | measured locally |
| `apps/web` (unit) | 27.6% | 27.1% | 22.0% | 29.1% | measured locally |

How to read the two lowest:

- **`packages/shared`** is mostly Zod schema declarations. Branches and functions, which is where
  the logic lives (the state machine, Merkle trees, evidence rules), are above 94%.
- **`apps/web`** has low unit coverage because screens are not unit-tested: they are covered by the
  E2E suite (90 tests: the flows of the four roles and the admin, on two viewports). Unit tests
  cover the shared components, the i18n dictionary and the `ApiPort` contract against the published
  OpenAPI document.

**The contracts (`contracts/`) have no line coverage percentage**: Aiken does not measure line
coverage. The coverage evidence for the validator is the *rejection point → test that exercises it*
table in [`contracts/CLAUDE.md`](../../../contracts/CLAUDE.md): every condition under which the
validator rejects a transaction has at least one test that triggers it.

## Security in the same run

- **Semgrep**: 0 findings (see above).
- **Dependency scan (`pnpm audit`)**: 0 critical, which is the threshold that blocks the build. The
  full report lists 12 (4 high, 8 moderate), **all in build and test tooling**, none in what runs in
  production: `vitest` and its dependencies (`undici`, `nanoid`, `postcss`, `@vitest/mocker`) and
  the `@tanstack/router-plugin` chain (`browserslist`, `baseline-browser-mapping`). The triage is in
  the [security review](../4-security/security-review.md).

## A flaky test, disclosed

While preparing this report, one of three local runs of `pnpm test:coverage` failed in
`apps/api/test/spec-213-un-bundle-por-stage.test.ts` with `SQLITE_BUSY: database is locked`. The
other two passed completely, and so did the CI run. It is contention on the test's SQLite database
when coverage instrumentation slows execution down, not a failure of what the test verifies.

## How to reproduce

```bash
pnpm install
pnpm verify:all                 # lint + typecheck + tests + build + Aiken
pnpm test:coverage              # API coverage, with its thresholds
pnpm --filter web e2e           # the E2E suite (starts web + api)
```
