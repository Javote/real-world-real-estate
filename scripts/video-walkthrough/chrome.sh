#!/usr/bin/env bash
# Abre el Chrome de la grabación: una instancia aparte, con su propio perfil
# (~/Library/Application Support/PropNexusDemo), que no toca el Chrome de todos
# los días. Es el Paso 1.2 del runbook del video.
#
#   bash scripts/video-walkthrough/chrome.sh
#
# El perfil nace con el guardado de contraseñas, el traductor y el primer
# arranque apagados, y la barra de herramientas escondida en pantalla completa.
# Abre las cinco pestañas en /login, en el orden del runbook (1 investor …
# 5 admin). Abiertas desde acá y no con un clic desde otra, cada pestaña tiene
# su propia sesión.
set -euo pipefail

perfil="$HOME/Library/Application Support/PropNexusDemo"
login="${PROPNEXUS_WEB:-https://propnexus-web.onrender.com}/login"

if [ ! -f "$perfil/Default/Preferences" ]; then
  mkdir -p "$perfil/Default"
  : > "$perfil/First Run"
  cat > "$perfil/Default/Preferences" <<'JSON'
{
  "credentials_enable_service": false,
  "credentials_enable_autosignin": false,
  "profile": { "password_manager_enabled": false, "name": "PropNexus Demo" },
  "autofill": { "profile_enabled": false, "credit_card_enabled": false },
  "translate": { "enabled": false },
  "browser": { "show_fullscreen_toolbar": false, "has_seen_welcome_page": true },
  "download": { "prompt_for_download": false }
}
JSON
  echo "Perfil PropNexus Demo creado."
fi

if pgrep -f -- "--user-data-dir=$perfil" >/dev/null; then
  echo "El Chrome de la grabación ya está abierto: usá esa ventana (o cerralo con Cmd+Q y volvé a correr esto)."
  exit 0
fi

open -na "Google Chrome" --args --user-data-dir="$perfil" \
  --no-first-run --no-default-browser-check --disable-features=Translate \
  "$login" "$login" "$login" "$login" "$login"

cat <<EOF
Chrome de la grabación abierto con 5 pestañas en /login.
Ahora, en esa ventana (Paso 1.2 del runbook):
  1. Cmd+2, Cmd+3, Cmd+4, Cmd+5: entrá en cada una con su rol (2 developer, 3 certifier,
     4 notary, 5 admin — en la 5 tipeá admin@example.com). La contraseña se tipea.
  2. La primera vez: Cmd + '+' una vez (zoom 110%, queda guardado).
  3. Cmd+1: entrá con buyer@ igual que las otras (el video arranca ya adentro, T01).
  4. Las cinco en inglés: toggle del header → EN en una, y Cmd+R en las otras.
Después, la pasada de calentamiento (1.3) y Cmd+Ctrl+F para pantalla completa (1.4).
EOF
