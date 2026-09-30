// Genera los íconos de la PWA (SPEC-222) desde las tres barras de
// `PropNexusMark` — la única marca que definen las capturas. Los PNG se
// commitean; esto se vuelve a correr solo si cambia la marca:
//
//   node apps/web/scripts/iconos.mjs
//
// Usa el Chromium de Playwright, que el repo ya instala para los e2e: no
// suma ninguna dependencia para rasterizar un SVG.

import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// `--color-primary` de `styles.css` (M2-D3).
const PRIMARY = '#6d4aff'

// Las tres barras de `PropNexusMark.tsx`, en su viewBox de 28. Su caja va de
// (1,1) a (25,27): el centro es (13,14).
const BARRAS =
  '<rect x="1" y="16" width="6" height="11" rx="1"/>' +
  '<rect x="10" y="9" width="6" height="18" rx="1"/>' +
  '<rect x="19" y="1" width="6" height="26" rx="1"/>'

function svg({ redondeado, escala }) {
  const fondo = redondeado
    ? `<rect width="512" height="512" rx="112" fill="${PRIMARY}"/>`
    : `<rect width="512" height="512" fill="${PRIMARY}"/>`
  return (
    // El `<title>` es la marca, no una traducción (D-018): nombra al SVG
    // cuando se usa como favicon.
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><title>PropNexus</title>' +
    fondo +
    `<g fill="#ffffff" transform="translate(256 256) scale(${escala}) translate(-13 -14)">` +
    BARRAS +
    '</g></svg>'
  )
}

// "any": esquinas redondeadas, las barras ocupan ~60% del alto.
const ANY = svg({ redondeado: true, escala: 11 })
// "maskable" y Apple: fondo a sangre, las barras dentro del círculo seguro
// (radio 40% del lado) que el sistema operativo nunca recorta.
const A_SANGRE = svg({ redondeado: false, escala: 9 })

const SALIDAS = [
  { archivo: 'icons/icon-192.png', svg: ANY, lado: 192 },
  { archivo: 'icons/icon-512.png', svg: ANY, lado: 512 },
  { archivo: 'icons/icon-maskable-512.png', svg: A_SANGRE, lado: 512 },
  { archivo: 'icons/apple-touch-icon.png', svg: A_SANGRE, lado: 180 }
]

await writeFile(join(PUBLIC, 'icons/icon.svg'), `${ANY}\n`)

const navegador = await chromium.launch()
try {
  for (const { archivo, svg: fuente, lado } of SALIDAS) {
    const pagina = await navegador.newPage({ viewport: { width: lado, height: lado } })
    await pagina.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${lado}px;height:${lado}px}</style>${fuente}`
    )
    await pagina.screenshot({ path: join(PUBLIC, archivo), omitBackground: true })
    await pagina.close()
  }
} finally {
  await navegador.close()
}
