#!/usr/bin/env bash
# PreToolUse · Bash — dos trabajos:
#   1. la puerta antes de `git push` (D-030 la llama "puerta antes de pushear")
#   2. tapar el agujero de guard-write.sh: escribir por shell es escribir igual
#
# El análisis del comando vive en analyze-cmd.py, que saca los cuerpos de
# heredoc antes de matchear: un comando que MENCIONA docs/ o `git push` en un
# texto que está escribiendo no está tocando docs/ ni pusheando.
set -uo pipefail
PROJ="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
HERE="$(cd "$(dirname "$0")" && pwd)"

read -r -d '' PAYLOAD || true
CMD="$(printf '%s' "$PAYLOAD" | python3 -c '
import json,sys
try: print((json.load(sys.stdin).get("tool_input") or {}).get("command",""))
except Exception: print("")
' 2>/dev/null)"
[ -z "$CMD" ] && exit 0

ANALYSIS="$(python3 "$HERE/analyze-cmd.py" "$CMD" 2>/dev/null)"
has() { printf '%s' "$ANALYSIS" | grep -q "^$1"; }
block() { printf '%s\n' "$1" >&2; exit 2; }

# ── 1. Escrituras por shell a rutas protegidas ───────────────────────────────
if has "WRITE="; then
  TARGET="$(printf '%s' "$ANALYSIS" | sed -n 's/^WRITE=//p')"
  if [ "$TARGET" = "docs/" ]; then
    block "BLOQUEADO — el comando escribe en docs/, que es inmutable (D-022).

docs/ son los entregables aprobados por reviewers de Catalyst. Un error detectado
en un entregable NO se corrige ahí: se registra una decisión en DECISIONS.md
citando documento y párrafo, y se lista en la tabla de desvíos.

Y antes de concluir que el entregable está mal, verificá que estás mirando el
entregable y no una transcripción derivada."
  fi
  block "BLOQUEADO — el comando escribe en '$TARGET', que es generado o ya aplicado. No se edita a mano."
fi

# ── 2. La puerta antes de pushear ────────────────────────────────────────────
if has "PUSH=1"; then
  if has "FORCE=1"; then
    block "BLOQUEADO — push forzado. Reescribir la historia de una rama compartida borra trabajo. Si de verdad hace falta, --force-with-lease y con el humano mirando."
  fi
  # Escapes escritos en la línea de comando (GATE_ALLOW_DOCS=1 git push): el hook
  # corre en su propio proceso, así que hay que reenviarlos explícitamente.
  while IFS= read -r assign; do
    [ -n "$assign" ] && export "${assign#ENV=}"
  done <<EOF
$(printf '%s' "$ANALYSIS" | grep '^ENV=' || true)
EOF

  GATE="$PROJ/scripts/gate.sh"
  [ -x "$GATE" ] || block "BLOQUEADO — no encuentro scripts/gate.sh. Ningún push sale sin pasar la puerta."
  printf '\n⏳ Puerta antes de pushear (D-030) — corriendo scripts/gate.sh…\n' >&2
  OUT="$("$GATE" 2>&1)"; RC=$?
  if [ $RC -ne 0 ]; then
    block "$(printf 'BLOQUEADO — la puerta falló, el push no sale.\n\n%s\n\nArreglá lo de arriba y volvé a intentar. No saltees la puerta: es lo único que verifica el cambio antes de que exista para los demás.' "$OUT")"
  fi
  printf '%s\n✅ Puerta abierta — push permitido.\n' "$OUT" >&2
fi
exit 0
