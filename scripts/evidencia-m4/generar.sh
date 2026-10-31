#!/usr/bin/env bash
# Builds the Milestone 4 evidence: one PDF per .md in specs/evidencia-m4-fuentes/, in the visual
# style of the Whitepaper v1.0, written to specs/evidencia-m4/.
#
# Requires pandoc, Google Chrome (headless, for printing) and the Montserrat font installed.
#   bash scripts/evidencia-m4/generar.sh            (todos)
#   SOLO=2-mainnet bash scripts/evidencia-m4/generar.sh   (uno)
set -euo pipefail

raiz="$(cd "$(dirname "$0")/../.." && pwd)"
aqui="$raiz/scripts/evidencia-m4"
fuentes="$raiz/specs/evidencia-m4-fuentes"
salida="$raiz/specs/evidencia-m4"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$salida"

# fuente.md | PDF de salida | con portada | etiqueta | título | bajada
docs=(
  "1-pilot/pilot-report.md|M4-1-Pilot-Report.pdf|si|MILESTONE 4 · EVIDENCE 1|Pilot Report|Pilot execution on Cardano mainnet: metrics, successes, incidents and the notary's attestation on data integrity"
  "2-mainnet/mainnet-deployment.md|M4-2-Mainnet-Deployment.pdf|si|MILESTONE 4 · EVIDENCE 2|Mainnet Deployment|Mainnet URL and contract addresses, the mainnet transaction list, operational dashboards, and governance and operations playbooks"
  "3-docs/documentation-package.md|M4-3-Documentation-Package.pdf|si|MILESTONE 4 · EVIDENCE 3|Updated Documentation Package|Whitepaper v1.1, user manual, API, runbooks, and the notary-verified dossier of one unit"
  "sign-offs/legal-greenlight-mainnet.md|M4-Sign-off-Legal-Greenlight-Mainnet.pdf|no|||"
  "sign-offs/notary-data-integrity.md|M4-Sign-off-Notary-Data-Integrity.pdf|no|||"
)

for d in "${docs[@]}"; do
  IFS='|' read -r md pdf portada etiqueta titulo bajada <<<"$d"
  if [ -n "${SOLO:-}" ] && [[ "$md" != *"$SOLO"* ]]; then continue; fi
  dir="$fuentes/$(dirname "$md")"
  html="$dir/.$(basename "$md" .md).html"
  args=(--metadata pagetitle="${titulo:-$(grep -m1 '^# ' "$fuentes/$md" | sed 's/^# //')}")
  if [ "$portada" = si ]; then
    args+=(--metadata portada=true --metadata etiqueta="$etiqueta" --metadata titulo="$titulo"
      --metadata bajada="$bajada" --metadata fecha="October 31, 2026")
  else
    args+=(--metadata sinsalto=true)
  fi
  cp "$aqui/cover.jpg" "$dir/"
  # <!-- include: ruta --> se reemplaza por el archivo (tablas generadas desde los datos verificados).
  python3 -I -c 'import re,sys,os; d=os.path.dirname(sys.argv[1]); s=open(sys.argv[1]).read(); print(re.sub(r"<!-- include: (\S+) -->", lambda m: open(os.path.join(os.path.dirname(d) if m.group(1).startswith("_gen") else d, m.group(1))).read(), s))' "$fuentes/$md" > "$tmp/doc.md"
  pandoc "$tmp/doc.md" --resource-path="$dir" --from gfm+implicit_figures --to html5 --template "$aqui/plantilla.tpl" \
    --variable css="$(cat "$aqui/estilo.css")" "${args[@]}" -o "$html"
  "$chrome" --headless=new --disable-gpu --no-pdf-header-footer --allow-file-access-from-files \
    --print-to-pdf="$salida/$pdf" "file://$html" 2>/dev/null
  rm -f "$html" "$dir/cover.jpg"
  echo "[evidencia-m4] $salida/$pdf"
done
