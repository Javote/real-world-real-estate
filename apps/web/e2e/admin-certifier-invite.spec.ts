import { expect, type Page, test } from '@playwright/test'

import { passwordDe } from './_credenciales.ts'
import { loginConSolapa, waitForHydration } from './_helpers.ts'

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
  await loginConSolapa(page, 'Developer')
  await page.getByRole('button', { name: /nuevo proyecto|new project/i }).click()
  const nombre = `Torre Invitación ${Date.now()}`
  await page.getByLabel(/nombre del proyecto|project name/i).fill(nombre)
  await page.getByLabel(/ubicación|location/i).fill('Núñez, CABA')
  await page.getByRole('button', { name: /crear proyecto|create project/i }).click()
  await expect(page).toHaveURL(/\/developer\/project\/[^/]+$/, { timeout: 15_000 })

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

  await page.evaluate(() => sessionStorage.clear())
  await loginConSolapa(page, 'Certifier')
  const invitaciones = page.getByTestId('CER-INVITATIONS-003')
  await expect(invitaciones).toContainText(nombre)
  const linea = invitaciones.getByRole('listitem').filter({ hasText: nombre })
  await linea.getByRole('button', { name: /aceptar|accept/i }).click()
  await expect(invitaciones.getByRole('listitem').filter({ hasText: nombre })).toHaveCount(0)

  await page.evaluate(() => sessionStorage.clear())
  await loginAdmin(page)
  await page.getByLabel(/^proyecto$|^project$/i).selectOption({ label: nombre })
  await expect(page.getByTestId('ADMIN-MEMBERS-002')).toContainText('Verifier Demo')
})

test('D-095 · el admin entra a los paneles de los otros roles', async ({ page }) => {
  await loginAdmin(page)
  await page
    .locator('a:visible')
    .filter({ hasText: /^(Desarrollador|Developer)$/ })
    .click()
  await expect(page).toHaveURL(/\/developer$/)
  await expect(page.getByTestId('DEV-PANEL-KPIS-001')).toBeVisible()
})
