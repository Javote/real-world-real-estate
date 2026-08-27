import { expect, test } from '@playwright/test'
import { loginConSolapa } from './_helpers'

// **M2-D5 filas 42-43 · `/developer/capital`** — capturas 42 y 43.
// Test IDs: DEV-CAPITAL-SUMMARY-001, DEV-CAPITAL-MONTHLY-002.
//
// **En mobile se entra por el tab del BottomNav y no por `goto`**, porque hasta
// esta rebanada ese tab era un link muerto: `navTabs.ts` apuntaba a
// `/developer/capital` desde el principio y la ruta no existía. Un test que
// navegue por URL no habría notado nunca la diferencia.
//
// **En desktop se entra por URL**, y no es una concesión del test: el
// `BottomNav` es `md:hidden` y el sidebar que M2-D3 pone en su lugar
// (*"replaced by left sidebar on desktop"*) todavía no está construido. Ahí no
// hay tab que clickear. Queda anotado como lo que es —un hueco del shell, no de
// esta pantalla— en vez de tapado con un `goto` para los dos.
//
// Lo último que afirma es una ausencia: **ningún "liberado" ni "pendiente"**.
// El summary del endpoint los trae —son del encuadre de liberaciones que D-070
// dejó fuera del producto— y la pantalla no los muestra. Es de esas cosas que
// se agregan sin querer porque el dato ya está ahí.

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

    // El desglose por proyecto, con la barra de "sobre el total".
    await expect(page.getByText(/por proyecto|by project/i)).toBeVisible()
    await expect(page.getByText(/sobre el total|share of total/i).first()).toBeVisible()

    // **El invariante de D-070**: el capital se muestra levantado, nunca
    // liberado ni pendiente de liberar.
    await expect(page.getByText(/liberado|released/i)).toHaveCount(0)
    await expect(page.getByText(/pendiente de liberar|pending release/i)).toHaveCount(0)
  })
})
