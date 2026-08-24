import { expect, test } from '@playwright/test'
import { loginConSolapa } from './_helpers'

// **Las 12 superficies de Notary y Certifier** (M2-D5 §6.1 y §6.2), con sus
// test IDs literales.
//
// Corren contra la API real con la base sembrada: es lo que hace que estos IDs
// cuenten para el ≥95% de la aceptación de M3 (M2-D5 §8). Un test de
// componente aislado prueba el componente; esto prueba la superficie.

/** El token de la sesión, para pedirle a la API el id que la ruta necesita. */
async function tokenDe(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => JSON.parse(sessionStorage.getItem('proptrust.session') ?? '{}')?.token ?? null
  )
}

test.describe('Certifier', () => {
  test('CER-PANEL-001 · CER-ASSIGNMENTS-002 · panel con KPIs y cola de asignados', async ({
    page
  }) => {
    await loginConSolapa(page, 'Certifier')
    await expect(page).toHaveURL(/\/certifier/)
    await expect(page.getByTestId('CER-PANEL-001')).toBeVisible()
    await expect(page.getByTestId('CER-ASSIGNMENTS-002')).toBeVisible()
  })

  test('CER-STAGE-VIEW-001 · CER-CERTIFY-001 · CER-OBSERVE-001 · certificar una etapa', async ({
    page
  }) => {
    await loginConSolapa(page, 'Certifier')

    const token = await tokenDe(page)
    const stageId = await page.evaluate(async (t) => {
      const res = await fetch('/api/v1/certifier/assignments', {
        headers: { Authorization: `Bearer ${t}` }
      })
      const asignados = await res.json()
      return asignados[0]?.stageId ?? null
    }, token)
    expect(stageId).not.toBeNull()

    await page.goto(`/certifier/stage/${stageId}`)
    await expect(page.getByTestId('CER-STAGE-VIEW-001')).toBeVisible()

    // La acción de certificar está a la vista (fila 56c).
    await expect(page.getByTestId('CER-CERTIFY-001')).toBeVisible()

    // El modal de observación se abre desde "Observar" (fila 57). **Nunca se
    // abre solo** (M2-D4 §6.3): hace falta el gesto.
    await page.getByRole('button', { name: /observar|observe/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    // "Empty textarea disables Send" (M2-D3).
    await expect(page.getByRole('button', { name: /^(enviar|send)$/i })).toBeDisabled()
  })

  test('CER-ISSUED-LIST-001 · historial de certificados emitidos', async ({ page }) => {
    await loginConSolapa(page, 'Certifier')
    await page.goto('/certifier/issued')
    await expect(page.getByTestId('CER-ISSUED-LIST-001')).toBeVisible()
  })

  test('CER-PROFILE-001 · perfil del certifier', async ({ page }) => {
    await loginConSolapa(page, 'Certifier')
    await page.goto('/certifier/profile')
    await expect(page.getByTestId('CER-PROFILE-001')).toBeVisible()
    await expect(page.getByText('verifier@example.com')).toBeVisible()
  })
})

test.describe('Notary', () => {
  test('NOT-PANEL-001 · NOT-PENDING-002 · panel con KPIs y cola de dossiers', async ({ page }) => {
    await loginConSolapa(page, 'Notary')
    await expect(page).toHaveURL(/\/notary/)
    await expect(page.getByTestId('NOT-PANEL-001')).toBeVisible()
    await expect(page.getByTestId('NOT-PENDING-002')).toBeVisible()
  })

  test('NOT-DOSSIER-VIEW-001 · NOT-DOSSIER-SIGN-001 · NOT-DOSSIER-REJECT-001 · revisión', async ({
    page
  }) => {
    await loginConSolapa(page, 'Notary')

    const token = await tokenDe(page)
    const dossierId = await page.evaluate(async (t) => {
      const res = await fetch('/api/v1/notary/dossiers/pending', {
        headers: { Authorization: `Bearer ${t}` }
      })
      const pendientes = await res.json()
      return pendientes[0]?.dossierId ?? null
    }, token)
    expect(dossierId).not.toBeNull()

    await page.goto(`/notary/dossier/${dossierId}`)
    await expect(page.getByTestId('NOT-DOSSIER-VIEW-001')).toBeVisible()
    await expect(page.getByTestId('NOT-DOSSIER-SIGN-001')).toBeVisible()
    await expect(page.getByTestId('NOT-DOSSIER-REJECT-001')).toBeVisible()

    // **Lo único que la firma afirma** (D-026): el descargo está a la vista
    // antes de firmar, no escondido en un tooltip.
    await expect(page.getByText(/no certifica|does not certify/i)).toBeVisible()
  })

  test('NOT-SIGNED-LIST-001 · historial de firmas', async ({ page }) => {
    await loginConSolapa(page, 'Notary')
    await page.goto('/notary/signed')
    await expect(page.getByTestId('NOT-SIGNED-LIST-001')).toBeVisible()
  })

  test('NOT-PROFILE-001 · perfil del notario', async ({ page }) => {
    await loginConSolapa(page, 'Notary')
    await page.goto('/notary/profile')
    await expect(page.getByTestId('NOT-PROFILE-001')).toBeVisible()
    await expect(page.getByText('notary@example.com')).toBeVisible()
  })
})
