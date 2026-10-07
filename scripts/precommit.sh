#!/usr/bin/env bash
# El filtro corto antes de cada commit (~1 min). Lo demás —coverage, build, smoke del arranque,
# audit, Semgrep y e2e— lo decide CI, y Render no despliega sin su verde (`checksPass`).
# Va antes del `git add`: Biome reescribe archivos.
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm lint:fix
pnpm typecheck
# Solo los tests de lo que cambió respecto de HEAD, sin coverage: el umbral lo mide CI.
pnpm -r run test --changed --passWithNoTests
if [ -n "$(git status --porcelain -- contracts/)" ]; then
  pnpm contracts:verify
fi
