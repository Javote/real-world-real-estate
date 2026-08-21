#!/usr/bin/env bash
# PreToolUse · Edit|Write|NotebookEdit — prohibiciones que NO son negociables.
# Un párrafo en CLAUDE.md es advisory para el modelo; esto lo ejecuta el harness.
# Salida 2 = bloqueado, y stderr le llega al agente como explicación.
set -uo pipefail
PROJ="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

read -r -d '' PAYLOAD || true
eval "$(printf '%s' "$PAYLOAD" | python3 -c '
import json,sys,shlex
try: d=json.load(sys.stdin)
except Exception: print("FP=; CONTENT="); sys.exit(0)
ti=d.get("tool_input") or {}
fp=ti.get("file_path") or ti.get("notebook_path") or ""
content=(ti.get("content") or ti.get("new_string") or "")[:20000]
print("FP=%s" % shlex.quote(fp))
print("CONTENT=%s" % shlex.quote(content))
' 2>/dev/null || echo 'FP=; CONTENT=')"

[ -z "${FP:-}" ] && exit 0
REL="${FP#$PROJ/}"

block() { printf '%s\n' "$1" >&2; exit 2; }

case "$REL" in
  docs/*)
    [ "${GATE_ALLOW_DOCS:-0}" = 1 ] || block \
"BLOQUEADO — docs/ es inmutable (D-022).

'$REL' es un entregable aprobado por reviewers de Catalyst. Editarlo desincroniza
el repo de lo que el revisor tiene, y vuelve imposible verificar que entregamos lo
que decimos.

Si detectaste un error en el entregable: registrá una decisión en DECISIONS.md
citando documento y párrafo, y listala en la tabla de desvíos. Un desvío solo es
legítimo si (a) el entregable se contradice internamente, (b) es un error de
redacción, o (c) seguirlo al pie contradiría una verdad del producto. Nunca por
conveniencia.

Y antes de concluir que el entregable está mal: verificá que estás mirando el
entregable y no una transcripción (pasó, y costó una sesión entera)." ;;

  packages/api/drizzle/*.sql)
    [ -f "$FP" ] && block \
"BLOQUEADO — '$REL' es una migración ya aplicada.

Editarla deja la base de cualquier otro árbol en un estado que el historial de
migraciones no describe. Siempre migración nueva:
  pnpm --filter @plataforma/api db:generate" ;;

  contracts/build/*|contracts/aiken.lock)
    block "BLOQUEADO — '$REL' es generado por aiken. Se regenera con 'pnpm contracts:build', no se edita." ;;

  apps/web/src/routeTree.gen.ts)
    block "BLOQUEADO — routeTree.gen.ts lo genera TanStack Router. Editá las rutas en apps/web/src/routes/." ;;

  *.env|*/.env|.env)
    block "BLOQUEADO — no se escriben archivos .env desde una sesión de agente (regla 12: secretos solo por env, y los pone el humano)." ;;
esac

# Contenido: claves privadas y seeds, en cualquier archivo.
if printf '%s' "${CONTENT:-}" | grep -qE -- '-----BEGIN [A-Z ]*PRIVATE KEY-----|ed25519_sk1[a-z0-9]{10,}|root_xsk1[a-z0-9]{10,}|addr_xsk1[a-z0-9]{10,}'; then
  block "BLOQUEADO — el contenido parece contener una clave privada o seed. Regla 12: frená y avisá."
fi
exit 0
