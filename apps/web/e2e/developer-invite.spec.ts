import { expect, test } from '@playwright/test'
import { loginConSolapa } from './_helpers'

// **M2-D5 fila 39 · `/developer/project/:projectId/invite`** — captura 39.
// Test ID: DEV-INVITE-CREATE-001.
//
// El test crea SU unidad antes de invitar. No es ceremonia: la suite corre
// contra la base de desarrollo sin aislamiento, e invitar reserva la unidad —
// tomar prestada una del seed la dejaría reservada para el resto de las
// corridas, y el flujo de evidencia depende de ese seed.
//
// **Lo que se afirma al final es la RESERVA, no un TXID.** El POST no ancla; el
// commitment del ciclo lo emite el accept del investor. Un test que buscara una
// prueba criptográfica acá estaría pidiendo lo que la regla 17 prohíbe mostrar.

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

    // Se vuelve al detalle por el tab de proyectos: el tile de invitar vive ahí
    // y que sea ALCANZABLE es parte de lo que se prueba (D-072).
    await page.goto('/developer/projects')
    await page
      .getByRole('button')
      .filter({ hasText: /Torre A/ })
      .first()
      .click()
    await page.getByRole('button', { name: /invitar inversor|invite investor/i }).click()
    await expect(page.getByTestId('DEV-INVITE-CREATE-001')).toBeVisible()

    await page.getByLabel(/^email$/i).fill('buyer@example.com')
    await page.getByLabel(/unidad asignada|assigned unit/i).selectOption({ label: referencia })
    await page.getByRole('spinbutton', { name: /monto|amount/i }).fill('285000')
    await page.getByRole('button', { name: /enviar invitación|send invitation/i }).click()

    // El efecto que la pantalla SÍ puede sustanciar: la unidad pasó a reservada
    // y se ve en la lista, que es adonde lleva el éxito.
    await expect(page.getByTestId('DEV-UNITS-LIST-001')).toBeVisible({ timeout: 15_000 })
    await expect(fila).toContainText(/reservada|reserved/i)
  })
})
