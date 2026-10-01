#!/usr/bin/env bash
# Paso 5 del runbook del video, con ffmpeg: une el video y la voz de cada toma
# y pega las 18 en el orden del mapa del runbook (T01, T07, T09, T12–T14, T17–T21, T23–T27, T22, T28). Deja walkthrough-final.mp4 y walkthrough-final.srt
# (subtítulos en inglés, sacados del runbook) en la carpeta de grabaciones.
#
#   bash scripts/video-walkthrough/unir.sh
#
# La voz puede venir del estudio (Txx.webm, grabada en sincronía con el video:
# entra tal cual) o de QuickTime (Txx.m4a: se le recorta el silencio del
# principio y la primera frase entra en 0:01). Si hay las dos, usa la más nueva.
# Sin ffmpeg: el estudio tiene el mismo montaje, desde el navegador.
set -euo pipefail

aqui="$(cd "$(dirname "$0")" && pwd)"
CARPETA="${CARPETA:-$HOME/Movies/propnexus-walkthrough}"
command -v ffmpeg >/dev/null || {
  echo "No hay ffmpeg: usá el montaje del estudio (node scripts/video-walkthrough/estudio/servidor.mjs → \"Armar el video final\")."
  exit 1
}
cd "$CARPETA" || { echo "No existe la carpeta $CARPETA"; exit 1; }
mkdir -p unidas
if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q h264_videotoolbox; then
  codec=(-c:v h264_videotoolbox -b:v 10M)
else
  codec=(-c:v libx264 -preset veryfast -crf 20)
fi

: > unidas/duraciones.txt
# El orden es el del mapa del runbook, no el del nombre: T22 va después de T27.
orden=$(node --input-type=module -e "import { leerTomas } from '$aqui/lib/tomas.mjs'; console.log(leerTomas().map((t) => t.toma).join(' '))")
for toma in $orden; do
  video="$toma.mov"
  [ -e "$video" ] || { echo "  (aviso) falta $video: no entra"; continue; }
  dv=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$video")
  voz=$(ls -t "$toma.webm" "$toma.m4a" 2>/dev/null | head -1 || true)
  if [ -n "$voz" ]; then
    da=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$voz" || true)
    audio=(-i "$voz")
    case "$voz" in
      *.m4a) filtro="silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,adelay=1000:all=1," ;;
      *) filtro="" ;;
    esac
  else
    echo "  (aviso) $toma no tiene voz: va en silencio"
    da=0
    audio=(-f lavfi -i anullsrc=r=48000:cl=stereo)
    filtro=""
  fi
  dur=$(awk -v a="$dv" -v b="$da" 'BEGIN { if (b !~ /^[0-9.]+$/) b = 0; m = (a > b ? a : b); printf "%.2f", m + 0.5 }')
  echo "$toma: video ${dv%.*} s, voz ${voz:-—} -> queda en ${dur%.*} s"
  ffmpeg -y -loglevel error -i "$video" "${audio[@]}" -filter_complex \
    "[0:v]scale=1920:1200:force_original_aspect_ratio=decrease,pad=1920:1200:(ow-iw)/2:(oh-ih)/2:color=white,fps=30,format=yuv420p,tpad=stop_mode=clone:stop_duration=600[v];[1:a]${filtro}aresample=48000,aformat=channel_layouts=stereo,apad[a]" \
    -map "[v]" -map "[a]" -t "$dur" \
    "${codec[@]}" -c:a aac -b:a 192k "unidas/$toma.mp4" \
    || { echo "FALLÓ $toma — mandale este mensaje a quien te pasó el runbook"; exit 1; }
  echo "$toma $dur" >> unidas/duraciones.txt
done
awk -v d="$PWD" '{ printf "file '"'"'%s/unidas/%s.mp4'"'"'\n", d, $1 }' unidas/duraciones.txt > unidas/lista.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i unidas/lista.txt -c copy walkthrough-final.mp4

node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs'
import { leerTomas, srt } from '$aqui/lib/tomas.mjs'
const inicios = {}; let t = 0
for (const l of readFileSync('unidas/duraciones.txt', 'utf8').trim().split('\n')) {
  const [toma, d] = l.split(' '); inicios[toma] = t; t += Number(d)
}
writeFileSync('walkthrough-final.srt', srt(leerTomas(), (k) => inicios[k]))
" && echo "LISTO: $PWD/walkthrough-final.mp4 (+ walkthrough-final.srt)"
