#!/usr/bin/env bash
# Al terminar una sesión de grabación, pone nombre a todas sus grabaciones de
# una vez, en el orden en que se grabaron: así no hace falta renombrar a mano
# después de cada toma.
#
#   bash scripts/video-walkthrough/renombrar.sh A    # T01 (la sesión A es una sola toma)
#   bash scripts/video-walkthrough/renombrar.sh B    # T07–T28, en el orden del mapa (T22 después de T27)
#
# Con tomas largas (un archivo por bloque, Paso 2) no se usa: los archivos
# son menos que las tomas, y hay que partirlos primero.
#
# Toma los "Grabación de pantalla …" / "Screen Recording …" de la carpeta, por
# fecha de creación. Si hay más que tomas (repetiste alguna), muestra la lista
# y pregunta cuáles descartar; las descartadas van a descartadas/, no se
# borran. Nunca pisa un Txx.mov que ya exista sin preguntar.
set -euo pipefail

carpeta="${CARPETA:-$HOME/Movies/propnexus-walkthrough}"
aqui="$(cd "$(dirname "$0")" && pwd)"
# Las tomas de cada sesión, en el orden del mapa del runbook (T22 va después de T27).
orden=$(node --input-type=module -e "import { leerTomas } from '$aqui/lib/tomas.mjs'; console.log(leerTomas().map((t) => t.toma).join(' '))")
case "${1:-}" in
  A) tomas=(T01) ;;
  B) read -r -a tomas <<< "${orden#T01 }" ;;
  *) echo "Uso: renombrar.sh A|B  (A = T01, B = T07–T28)"; exit 1 ;;
esac
esperadas=${#tomas[@]}
cd "$carpeta"

archivos=()
while IFS= read -r linea; do archivos+=("${linea#* }"); done < <(
  for f in "Grabación de pantalla"*.mov "Screen Recording"*.mov; do
    [ -e "$f" ] && echo "$(stat -f %B "$f") $f"
  done | sort -n
)

duracion() {
  local d
  d=$(mdls -raw -name kMDItemDurationSeconds "$1" 2>/dev/null)
  case "$d" in ''|*null*) d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$1" 2>/dev/null) ;; esac
  echo "${d:-?}" | awk '{ if ($1 ~ /^[0-9.]+$/) printf "%3d s", $1; else print "  ? s" }'
}
listar() {
  local i=1
  for f in "${archivos[@]}"; do
    printf "  %2d. %s  %s  %s\n" "$i" "$(date -r "$(stat -f %B "$f")" +%H:%M:%S)" "$(duracion "$f")" "$f"
    i=$((i + 1))
  done
}

if [ ${#archivos[@]} -eq 0 ]; then echo "No hay grabaciones nuevas en $carpeta."; exit 1; fi

if [ ${#archivos[@]} -lt "$esperadas" ]; then
  echo "Hay ${#archivos[@]} grabaciones y la sesión $1 tiene $esperadas tomas. Falta grabar alguna:"
  listar; exit 1
fi

if [ ${#archivos[@]} -gt "$esperadas" ]; then
  echo "Hay ${#archivos[@]} grabaciones y la sesión $1 tiene $esperadas tomas. Sobran $(( ${#archivos[@]} - esperadas )):"
  listar
  printf "Números de las que se descartan, separados por espacio (normalmente, el intento malo de una toma repetida): "
  read -r -a descartes
  mkdir -p descartadas
  quedan=()
  for i in "${!archivos[@]}"; do
    n=$((i + 1)); fuera=0
    for d in "${descartes[@]:-}"; do [ "$d" = "$n" ] && fuera=1; done
    if [ "$fuera" = 1 ]; then mv "${archivos[$i]}" descartadas/; else quedan+=("${archivos[$i]}"); fi
  done
  archivos=("${quedan[@]:-}")
  if [ ${#archivos[@]} -ne "$esperadas" ]; then
    echo "Quedaron ${#archivos[@]}, no $esperadas. Las descartadas están en descartadas/; volvé a correr esto."; exit 1
  fi
fi

echo "Así quedarían:"
i=0
for t in "${tomas[@]}"; do
  printf "  %s.mov  ←  %s  (%s)\n" "$t" "${archivos[$i]}" "$(duracion "${archivos[$i]}")"
  i=$((i + 1))
done
existentes=$(for t in "${tomas[@]}"; do [ -e "$t.mov" ] && printf '%s ' "$t"; done; true)
[ -n "$existentes" ] && echo "  ! ya existen: $existentes— se reemplazan (las viejas van a descartadas/)"
printf "¿Renombro? [s/N] "
read -r resp
[ "$resp" = s ] || [ "$resp" = S ] || { echo "No se tocó nada."; exit 0; }

mkdir -p descartadas
i=0
for t in "${tomas[@]}"; do
  destino="$t.mov"
  [ -e "$destino" ] && mv "$destino" "descartadas/$destino.$(date +%H%M%S)"
  mv "${archivos[$i]}" "$destino"
  i=$((i + 1))
done
echo "✓ Sesión $1 renombrada: ${tomas[*]}."
