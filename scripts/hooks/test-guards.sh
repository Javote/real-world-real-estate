#!/usr/bin/env bash
# Suite de regresión de los guardias. Corré esto después de tocar cualquier hook.
#
#   scripts/hooks/test-guards.sh
#
# Por qué es un archivo y no comandos sueltos: los payloads de prueba contienen
# comandos destructivos y pushes literales, así que no se pueden tipear en una
# línea de comando — el propio guardia la bloquearía. Tres cosas que ya pasaron
# el 2026-08-20 y que esta suite fija:
#   · el guardia matcheaba la MENCIÓN de docs/ en vez del destino de escritura,
#     y se bloqueó a sí mismo al escribirse;
#   · matcheaba `git push` dentro de un heredoc y disparaba la puerta al escribir
#     un skill que documenta el push;
#   · el fixture de clave privada se arma en runtime (ver FAKE_KEY), porque si el
#     literal estuviera en el archivo, guard-write.sh bloquearía este archivo;
#   · la suite heredaba GATE_ALLOW_DOCS del entorno y "pasaba" sin verificar
#     nada: ahora es hermética (ver el unset de abajo).
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
export CLAUDE_PROJECT_DIR="$PWD"
H="scripts/hooks"

# HERMÉTICO. Sin esto, correr la puerta con GATE_ALLOW_DOCS=1 hacía que la suite
# heredara el escape y "pasara" sin verificar nada de lo que dice verificar: el
# escape desactivaba en silencio su propia verificación. Los escapes se prueban
# explícitos, escritos en el comando de cada caso.
unset GATE_ALLOW_DOCS GATE_SKIP_CONTRACTS

# Clave falsa armada por concatenación: el literal completo nunca existe en disco.
FAKE_KEY="ed25519_sk""1qqqqqqqqqqqqqqqqqqqq"

PASS=0; FAIL=0
check() { # check <exit esperado> <hook> <payload> <descripción>
  local want="$1" hook="$2" payload="$3" desc="$4" got
  printf '%s' "$payload" | "$H/$hook" >/dev/null 2>&1; got=$?
  if [ "$got" = "$want" ]; then printf '  ✔ %s\n' "$desc"; PASS=$((PASS+1))
  else printf '  ✘ %s  (esperaba %s, dio %s)\n' "$desc" "$want" "$got"; FAIL=$((FAIL+1)); fi
}
analyze() { # analyze <esperado: cadena o "-"> <comando> <descripción>
  local want="$1" cmd="$2" desc="$3" got
  got="$(python3 "$H/analyze-cmd.py" "$cmd" | tr '\n' ' ' | sed 's/ $//')"
  [ "$want" = "-" ] && want=""
  if [ "$got" = "$want" ]; then printf '  ✔ %s\n' "$desc"; PASS=$((PASS+1))
  else printf '  ✘ %s  (esperaba "%s", dio "%s")\n' "$desc" "$want" "$got"; FAIL=$((FAIL+1)); fi
}
w() { printf '{"tool_name":"Write","tool_input":{"file_path":"%s","content":"%s"}}' "$1" "${2:-x}"; }
b() { printf '{"tool_name":"Bash","tool_input":{"command":"%s"}}' "$1"; }

echo "guard-write.sh — escrituras por herramienta"
check 2 guard-write.sh "$(w "$PWD/docs/README.md")"                                    "editar un entregable de docs/"
check 2 guard-write.sh "$(w "$PWD/packages/api/drizzle/0000_kind_vulcan.sql")"          "editar una migración ya aplicada"
check 2 guard-write.sh "$(w "$PWD/contracts/build/x.json")"                             "editar contracts/build/ (generado)"
check 2 guard-write.sh "$(w "$PWD/apps/web/src/routeTree.gen.ts")"                      "editar routeTree.gen.ts (generado)"
check 2 guard-write.sh "$(w "$PWD/packages/api/.env")"                                  "escribir un .env"
check 2 guard-write.sh "$(w "$PWD/scripts/x.sh" "SEED=$FAKE_KEY")"                      "clave privada en el contenido"
check 0 guard-write.sh "$(w "$PWD/apps/web/src/routes/login.tsx")"                      "editar código normal"
check 0 guard-write.sh "$(w "$PWD/specs/SPEC-008.md")"                                  "escribir una spec"
check 0 guard-write.sh "$(w "$PWD/packages/api/drizzle/0001_nueva.sql")"                "crear una migración nueva"

echo "guard-bash.sh — escrituras por shell (destino, no mención)"
check 0 guard-bash.sh "$(b 'grep -rn hash docs/ | head')"                               "grepear docs/"
check 0 guard-bash.sh "$(b 'ls -la docs/milestone-2-diseno/')"                          "listar docs/"
check 2 guard-bash.sh "$(b 'echo hola > docs/README.md')"                               "redirigir hacia docs/"
check 2 guard-bash.sh "$(b 'sed -i \"\" s/a/b/ docs/README.md')"                        "sed -i sobre docs/"
check 2 guard-bash.sh "$(b 'rm -rf docs/milestone-1-fundamentos')"                      "borrar una carpeta de docs/"
check 2 guard-bash.sh "$(b 'echo x >> packages/api/drizzle/0000_kind_vulcan.sql')"       "apendear a una migración aplicada"
check 2 guard-bash.sh "$(b 'git push --force origin main')"                             "push forzado"

echo "analyze-cmd.py — el heredoc es DATO, no código"
analyze "-"      'cat > x.md <<EOF
ver docs/README.md y M2-D5
EOF'                                                                                    "docs/ mencionado en un heredoc"
analyze "-"      'cat > x.md <<EOF
> docs/ es ley sobre las obligaciones
EOF'                                                                                    "cita markdown que empieza con >"
analyze "-"      'cat > skill.md <<EOF
Al terminar: git push -u origin track/web
EOF'                                                                                    "git push documentado dentro de un heredoc"
analyze "WRITE=docs/" 'echo x > docs/a.md'                                              "escritura real a docs/"
analyze "PUSH=1"      'git push'                                                        "push pelado"
analyze "PUSH=1"      'scripts/gate.sh && git push -u origin main'                      "push después de &&"
analyze "PUSH=1 FORCE=1" 'git push --force'                                             "push forzado"
analyze "PUSH=1"      'git push --force-with-lease'                                     "force-with-lease no cuenta como forzado"
analyze "-"           'echo "no corras git push todavía"'                               "git push dentro de un string"
analyze "PUSH=1 ENV=GATE_ALLOW_DOCS=1" 'GATE_ALLOW_DOCS=1 git push'                     "el escape documentado se reenvía a la puerta"
analyze "PUSH=1"      'CUALQUIERA=1 git push'                                           "una variable no reconocida NO se reenvía"

echo "analyze-cmd.py — el escape vale igual para escrituras que para el push"
analyze "WRITE=docs/" 'git rm docs/x.md'                                                "sin escape, borrar en docs/ se bloquea"
analyze "-"           'GATE_ALLOW_DOCS=1 git rm docs/x.md'                              "con el escape inline, se permite"
analyze "WRITE=docs/" 'GATE_ALLOW_DOCS=0 git rm docs/x.md'                              "el escape en 0 no habilita nada"
analyze "WRITE=docs/" 'OTRA_VAR=1 git rm docs/x.md'                                     "otra variable no habilita nada"

echo
echo "check-project-access.py — la segunda capa no se puede olvidar en silencio"
if OUT="$(python3 scripts/check-project-access.py --self-test 2>&1)"; then
  printf '%s\n' "$OUT" | grep '✔' | sed 's/^/  /'
  PASS=$((PASS + $(printf '%s' "$OUT" | grep -c '✔')))
else
  printf '%s\n' "$OUT" | sed 's/^/  /'
  FAIL=$((FAIL + 1))
fi

printf '\n%s pasaron · %s fallaron\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
