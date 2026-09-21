#!/usr/bin/env bash
# Genera un PDF al lado de cada .md de specs/evidencia-m3/ (la evidencia de M3
# que se entrega a Catalyst). El .md es la fuente; el PDF se regenera con este
# script cada vez que cambia uno, en el mismo commit.
#
# Requiere pandoc y Google Chrome (lo usa headless para imprimir el HTML).
#   bash scripts/evidencia-pdf/generar.sh
set -euo pipefail

raiz="$(cd "$(dirname "$0")/../.." && pwd)"
aqui="$raiz/scripts/evidencia-pdf"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

cd "$raiz/specs/evidencia-m3"
find . -name '*.md' -print0 | while IFS= read -r -d '' md; do
  dir="$(dirname "$md")"
  base="$(basename "$md" .md)"
  html="$tmp/$(echo "$md" | tr '/' '_').html"
  pdf="$dir/$base.pdf"
  titulo="$(grep -m1 '^# ' "$md" | sed 's/^# //')"

  DOC_DIR="$dir" pandoc "$md" --from gfm --to html5 --standalone --embed-resources \
    --resource-path="$dir" --lua-filter="$aqui/links-a-pdf.lua" \
    --css="$aqui/estilo.css" --metadata title="${titulo:-$base}" -o "$html"

  "$chrome" --headless=new --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="$PWD/$pdf" "file://$html" 2>/dev/null
  echo "[evidencia-pdf] $pdf"
done
