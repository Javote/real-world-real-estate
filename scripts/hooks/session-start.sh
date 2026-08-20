#!/usr/bin/env bash
# SessionStart — orientación en 12 líneas. Lo que un agente necesita saber
# ANTES de preguntar: dónde está parado, qué rebanada está abierta, si hay
# trabajo sin pushear. Todo lo demás se carga on-demand.
set -uo pipefail
PROJ="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$PROJ" || exit 0

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
TREE="$(basename "$PROJ")"
DIRTY="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
AHEAD="$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo '?')"

echo "── PropNexus · árbol '$TREE' · rama '$BRANCH' ──"
[ "$DIRTY" != "0" ] && echo "· $DIRTY archivo/s sin commitear"
[ "$AHEAD" != "0" ] && [ "$AHEAD" != "?" ] && echo "· $AHEAD commit/s sin pushear (un commit sin pushear no pasó por CI)"

ACTIVE="$(grep -nE '^\| *SPEC-[0-9]+ .*(en curso|abierta)' specs/README.md 2>/dev/null | head -3 | sed 's/^/· /')"
[ -n "$ACTIVE" ] && { echo "· rebanadas abiertas:"; printf '%s\n' "$ACTIVE"; }

echo "· protocolo: skill \`slice\` · puerta: scripts/gate.sh · árboles: scripts/worktree.sh list"
echo "· docs/ es inmutable y el push corre la puerta: los dos están bloqueados por hook, no por convención"
