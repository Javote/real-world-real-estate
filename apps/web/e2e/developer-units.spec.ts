import { expect, test } from '@playwright/test'
import { loginConSolapa } from './_helpers'

test.describe('Fila 44b — unidades del proyecto', () => {
  test('DEV lista, agrega y corrige una unidad del proyecto', async ({ page }) => {
    await loginConSolapa(page, 'Developer')

    await page.goto('/developer/projects')
    await expect(page.getByTestId('DEV-PROJECTS-LIST-001')).toBeVisible()

    await page
      .getByRole('button')
      .filter({ hasText: /Torre A/ })
      .first()
      .click()
    await expect(page.getByTestId('DEV-PROJECT-DETAIL-001')).toBeVisible()

    await page.getByRole('button', { name: /administrar unidades|manage units/i }).click()

    await expect(page.getByTestId('DEV-UNITS-LIST-001')).toBeVisible()
    await expect(page.getByTestId('DEV-UNIT-CREATE-002')).toBeVisible()

    const referencia = `E2E-${Date.now().toString().slice(-6)}`

    await page.getByLabel(/referencia de la unidad|unit label/i).fill(referencia)
    await page.getByLabel(/^piso$|^floor$/i).fill('7')
    await page.getByLabel(/superficie|surface/i).fill('65')
    await page.getByRole('button', { name: /^(agregar|add)$/i }).click()

    const fila = page.getByRole('button').filter({ hasText: referencia })
    await expect(fila).toBeVisible({ timeout: 15_000 })
    await expect(fila).toContainText(/piso 7|floor 7/i)

    await fila.click()
    await expect(page.getByTestId('DEV-UNIT-UPDATE-003')).toBeVisible()

    await page.getByLabel(/^piso$|^floor$/i).fill('9')
    await page.getByRole('button', { name: /guardar cambios|save changes/i }).click()

    await expect(fila).toContainText(/piso 9|floor 9/i, { timeout: 15_000 })

    await expect(page.getByTestId('DEV-UNIT-CREATE-002')).toBeVisible()
  })
})
