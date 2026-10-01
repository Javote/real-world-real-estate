#!/usr/bin/env bash
# Paso 0 del runbook del video (specs/archive/GUION-2026-09-21-video-walkthrough.md):
# todo lo que se prepara UNA vez. Se puede correr de nuevo sin romper nada.
#
#   bash scripts/video-walkthrough/preparar.sh
#
# Crea las carpetas, copia los tres archivos de evidencia, chequea disco,
# Chrome, Node y ffmpeg, y verifica producción (solo lectura).
set -uo pipefail

aqui="$(cd "$(dirname "$0")" && pwd)"
carpeta="${CARPETA:-$HOME/Movies/propnexus-walkthrough}"
evidencia="$HOME/Movies/propnexus-evidencia"
problemas=0
ok() { echo "  ✓ $*"; }
mal() { echo "  ✗ $*"; problemas=$((problemas + 1)); }

echo "Carpetas"
mkdir -p "$carpeta" "$evidencia"
ok "grabaciones: $carpeta"
cp "$aqui"/evidencia/land-title-deed.pdf "$aqui"/evidencia/site-survey-plan.jpg "$aqui"/evidencia/lot-location-map.png "$evidencia"/
ok "evidencia para T15: $evidencia ($(ls "$evidencia" | tr '\n' ' '))"

echo "Disco"
libres_gb=$(df -g / | awk 'NR==2 {print $4}')
if [ "$libres_gb" -ge 15 ]; then ok "$libres_gb GB libres (hacen falta 15)"
else mal "$libres_gb GB libres: hacen falta 15. Lo más fácil de liberar (se vuelve a llenar solo):"
     echo "      rm -rf ~/.npm ~/Library/pnpm/store ~/.cache/uv ~/.cache/puppeteer"; fi

echo "Programas"
if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then ok "Google Chrome"; else mal "falta Google Chrome"; fi
if command -v node >/dev/null; then ok "Node $(node --version)"; else mal "falta Node (lo usan el estudio de voz y el verificador)"; fi
if command -v ffmpeg >/dev/null; then ok "ffmpeg $(ffmpeg -version | head -1 | awk '{print $3}') — el Paso 5 usa unir.sh"
else echo "  · sin ffmpeg: el Paso 5 se hace desde el estudio (modo Montaje). No hace falta instalar nada."; fi

echo "Grabador de macOS (Shift+Cmd+5 → Opciones), una vez a mano:"
echo "  · Guardar en: Otra ubicación… → $carpeta"
echo "  · Temporizador: ninguno · Micrófono: ninguno · Mostrar clics del mouse: SÍ"

echo "Producción (solo lectura)"
node "$aqui/verificar-produccion.mjs" | sed 's/^/  /' || problemas=$((problemas + 1))

echo
if [ "$problemas" -eq 0 ]; then echo "✓ Paso 0 listo. Siguiente: bash scripts/video-walkthrough/chrome.sh"
else echo "✗ $problemas problema(s) arriba."; exit 1; fi
