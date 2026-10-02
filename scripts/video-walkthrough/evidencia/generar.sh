#!/usr/bin/env bash
# Regenera los tres archivos de evidencia que se suben en cámara en T15 del
# runbook del video (specs/archive/GUION-2026-09-21-video-walkthrough.md) desde sus
# fuentes HTML en fuentes/. Los archivos generados se commitean: este script
# solo hace falta si se cambia una fuente.
#
# Los datos son ficticios y cada archivo lo dice en una banda roja: no hay PII
# ni nada que describa una propiedad, empresa o persona real.
#
# Requiere Google Chrome (headless) y sips (viene con macOS).
#   bash scripts/video-walkthrough/evidencia/generar.sh
set -euo pipefail

aqui="$(cd "$(dirname "$0")" && pwd)"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

"$chrome" --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$aqui/land-title-deed.pdf" "file://$aqui/fuentes/land-title-deed.html" 2>/dev/null

captura() { # $1 = fuente sin extensión, $2 = destino
  "$chrome" --headless=new --disable-gpu --hide-scrollbars \
    --window-size=1600,1100 --screenshot="$tmp/$1.png" "file://$aqui/fuentes/$1.html" 2>/dev/null
  case "$2" in
    *.jpg) sips -s format jpeg -s formatOptions 88 "$tmp/$1.png" --out "$aqui/$2" >/dev/null ;;
    *.png) cp "$tmp/$1.png" "$aqui/$2" ;;
  esac
}
captura site-survey-plan site-survey-plan.jpg
captura lot-location-map lot-location-map.png

for f in land-title-deed.pdf site-survey-plan.jpg lot-location-map.png; do
  echo "[evidencia] $f — $(head -c 8 "$aqui/$f" | xxd -p)"
done
