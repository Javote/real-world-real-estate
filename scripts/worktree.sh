#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ÁRBOLES DE TRABAJO POR TRACK (D-031)
#
#   scripts/worktree.sh create <track>   # web | api | contracts | <nombre>
#   scripts/worktree.sh list
#   scripts/worktree.sh remove <track>
#
# Un `git worktree add` pelado no alcanza en este repo: .env, dev.db y
# node_modules están gitignoreados (no viajan), y los puertos 3000/8787 están
# fijos, así que dos árboles corriendo la app se pisan. Este script deja el
# árbol REALMENTE usable: rama, dependencias, base sembrada y puertos propios.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; OFF=$'\033[0m'

ports_for() { # track -> "WEB_PORT API_PORT"
  case "$1" in
    web)       echo "3010 8797" ;;
    api)       echo "3020 8807" ;;
    contracts) echo "3030 8817" ;;
    *) local n=$(( ( $(cksum <<<"$1" | cut -d' ' -f1) % 40 ) + 4 )); echo "$((3000 + n*10)) $((8787 + n*10))" ;;
  esac
}

cmd_list() {
  printf '%s%-22s %-18s %-14s %s%s\n' "$BOLD" ÁRBOL RAMA PUERTOS RUTA "$OFF"
  git worktree list --porcelain | awk '/^worktree /{w=$2} /^branch /{b=$2; print w" "b}' | while read -r path branch; do
    local t; t="$(basename "$path")"; t="${t#pn-}"
    read -r wp ap <<<"$(ports_for "$t")"
    [ "$path" = "$ROOT" ] && { wp=3000; ap=8787; t="(principal)"; }
    printf '%-22s %-18s %-14s %s%s%s\n' "$t" "${branch#refs/heads/}" "$wp/$ap" "$DIM" "$path" "$OFF"
  done
}

cmd_create() {
  local track="$1" dir="../pn-$1" branch="track/$1"
  [ -e "$dir" ] && { echo "ya existe $dir — 'scripts/worktree.sh remove $track' primero"; exit 1; }
  read -r WEB_PORT API_PORT <<<"$(ports_for "$track")"

  echo "${BOLD}1/5${OFF} rama $branch desde main"
  git show-ref --verify -q "refs/heads/$branch" \
    && git worktree add "$dir" "$branch" \
    || git worktree add "$dir" -b "$branch" main
  local wt; wt="$(cd "$dir" && pwd)"

  echo "${BOLD}2/5${OFF} entorno con puertos propios (web $WEB_PORT · api $API_PORT)"
  if [ -f packages/api/.env ]; then cp packages/api/.env "$wt/packages/api/.env"
  else cp packages/api/.env.example "$wt/packages/api/.env"
       echo "   ${DIM}⚠ .env nuevo desde el ejemplo: completá JWT_SECRET${OFF}"; fi
  # PORT de la API y puerto/origen del front. Los tres los leen los configs.
  python3 - "$wt/packages/api/.env" "$API_PORT" <<'PY'
import re,sys
p,port=sys.argv[1],sys.argv[2]
s=open(p).read()
s=re.sub(r'(?m)^PORT=.*$', f'PORT={port}', s) if re.search(r'(?m)^PORT=', s) else s+f'\nPORT={port}\n'
open(p,'w').write(s)
PY
  cat > "$wt/apps/web/.env" <<EOF
# Generado por scripts/worktree.sh — puertos propios de este árbol (D-031).
# Sin este archivo, el árbol usa 3000/8787 y choca con el principal.
WEB_PORT=$WEB_PORT
API_ORIGIN=http://localhost:$API_PORT
EOF

  echo "${BOLD}3/5${OFF} dependencias (hardlinks del store, no copia)"
  ( cd "$wt" && pnpm install --silent )

  echo "${BOLD}4/5${OFF} base de datos propia del árbol"
  ( cd "$wt" && pnpm --filter @plataforma/api db:generate >/dev/null \
             && pnpm --filter @plataforma/api db:migrate >/dev/null \
             && pnpm --filter @plataforma/api db:seed >/dev/null ) \
    || echo "   ${DIM}⚠ la base no se pudo sembrar (¿JWT_SECRET vacío?) — corré db:seed a mano${OFF}"

  echo "${BOLD}5/5${OFF} listo"
  cat <<EOF

${GREEN}Árbol '$track' listo${OFF} en ${BOLD}$wt${OFF}
  rama      $branch
  puertos   web http://localhost:$WEB_PORT · api http://localhost:$API_PORT
  sesión    cd $wt && claude

Al terminar la rebanada, desde el árbol:
  git push -u origin $branch      # corre la puerta sola (hook)
  cd $ROOT && git merge --ff-only $branch && git push && scripts/worktree.sh remove $track
EOF
}

cmd_remove() {
  local track="$1" dir="../pn-$1"
  [ -d "$dir" ] || { echo "no existe $dir"; exit 1; }
  if [ -n "$(cd "$dir" && git status --porcelain)" ]; then
    echo "⚠ '$track' tiene cambios sin commitear. Commiteá o descartá antes de borrarlo:"
    (cd "$dir" && git status --short | head)
    exit 1
  fi
  local branch="track/$track"
  if ! git merge-base --is-ancestor "$branch" main 2>/dev/null; then
    echo "⚠ '$branch' tiene commits que no están en main. Integralos primero:"
    echo "    git merge --ff-only $branch"
    exit 1
  fi
  git worktree remove "$dir"
  git branch -d "$branch" 2>/dev/null || true
  echo "árbol '$track' eliminado; rama integrada y borrada"
}

case "${1:-list}" in
  create) shift; [ $# -eq 1 ] || { echo "uso: worktree.sh create <track>"; exit 2; }; cmd_create "$1" ;;
  remove) shift; [ $# -eq 1 ] || { echo "uso: worktree.sh remove <track>"; exit 2; }; cmd_remove "$1" ;;
  list)   cmd_list ;;
  *) sed -n '4,8p' "$0"; exit 2 ;;
esac
