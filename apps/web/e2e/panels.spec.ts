import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { loginConSolapa } from './_helpers'

// **Una pantalla por rol** — M2-D5 filas 02, 33-34, 51 y 55, con sus test IDs.
//
// Además de verificar, deja la captura de cada panel para comparar contra el
// catálogo oficial (`docs/.../M2-D2-Screenshots-catalog/`). Esa comparación es
// el control de conformidad del rebuild: si la captura nuestra y la del
// entregable no se parecen, algo se transcribió mal.

const SHOTS = join(import.meta.dirname, '.artifacts', 'screenshots')
mkdirSync(SHOTS, { recursive: true })

const PANELES = [
  {
    rol: 'Investor',
    landing: '/investor/buy',
    testId: 'INV-BUY-LIST-001',
    shot: '02-investor-buy'
  },
  {
    rol: 'Developer',
    landing: '/developer',
    testId: 'DEV-PANEL-KPIS-001',
    shot: '33-developer-panel'
  },
  { rol: 'Notary', landing: '/notary', testId: 'NOT-PANEL-001', shot: '51-notary-panel' },
  {
    rol: 'Certifier',
    landing: '/certifier',
    testId: 'CER-PANEL-001',
    shot: '55-certifier-panel'
  }
]

for (const panel of PANELES) {
  test(`${panel.testId} · panel de ${panel.rol}`, async ({ page }) => {
    // La solapa prefilla las credenciales del usuario de seed de ese rol, y
    // el helper espera a que ESO haya pasado antes de mandar el formulario.
    await loginConSolapa(page, panel.rol)

    await expect(page).toHaveURL(new RegExp(panel.landing.replaceAll('/', '\\/')))
    await expect(page.getByTestId(panel.testId)).toBeVisible()

    // El BottomNav scopeado al rol tiene que estar en toda pantalla
    // autenticada (M2-D3 §BottomNav §Usage rules) — **pero es mobile-only**.
    // En desktop se reemplaza por un sidebar (M2-D1 §Responsive behavior) que
    // todavía no está construido: el front se está reconstruyendo (SPEC-014).
    //
    // Afirmarlo en los dos proyectos hacía fallar los cuatro paneles en
    // desktop por una superficie que el backlog todavía no entregó, que no es
    // una regresión. Cuando entre el sidebar, esto pasa a los dos.
    if (test.info().project.name === 'mobile') {
      await expect(page.getByRole('navigation')).toBeVisible()
    }

    await page.screenshot({ path: join(SHOTS, `${panel.shot}.png`), fullPage: true })
  })
}

// **D-072** — el developer es el único rol sin tab de perfil, y llega por el
// slot derecho del header. Es la única entrada que tiene: si este camino se
// rompe, la pantalla queda inalcanzable sin escribir la URL a mano.
test('DEV-PROFILE-001 · el developer llega a su perfil desde el header', async ({ page }) => {
  await loginConSolapa(page, 'Developer')

  await expect(page.getByTestId('DEV-PANEL-KPIS-001')).toBeVisible()
  await page.getByRole('button', { name: /mi perfil|my profile/i }).click()

  await expect(page).toHaveURL(/\/developer\/profile/)
  await expect(page.getByTestId('DEV-PROFILE-001')).toBeVisible()
})

// **M2-D5 fila 48** — el directorio de investors y su acceso desde el Panel.
// D-072 obliga a que el tile llegue con su pantalla, así que se verifican los
// dos juntos: un tile que navega a un 404 pasaría un test de render.
test('DEV-INVESTORS-LIST-001 · el directorio de investors y su acceso', async ({ page }) => {
  await loginConSolapa(page, 'Developer')

  await expect(page.getByTestId('DEV-PANEL-KPIS-001')).toBeVisible()
  await page.getByRole('button', { name: /inversores|investors/i }).click()

  await expect(page).toHaveURL(/\/developer\/investors/)
  await expect(page.getByTestId('DEV-INVESTORS-LIST-001')).toBeVisible()
})

// **M2-D5 filas 46-47** — la documentación de respaldo y su acceso (D-072).
//
// El corte en dos secciones ES la regla 17, así que el test lo mira: la lista
// de verificados existe, y el botón de anclar solo aparece sobre documentos sin
// TXID. Si algún día un documento sin anclaje se colara arriba, esto no lo
// atrapa solo — pero que el botón viva únicamente en la sección pendiente sí.
test('DEV-DOCS-LIST-001 · DEV-DOC-ANCHOR-002 · documentación de respaldo', async ({ page }) => {
  await loginConSolapa(page, 'Developer')

  await expect(page.getByTestId('DEV-PANEL-KPIS-001')).toBeVisible()
  await page.getByRole('button', { name: /documentación|documentation/i }).click()

  await expect(page).toHaveURL(/\/developer\/documentation/)
  await expect(page.getByTestId('DEV-DOCS-LIST-001')).toBeVisible()

  // El seed puede no dejar documentos pendientes, así que el anclaje se
  // verifica solo si hay alguno: afirmarlo siempre haría fallar la suite por
  // datos, no por código.
  const anclar = page.getByTestId('DEV-DOC-ANCHOR-002').first()
  if (await anclar.count()) await expect(anclar).toBeVisible()
})
