import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

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
    await page.goto('/login')
    // La solapa prefilla las credenciales del usuario de seed de ese rol.
    await page.getByRole('tab', { name: panel.rol }).click()
    await page.getByRole('button', { name: /ingresar|sign in/i }).click()

    await expect(page).toHaveURL(new RegExp(panel.landing.replaceAll('/', '\\/')))
    await expect(page.getByTestId(panel.testId)).toBeVisible()

    // El BottomNav scopeado al rol tiene que estar en toda pantalla
    // autenticada (M2-D3 §BottomNav §Usage rules).
    await expect(page.getByRole('navigation')).toBeVisible()

    await page.screenshot({ path: join(SHOTS, `${panel.shot}.png`), fullPage: true })
  })
}
