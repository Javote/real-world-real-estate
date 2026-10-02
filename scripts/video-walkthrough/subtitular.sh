#!/usr/bin/env bash
# La otra versión del video: sin voz, con los subtítulos dibujados encima.
# Toma cada Txx.mov, le superpone las frases del runbook (Paso 4.3) en sus
# segundos, y las pega en el orden del mapa. Deja walkthrough-subtitulado.mp4
# y walkthrough-subtitulado.srt en la carpeta de grabaciones.
#
#   bash scripts/video-walkthrough/subtitular.sh          # todas las tomas que haya
#   bash scripts/video-walkthrough/subtitular.sh T01      # solo una: subtituladas/T01.mp4
#
# Cada frase queda en pantalla hasta que entra la siguiente (decisión del
# dueño, 2026-10-01: que siempre haya un subtítulo). No necesita las voces.
# El texto sale del runbook: corregir una frase ahí y volver a correr esto.
set -euo pipefail

aqui="$(cd "$(dirname "$0")" && pwd)"
CARPETA="${CARPETA:-$HOME/Movies/propnexus-walkthrough}"
command -v ffmpeg >/dev/null || { echo "Hace falta ffmpeg (brew install ffmpeg)."; exit 1; }
python3 -c "import PIL" 2>/dev/null || { echo "Hace falta Pillow (python3 -m pip install Pillow)."; exit 1; }
cd "$CARPETA" || { echo "No existe la carpeta $CARPETA"; exit 1; }
mkdir -p subtituladas
if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q h264_videotoolbox; then
  codec=(-c:v h264_videotoolbox -b:v 8M)
else
  codec=(-c:v libx264 -preset veryfast -crf 20)
fi

if [ -n "${1:-}" ]; then
  orden="$1"
else
  orden=$(node --input-type=module -e "import { leerTomas } from '$aqui/lib/tomas.mjs'; console.log(leerTomas().map((t) => t.toma).join(' '))")
fi

: > subtituladas/duraciones.txt
for toma in $orden; do
  [ -e "$toma.mov" ] || { echo "  (aviso) falta $toma.mov: no entra"; continue; }
  dv=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$toma.mov")
  cuadros="subtituladas/cuadros/$toma"
  rm -rf "$cuadros" && mkdir -p "$cuadros"
  read -r n salida < <(node "$aqui/lib/subtitulos.mjs" "$toma" "$dv" "$cuadros")
  python3 "$aqui/lib/subtitulos.py" "$cuadros"
  imagenes=()
  for i in $(seq 0 $((n - 1))); do imagenes+=(-i "$(printf '%s/c%02d.png' "$cuadros" "$i")"); done
  echo "$toma: ${dv%.*} s, $n subtítulos"
  ffmpeg -y -loglevel error -i "$toma.mov" "${imagenes[@]}" -f lavfi -i anullsrc=r=48000:cl=stereo \
    -filter_complex "$(cat "$cuadros/filtro.txt")" -map "$salida" -map "$((n + 1)):a" -t "$dv" \
    "${codec[@]}" -c:a aac -b:a 128k "subtituladas/$toma.mp4" \
    || { echo "FALLÓ $toma"; exit 1; }
  echo "$toma $dv" >> subtituladas/duraciones.txt
done

[ -n "${1:-}" ] && { echo "LISTO: $PWD/subtituladas/$1.mp4"; exit 0; }

awk -v d="$PWD" '{ printf "file '"'"'%s/subtituladas/%s.mp4'"'"'\n", d, $1 }' subtituladas/duraciones.txt > subtituladas/lista.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i subtituladas/lista.txt -c copy -movflags +faststart walkthrough-subtitulado.mp4

node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs'
import { leerTomas } from '$aqui/lib/tomas.mjs'
import { srtContinuo } from '$aqui/lib/subtitulos.mjs'
const inicio = {}, dur = {}; let t = 0
for (const l of readFileSync('subtituladas/duraciones.txt', 'utf8').trim().split('\n')) {
  const [toma, d] = l.split(' '); inicio[toma] = t; dur[toma] = Number(d); t += Number(d)
}
writeFileSync('walkthrough-subtitulado.srt', srtContinuo(leerTomas(), (k) => inicio[k], (k) => dur[k]))
" && echo "LISTO: $PWD/walkthrough-subtitulado.mp4 (+ walkthrough-subtitulado.srt)"
