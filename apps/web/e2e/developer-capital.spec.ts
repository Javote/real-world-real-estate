import { expect, test } from '@playwright/test'
import { loginConSolapa } from './_helpers'

test.describe('Filas 42-43 — capital levantado', () => {
  test('DEV llega por el tab y ve el total, la evolución y el desglose', async ({ page }) => {
    await loginConSolapa(page, 'Developer')
    await expect(page.getByTestId('DEV-PANEL-KPIS-001')).toBeVisible()

    if (test.info().project.name === 'mobile') {
      await page.getByRole('link', { name: /^(capital)$/i }).click()
    } else {
      await page.goto('/developer/capital')
    }

    await expect(page.getByTestId('DEV-CAPITAL-SUMMARY-001')).toBeVisible()
    await expect(page.getByTestId('DEV-CAPITAL-MONTHLY-002')).toBeVisible()

    await expect(page.getByText(/total levantado|total raised/i)).toBeVisible()
    await expect(page.getByText(/evolución mensual|monthly evolution/i)).toBeVisible()

    await expect(page.getByText(/por proyecto|by project/i)).toBeVisible()
    await expect(page.getByText(/sobre el total|share of total/i).first()).toBeVisible()

    await expect(page.getByText(/liberado|released/i)).toHaveCount(0)
    await expect(page.getByText(/pendiente de liberar|pending release/i)).toHaveCount(0)
  })
})
