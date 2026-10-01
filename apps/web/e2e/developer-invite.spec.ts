import { expect, test } from '@playwright/test'
import { loginConSolapa } from './_helpers'

test.describe('Fila 39 — invitar a un inversor', () => {
  test('DEV invita sobre una unidad y la unidad queda reservada', async ({ page }) => {
    await loginConSolapa(page, 'Developer')

    await page.goto('/developer/projects')
    await page
      .getByRole('button')
      .filter({ hasText: /Torre A/ })
      .first()
      .click()
    await expect(page.getByTestId('DEV-PROJECT-DETAIL-001')).toBeVisible()

    await page.getByRole('button', { name: /administrar unidades|manage units/i }).click()
    await expect(page.getByTestId('DEV-UNITS-LIST-001')).toBeVisible()

    const referencia = `INV-${Date.now().toString().slice(-6)}`
    await page.getByLabel(/referencia de la unidad|unit label/i).fill(referencia)
    await page.getByLabel(/^piso$|^floor$/i).fill('3')
    await page.getByRole('button', { name: /^(agregar|add)$/i }).click()

    const fila = page.getByRole('button').filter({ hasText: referencia })
    await expect(fila).toBeVisible({ timeout: 15_000 })

    await page.goto('/developer/projects')
    await page
      .getByRole('button')
      .filter({ hasText: /Torre A/ })
      .first()
      .click()
    await page.getByRole('button', { name: /invitar inversor|invite investor/i }).click()
    await expect(page.getByTestId('DEV-INVITE-CREATE-001')).toBeVisible()

    await page.getByLabel(/^(correo electrónico|email)$/i).fill('buyer@example.com')
    await page.getByLabel(/unidad asignada|assigned unit/i).selectOption({ label: referencia })
    await page.getByRole('spinbutton', { name: /monto|amount/i }).fill('285000')
    await page.getByRole('button', { name: /enviar invitación|send invitation/i }).click()

    await expect(page.getByTestId('DEV-UNITS-LIST-001')).toBeVisible({ timeout: 15_000 })
    await expect(fila).toContainText(/reservada|reserved/i)
  })
})
