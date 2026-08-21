#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# LA PUERTA — el único comando que decide si un cambio puede pushearse.
#
# Es el mismo script en local (hook PreToolUse sobre `git push`) y en CI
# (.github/workflows/ci.yml). Si se separan, divergen; por eso hay uno solo.
#
#   scripts/gate.sh              # local: verifica lo que este cambio tocó
#   scripts/gate.sh --ci         # CI: verifica todo, sin acotar por diff
#   scripts/gate.sh --quick      # sin build (para iterar)
#
# Filosofía: lo que no se puede dejar librado al azar es código, no un párrafo
# en un .md. Las prohibiciones absolutas corren siempre; la verificación corre
# sobre el frente que el cambio tocó — y si tocaste un frente que no tiene
# verificación, la puerta falla. Así la deuda bloquea a quien la crea.
#
# Escapes (ruidosos a propósito, se registran en el output):
#   GATE_ALLOW_DOCS=1     permite tocar docs/ (solo para agregar un entregable nuevo)
#   GATE_SKIP_CONTRACTS=1 salta aiken (solo si no está instalado y no tocaste contracts/)
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

CI_MODE=0; QUICK=0
for arg in "$@"; do
  case "$arg" in
    --ci)    CI_MODE=1 ;;
    --quick) QUICK=1 ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "argumento desconocido: $arg" >&2; exit 2 ;;
  esac
done

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "no es un repo git"; exit 2; }
cd "$ROOT"

RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; DIM=$'\033[2m'; BOLD=$'\033[1m'; OFF=$'\033[0m'
[ -t 1 ] || { RED=""; GREEN=""; YELLOW=""; DIM=""; BOLD=""; OFF=""; }

FAILURES=(); NOTES=()
ok()   { printf '  %s✔%s %s\n' "$GREEN" "$OFF" "$1"; }
bad()  { printf '  %s✘%s %s\n' "$RED" "$OFF" "$1"; FAILURES+=("$1"); }
warn() { printf '  %s!%s %s\n' "$YELLOW" "$OFF" "$1"; NOTES+=("$1"); }
skip() { printf '  %s·%s %s%s%s\n' "$DIM" "$OFF" "$DIM" "$1" "$OFF"; }
head_() { printf '\n%s%s%s\n' "$BOLD" "$1" "$OFF"; }

# ── Alcance del cambio ───────────────────────────────────────────────────────
BASE=""
for ref in origin/main main; do
  git rev-parse --verify -q "$ref" >/dev/null 2>&1 && { BASE="$(git merge-base HEAD "$ref" 2>/dev/null)"; break; }
done

if [ "$CI_MODE" = 1 ]; then
  # En CI el alcance es el mismo concepto que en local: lo que este cambio tocó.
  # Verificar "todo" sonaba más estricto y en la práctica dejaba el CI rojo de
  # forma permanente por deuda preexistente — y un CI rojo permanente es peor
  # que no tener CI, porque se deja de mirar.
  CI_BASE="${GATE_BASE:-}"
  if [ -z "$CI_BASE" ]; then
    if [ -n "$BASE" ] && [ "$BASE" != "$(git rev-parse HEAD)" ]; then CI_BASE="$BASE"
    else CI_BASE="$(git rev-parse HEAD~1 2>/dev/null || true)"; fi
  fi
  CHANGED="$(git diff --name-only "$CI_BASE"..HEAD 2>/dev/null)"
  [ -z "$CHANGED" ] && CHANGED="$(git ls-files)"
  SCOPE_DESC="CI — cambios desde ${CI_BASE:0:8}"
else
  CHANGED="$( { git diff --name-only HEAD 2>/dev/null
                git diff --name-only --cached 2>/dev/null
                git ls-files --others --exclude-standard 2>/dev/null
                [ -n "$BASE" ] && git diff --name-only "$BASE"..HEAD 2>/dev/null
              } | sort -u )"
  SCOPE_DESC="working tree + commits sobre ${BASE:0:8}"
fi
touched() { printf '%s\n' "$CHANGED" | grep -qE "$1"; }
# Un frente "tocado" es un frente con cambios de CÓDIGO: un .md del subárbol no
# exige correr su suite. (Calibración del 2026-08-20: crear packages/api/CLAUDE.md
# cerraba la puerta por falta de tests de la API, que es un falso positivo.)
touched_code() { printf '%s\n' "$CHANGED" | grep -E "$1" | grep -qvE '\.md$'; }

printf '%s┌ PUERTA — %s%s\n' "$BOLD" "$(git rev-parse --abbrev-ref HEAD)" "$OFF"
printf '%s└ alcance: %s · %s archivos%s\n' "$DIM" "$SCOPE_DESC" "$(printf '%s\n' "$CHANGED" | grep -c . )" "$OFF"

# ── 1. Prohibiciones absolutas ───────────────────────────────────────────────
head_ "1 · Prohibiciones absolutas"

# D-022 — docs/ es inmutable, ni para corregir un error evidente.
# Distingue SUMAR de TOCAR: agregar un entregable nuevo es legítimo; modificar,
# borrar o renombrar uno existente, no. Así el escape casi nunca hace falta.
# Corre también en CI: es la última línea de defensa si alguien pushea desde una
# máquina sin hooks (antes se salteaba en CI y el agujero pasaba desapercibido).
DOCS_MUTATED="$( { [ -n "$BASE" ] && git diff --name-status "$BASE"..HEAD -- docs/ 2>/dev/null
                   git diff --name-status HEAD -- docs/ 2>/dev/null
                 } | grep -E '^[MDR]' | sort -u || true )"
if [ -n "$DOCS_MUTATED" ]; then
  if [ "${GATE_ALLOW_DOCS:-0}" = 1 ]; then
    warn "docs/ modificado con GATE_ALLOW_DOCS=1 — solo legítimo para SACAR algo que nunca fue entregable (D-033). Jamás para corregir uno."
    printf '      %s\n' "$DOCS_MUTATED"
  else
    bad "un entregable de docs/ fue modificado, borrado o renombrado (D-022: inmutable)"
    printf '      %s\n' "$DOCS_MUTATED"
    echo "      → un error en un entregable se resuelve con una decisión en DECISIONS.md, no editándolo"
  fi
else
  ok "entregables de docs/ intactos (D-022)"
fi

# Regla 12 — secretos solo por env. Prefijos bech32 de Cardano + PEM + valores reales.
SECRET_HITS="$(git grep -nIE '(-----BEGIN [A-Z ]*PRIVATE KEY-----|ed25519_sk1[a-z0-9]{10,}|root_xsk1[a-z0-9]{10,}|addr_xsk1[a-z0-9]{10,}|xprv[a-zA-Z0-9]{20,})' -- . ':!*.lock' ':!pnpm-lock.yaml' 2>/dev/null || true)"
ENVS_TRACKED="$(git ls-files | grep -E '(^|/)\.env$|(^|/)\.env\.(local|production)$' || true)"
SEED_SET="$(git grep -nIE '^[[:space:]]*(SERVICE_WALLET_SEED|BLOCKFROST_API_KEY)[[:space:]]*=[[:space:]]*["'"'"']?[A-Za-z0-9_]' -- . ':!*.example' ':!.env.example' 2>/dev/null | grep -viE 'xxx|placeholder|cambiame|palabra1|<|\$\{' || true)"
if [ -n "$SECRET_HITS$ENVS_TRACKED$SEED_SET" ]; then
  bad "posible secreto versionado (regla 12) — FRENÁ Y AVISÁ"
  [ -n "$SECRET_HITS" ]   && printf '      %s\n' "$SECRET_HITS"
  [ -n "$ENVS_TRACKED" ]  && printf '      .env versionado: %s\n' "$ENVS_TRACKED"
  [ -n "$SEED_SET" ]      && printf '      %s\n' "$SEED_SET"
else
  ok "sin secretos versionados (regla 12)"
fi

# Regla 5 — autorización en dos capas. `requireRole` es un middleware: está en la
# cadena o no está. `canAccessProject` es una función que hay que ACORDARSE de
# llamar, así que un endpoint que se la olvide no tiene segunda capa y nada lo
# detecta. Esto no arregla la forma (hallazgo 9 de specs/README.md, 🔴) pero hace
# que olvidarse sea ruidoso. Corre siempre: es barato y es un invariante, no una
# verificación de frente.
if ACCESS_OUT="$(python3 scripts/check-project-access.py 2>&1)"; then
  ok "todo endpoint con alcance de proyecto tiene segunda capa (regla 5)"
else
  bad "un endpoint con alcance de proyecto no tiene segunda capa de autorización (regla 5)"
  printf '%s\n' "$ACCESS_OUT" | sed 's/^/      /'
fi

# D-013 — Preprod en todos los entornos. CI nunca toca ninguna red.
# El propio script queda excluido: un escáner que vive dentro del corpus que
# escanea se encuentra a sí mismo (pasó — el mensaje de error matcheaba el patrón).
if git grep -nIE 'CARDANO_NETWORK[[:space:]]*[=:][[:space:]]*["'"'"']?[Mm]ainnet' -- . ':!DECISIONS.md' ':!CLAUDE.md' ':!README.md' ':!docs/' ':!specs/' ':!scripts/gate.sh' >/dev/null 2>&1; then
  bad "la red mainnet aparece configurada en el código (D-013: solo Preprod)"
else
  ok "ninguna red que no sea Preprod (D-013)"
fi

# Migraciones ya aplicadas: siempre migración nueva, jamás editar una existente.
if [ -n "$BASE" ] && [ "$CI_MODE" = 0 ]; then
  MIG_EDITED="$(git diff --name-status "$BASE"..HEAD -- packages/api/drizzle/ 2>/dev/null | grep -E '^[MD]' || true)"
  MIG_EDITED+="$(git diff --name-status HEAD -- packages/api/drizzle/ 2>/dev/null | grep -E '^[MD]' || true)"
  if [ -n "$MIG_EDITED" ]; then
    bad "migración ya aplicada modificada o borrada — siempre migración nueva"
    printf '      %s\n' "$MIG_EDITED"
  else
    ok "migraciones aplicadas intactas"
  fi
else
  skip "migraciones — sin base de comparación"
fi

# Artefactos que no van al repo.
JUNK="$(git ls-files | grep -E '(^|/)(node_modules|dist|\.output|\.tanstack|coverage)/|(^|/)dev\.db$|^packages/api/uploads/[^.]|(^|/)\.DS_Store$|^contracts/build/' || true)"
if [ -n "$JUNK" ]; then
  bad "artefactos versionados que no deberían estarlo"
  printf '      %s\n' "$JUNK" | head -10
else
  ok "sin artefactos de build ni datos locales versionados"
fi

# ── 2. Verificación por frente tocado ────────────────────────────────────────
head_ "2 · Verificación"

run() { # run "etiqueta" comando...
  local label="$1"; shift
  local out; local rc
  out="$("$@" 2>&1)"; rc=$?
  if [ $rc -eq 0 ]; then ok "$label"
  else
    bad "$label"
    printf '%s\n' "$out" | tail -25 | sed 's/^/      /'
  fi
  return $rc
}

# El lockfile tiene que reflejar los package.json. Editar un package.json sin
# correr `pnpm install` deja el CI roto y —peor— el typecheck local corriendo
# contra versiones que no son las declaradas: el 2026-08-20 la API declaraba
# TypeScript 6.0 y tenía 5.9 instalado, así que la "unificación" pasó en verde
# sin haberse verificado nunca. Comparación textual, sin red y sin efectos:
# `pnpm install --lockfile-only` reescribe el lockfile, y un verificador que
# muta lo que verifica no sirve.
if LOCK_OUT="$(python3 scripts/check-lockfile.py 2>&1)"; then
  ok "lockfile en sincronía con los package.json"
else
  bad "pnpm-lock.yaml desactualizado — corré 'pnpm install' y commiteá el lockfile"
  printf '      %s\n' "$LOCK_OUT" | head -8
fi

# Drizzle (D-048) no tiene cliente generado: `src/db/schema.ts` es TypeScript de
# mano, se importa directo — no hay paso de codegen que `pnpm install` se pueda
# llevar puesto, así que el chequeo que existía para Prisma ya no aplica.

# Typecheck: siempre. Es barato y es lo único que atrapa roturas cruzadas
# entre packages (el motivo por el que packages/shared existe).
run "typecheck (workspace)" pnpm typecheck

WEB=0; API=0; SHARED=0; CONTRACTS=0
touched_code '^apps/web/'        && WEB=1
touched_code '^packages/api/'    && API=1
touched_code '^packages/shared/' && SHARED=1
touched_code '^contracts/'       && CONTRACTS=1

has_test_script() { node -e "process.exit(require('./$1/package.json').scripts?.test?0:1)" 2>/dev/null; }

# Regla de la puerta: la suite que existe se corre SIEMPRE (es barata y es
# estrictamente mejor); la suite que NO existe bloquea solo si tocaste ese
# frente. Así la deuda frena a quien la usa, sin frenar a todos para siempre.
front() { # front <etiqueta> <dir> <filtro pnpm> <tocado 0|1> <nota si falta>
  local label="$1" dir="$2" filter="$3" touched="$4" nota="$5"
  if has_test_script "$dir"; then
    run "tests $label" pnpm --filter "$filter" test
  elif [ "$touched" = 1 ]; then
    bad "$label fue modificado y NO tiene script \`test\` — \`pnpm -r test\` lo saltea en silencio"
    echo "      → $nota"
  else
    skip "tests $label — todavía sin suite"
  fi
}

front "apps/web"        apps/web        web                 "$WEB"    "sin suite no hay verificación"
front "packages/api"    packages/api    @plataforma/api     "$API"    "deuda medida el 2026-08-20; se cierra en SPEC-008"
front "packages/shared" packages/shared @plataforma/shared  "$SHARED" "regla 6: el contrato API↔web se verifica"

if [ "$QUICK" = 0 ]; then
  [ "$WEB" = 1 ] && run "build apps/web" pnpm --filter web build
  [ "$API" = 1 ] && run "build packages/api" pnpm --filter @plataforma/api build
  [ "$WEB$API" = "00" ] && skip "build — sin cambios en servicios desplegables"
else skip "build — modo --quick"; fi

# El harness se verifica a sí mismo: si tocaste un hook, corré su suite.
if touched '^scripts/'; then
  run "guardias del harness" scripts/hooks/test-guards.sh
else skip "guardias del harness — sin cambios en scripts/"; fi

if command -v aiken >/dev/null 2>&1; then
  ( cd contracts && aiken fmt --check >/dev/null 2>&1 ) && ok "aiken fmt" || bad "aiken fmt --check falla — corré 'cd contracts && aiken fmt'"
  run "aiken check" bash -c 'cd contracts && aiken check'
  if [ "$CONTRACTS" = 1 ] && [ "$QUICK" = 0 ]; then
    ( cd contracts && aiken build >/dev/null 2>&1 )
    if git diff --quiet -- contracts/plutus.json; then ok "plutus.json al día (D-017)"
    else bad "plutus.json desactualizado — corré 'pnpm contracts:build' y commiteá el blueprint"; fi
  else skip "blueprint — sin cambios en contracts/"; fi
  # Criterio 2 del SOM: ≥95% de coverage. Hoy son 0 tests: que la puerta lo diga.
  NTESTS="$(grep -rhoE '^[[:space:]]*test[[:space:]]+[a-z_0-9]+' contracts/validators contracts/lib 2>/dev/null | wc -l | tr -d ' ')"
  [ "${NTESTS:-0}" -eq 0 ] && warn "contracts/ tiene 0 tests y el criterio 2 del SOM pide ≥95% de coverage"
elif [ "$CONTRACTS" = 1 ] && [ "$CI_MODE" = 0 ] && [ "${GATE_SKIP_CONTRACTS:-0}" != 1 ]; then
  bad "tocaste contracts/ y aiken no está instalado (aikup install v1.1.21)"
else
  skip "contratos — aiken no instalado (en CI lo cubre el job 'contracts', con la versión pineada)"
fi

# ── 3. Coherencia documental ─────────────────────────────────────────────────
head_ "3 · Coherencia"

# Principio 4: el repo es la memoria. Un cambio de comportamiento sin rastro
# documental es conocimiento que se pierde cuando termina la sesión.
CODE_CHANGED=0
touched '^(apps|packages|contracts)/.*\.(ts|tsx|ak)$' && CODE_CHANGED=1
DOC_CHANGED=0
touched '^(DECISIONS\.md|CLAUDE\.md|specs/|.*/CLAUDE\.md)' && DOC_CHANGED=1
if [ "$CI_MODE" = 0 ] && [ "$CODE_CHANGED" = 1 ] && [ "$DOC_CHANGED" = 0 ]; then
  warn "cambió código y no cambió ninguna spec, decisión ni CLAUDE.md — ¿de verdad no emergió nada que persistir? (principio 4)"
else
  ok "rastro documental"
fi

# D-023 — 'milestone' es vocabulario Catalyst; en el dominio va 'stage'.
NEW_MILESTONE="$(printf '%s\n' "$CHANGED" | grep -E '^(apps|packages)/.*\.(ts|tsx)$' | xargs -I{} sh -c 'test -f "{}" && grep -lil "milestone" "{}"' 2>/dev/null || true)"
[ -n "$NEW_MILESTONE" ] && warn "'milestone' en código de dominio (D-023 pide 'stage'): $(printf '%s' "$NEW_MILESTONE" | tr '\n' ' ')"

# ── Veredicto ────────────────────────────────────────────────────────────────
echo
if [ ${#FAILURES[@]} -eq 0 ]; then
  printf '%s%s PUERTA ABIERTA %s' "$GREEN" "$BOLD" "$OFF"
  [ ${#NOTES[@]} -gt 0 ] && printf '%s (%s advertencia/s)%s' "$YELLOW" "${#NOTES[@]}" "$OFF"
  echo; exit 0
else
  printf '%s%s PUERTA CERRADA — %s bloqueo/s %s\n' "$RED" "$BOLD" "${#FAILURES[@]}" "$OFF"
  for f in "${FAILURES[@]}"; do printf '  %s·%s %s\n' "$RED" "$OFF" "$f"; done
  exit 1
fi
