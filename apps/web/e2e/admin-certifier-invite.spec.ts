import { expect, type Page, test } from '@playwright/test'

import { passwordDe } from './_credenciales.ts'
import { loginConSolapa, waitForHydration } from './_helpers.ts'

// SPEC-221 · D-095 — el admin invita a un certifier a un proyecto nuevo y el
// certifier acepta desde su panel. Es el hueco que hasta hoy se tapaba por
// consola (`POST /projects/:id/members`): en la prueba de volumen y en la
// preparación del video.
//
// El proyecto se crea en la corrida misma, desde la UI del developer: nace con
// una sola membresía (la del developer), que es exactamente el caso real.

async function loginAdmin(page: Page) {
  await page.goto('/login')
  await waitForHydration(page)
  await page.getByLabel('Usuario').fill('admin@example.com')
  await page.getByLabel('Contraseña').fill(passwordDe('admin'))
  await page.getByRole('button', { name: /ingresar|sign in/i }).click()
  await expect(page).toHaveURL(/\/admin/)
}

test('ADMIN-CERTIFIER-INVITE-003 · el admin invita a un certifier y el certifier acepta', async ({
  page
}) => {
  // 1. Un proyecto nuevo, sin certifier.
  await loginConSolapa(page, 'Developer')
  await page.getByRole('button', { name: /nuevo proyecto|new project/i }).click()
  const nombre = `Torre Invitación ${Date.now()}`
  await page.getByLabel(/nombre del proyecto|project name/i).fill(nombre)
  await page.getByLabel(/ubicación|location/i).fill('Núñez, CABA')
  await page.getByRole('button', { name: /crear proyecto|create project/i }).click()
  await expect(page).toHaveURL(/\/developer\/project\/[^/]+$/, { timeout: 15_000 })

  // 2. El admin lo encuentra primero en su lista (el más nuevo) y lo invita.
  await page.evaluate(() => sessionStorage.clear())
  await loginAdmin(page)
  await expect(page.getByTestId('ADMIN-PROJECT-001')).toBeVisible()
  await expect(page.getByLabel(/^proyecto$|^project$/i)).toHaveValue(/.+/)
  await page.getByLabel(/^proyecto$|^project$/i).selectOption({ label: nombre })

  const form = page.getByTestId('ADMIN-CERTIFIER-INVITE-003')
  await form.getByLabel(/^(certificador|certifier)$/i).selectOption({ label: 'Verifier Demo' })
  await form.getByRole('button', { name: /invitar|invite/i }).click()
  await expect(form.getByRole('status')).toBeVisible()
  await expect(page.getByTestId('ADMIN-CERTIFIER-INVITATIONS-004')).toContainText('Verifier Demo')

  // 3. El certifier la ve en su panel y acepta.
  await page.evaluate(() => sessionStorage.clear())
  await loginConSolapa(page, 'Certifier')
  const invitaciones = page.getByTestId('CER-INVITATIONS-003')
  await expect(invitaciones).toContainText(nombre)
  const linea = invitaciones.getByRole('listitem').filter({ hasText: nombre })
  await linea.getByRole('button', { name: /aceptar|accept/i }).click()
  await expect(invitaciones.getByRole('listitem').filter({ hasText: nombre })).toHaveCount(0)

  // 4. Del lado del admin, ya es miembro del proyecto como certifier.
  await page.evaluate(() => sessionStorage.clear())
  await loginAdmin(page)
  await page.getByLabel(/^proyecto$|^project$/i).selectOption({ label: nombre })
  await expect(page.getByTestId('ADMIN-MEMBERS-002')).toContainText('Verifier Demo')
})

test('D-095 · el admin entra a los paneles de los otros roles', async ({ page }) => {
  await loginAdmin(page)
  // La barra es BottomNav en mobile y Sidebar en desktop: el link visible.
  await page
    .locator('a:visible')
    .filter({ hasText: /^Developer$/ })
    .click()
  await expect(page).toHaveURL(/\/developer$/)
  await expect(page.getByTestId('DEV-PANEL-KPIS-001')).toBeVisible()
})
