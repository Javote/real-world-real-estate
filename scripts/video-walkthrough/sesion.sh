#!/usr/bin/env bash
# Abre y cierra una sesión de grabación del video (Pasos 1.1, 1.2 y 6.1 del
# runbook). Se corre en una Terminal aparte al empezar cada sesión, y queda
# abierta mientras se graba:
#
#   bash scripts/video-walkthrough/sesion.sh
#
# Al arrancar: esconde los íconos del escritorio, hace que las grabaciones de
# Shift+Cmd+5 caigan en la carpeta del video, ofrece cerrar las apps que
# tiran notificaciones, chequea cargador y disco, y despierta Render.
# Mientras corre: un ping cada 10 minutos para que Render no se duerma entre
# tomas. Con Ctrl-C: devuelve los íconos del escritorio y se apaga.
#
# NO es el keep-warm que prohíbe D-040 (un cron 24/7 que agota las horas del
# plan Free): es un loop atendido que dura la sesión. Nunca pasarlo a crontab.
set -uo pipefail

api="${PROPNEXUS_API:-https://propnexus-api.onrender.com}"
web="${PROPNEXUS_WEB:-https://propnexus-web.onrender.com}"
carpeta="${CARPETA:-$HOME/Movies/propnexus-walkthrough}"
escritorio_escondido=0
ubicacion_previa=$(defaults read com.apple.screencapture location 2>/dev/null || true)
ubicacion_cambiada=0

cerrar() {
  trap - INT TERM EXIT
  echo
  if [ "$escritorio_escondido" = 1 ]; then
    defaults write com.apple.finder CreateDesktop true && killall Finder
    echo "✓ Íconos del escritorio de vuelta."
  fi
  if [ "$ubicacion_cambiada" = 1 ]; then
    if [ -n "$ubicacion_previa" ]; then defaults write com.apple.screencapture location "$ubicacion_previa"
    else defaults delete com.apple.screencapture location 2>/dev/null; fi
    echo "✓ Las capturas de pantalla vuelven a guardarse donde antes."
  fi
  echo "✓ Keep-alive apagado. Acordate: No molestar OFF."
  exit 0
}
trap cerrar INT TERM EXIT

echo "Antes de grabar"
defaults write com.apple.finder CreateDesktop false && killall Finder
escritorio_escondido=1
echo "  ✓ íconos del escritorio escondidos (vuelven con Ctrl-C)"
mkdir -p "$carpeta"
defaults write com.apple.screencapture location "$carpeta"
ubicacion_cambiada=1
echo "  ✓ las grabaciones se guardan en $carpeta (vuelve a lo anterior con Ctrl-C)"

abiertas=()
for app in Mail Messages WhatsApp Slack "Docker Desktop" Spotify Music Calendar Reminders; do
  if pgrep -xq "$app"; then
    abiertas+=("$app")
  fi
done
if [ ${#abiertas[@]} -gt 0 ]; then
  printf "  ! abiertas: %s. ¿Las cierro? [s/N] " "${abiertas[*]}"
  read -r resp
  if [ "$resp" = s ] || [ "$resp" = S ]; then
    for app in "${abiertas[@]}"; do osascript -e "quit app \"$app\"" 2>/dev/null; done
    echo "  ✓ cerradas"
  fi
else
  echo "  ✓ ninguna app de notificaciones abierta"
fi

if pmset -g batt | grep -q "AC Power"; then echo "  ✓ cargador enchufado"
else echo "  ✗ SIN CARGADOR: enchufala, con batería esta Mac graba a los saltos"; fi
libres_gb=$(df -g / | awk 'NR==2 {print $4}')
if [ "$libres_gb" -ge 15 ]; then echo "  ✓ $libres_gb GB libres"
else echo "  ✗ $libres_gb GB libres: hacen falta 15"; fi
echo "  · a mano: No molestar ON (Centro de control → Concentración)"

echo "Despertando Render (en frío puede tardar más de un minuto)…"
for i in 1 2 3 4 5 6; do
  if curl -fs -o /dev/null --max-time 100 "$api/health"; then echo "  ✓ API despierta"; break; fi
  echo "  … sigue durmiendo, reintento ($i)"
done
curl -fs -o /dev/null --max-time 100 "$web/" && echo "  ✓ web despierta"

echo
echo "Keep-alive corriendo: dejá esta Terminal abierta. Ctrl-C al terminar la sesión."
while true; do
  sleep 600 &
  wait $!
  estado_api=$(curl -s -o /dev/null -w '%{http_code}' --max-time 100 "$api/health")
  estado_web=$(curl -s -o /dev/null -w '%{http_code}' --max-time 100 "$web/")
  echo "  $(date +%H:%M) api $estado_api · web $estado_web"
done
