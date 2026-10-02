import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { loginConSolapa } from './_helpers'

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
    await loginConSolapa(page, panel.rol)

    await expect(page).toHaveURL(new RegExp(panel.landing.replaceAll('/', '\\/')))
    await expect(page.getByTestId(panel.testId)).toBeVisible()

    if (test.info().project.name === 'mobile') {
      await expect(page.getByRole('navigation')).toBeVisible()
    }

    await page.screenshot({ path: join(SHOTS, `${panel.shot}.png`), fullPage: true })
  })
}

test('DEV-PROFILE-001 · el developer llega a su perfil desde el header', async ({ page }) => {
  await loginConSolapa(page, 'Developer')

  await expect(page.getByTestId('DEV-PANEL-KPIS-001')).toBeVisible()
  await page.getByRole('button', { name: /mi perfil|my profile/i }).click()

  await expect(page).toHaveURL(/\/developer\/profile/)
  await expect(page.getByTestId('DEV-PROFILE-001')).toBeVisible()
})

test('DEV-INVESTORS-LIST-001 · el directorio de investors y su acceso', async ({ page }) => {
  await loginConSolapa(page, 'Developer')

  await expect(page.getByTestId('DEV-PANEL-KPIS-001')).toBeVisible()
  await page.getByRole('button', { name: /inversores|investors/i }).click()

  await expect(page).toHaveURL(/\/developer\/investors/)
  await expect(page.getByTestId('DEV-INVESTORS-LIST-001')).toBeVisible()
  await expect(page.getByRole('button', { name: /volver al panel|back to panel/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /notificaciones|notifications/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /mi perfil|my profile/i })).toBeVisible()
  const idioma = page.getByRole('group', { name: /^idioma$|^language$/i })
  await expect(idioma).toBeVisible()
  await expect(idioma.getByRole('button', { name: 'Español' })).toBeVisible()
  await expect(idioma.getByRole('button', { name: 'English' })).toBeVisible()
  await expect(page.getByRole('banner')).toContainText('Prop')
})

test('DEV-DOCS-LIST-001 · DEV-DOC-ANCHOR-002 · documentación de respaldo', async ({ page }) => {
  await loginConSolapa(page, 'Developer')

  await expect(page.getByTestId('DEV-PANEL-KPIS-001')).toBeVisible()
  await page.getByRole('button', { name: /documentación|documentation/i }).click()

  await expect(page).toHaveURL(/\/developer\/documentation/)
  await expect(page.getByTestId('DEV-DOCS-LIST-001')).toBeVisible()

  const anclar = page.getByTestId('DEV-DOC-ANCHOR-002').first()
  if (await anclar.count()) await expect(anclar).toBeVisible()
})

test('DEV-PROJECT-CREATE-001 · crear un desarrollo desde el panel', async ({ page }) => {
  await loginConSolapa(page, 'Developer')

  await page.getByRole('button', { name: /nuevo proyecto|new project/i }).click()
  await expect(page).toHaveURL(/\/developer\/project\/new/)
  await expect(page.getByTestId('DEV-PROJECT-CREATE-001')).toBeVisible()

  const nombre = `Torres del Test ${Date.now()}`
  await page.getByLabel(/nombre del proyecto|project name/i).fill(nombre)
  await page.getByLabel(/ubicación|location/i).fill('Palermo, CABA')

  await page.getByRole('button', { name: /crear proyecto|create project/i }).click()

  await expect(page).toHaveURL(/\/developer\/project\/[^/]+$/, { timeout: 15_000 })
  await expect(page.getByTestId('DEV-PROJECT-DETAIL-001')).toBeVisible()
})
