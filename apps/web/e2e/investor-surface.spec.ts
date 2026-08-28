import { expect, test } from '@playwright/test'
import { loginConSolapa } from './_helpers'

// **SPEC-016 — superficie del investor.** Aserciones de estructura y de
// presencia de test IDs, no de conteo (la suite comparte la base de seed).

async function cambiarDeRol(page: import('@playwright/test').Page, rol: string) {
  await page.goto('/login')
  await page.evaluate(() => sessionStorage.clear())
  await loginConSolapa(page, rol)
}

test.describe('SPEC-016 — investor', () => {
  test('INV-PROFILE-EDIT-002 · INV-NOTIF-PREFS-003', async ({ page }) => {
    await loginConSolapa(page, 'Investor')
    await page.goto('/investor/profile')
    await expect(page.getByTestId('INV-PROFILE-VIEW-001')).toBeVisible()
    await expect(page.getByTestId('INV-NOTIF-PREFS-003')).toBeVisible()
    await page.getByRole('button', { name: /editar|edit/i }).click()
    await expect(page.getByTestId('INV-PROFILE-EDIT-002')).toBeVisible()
  })

  test('INV-BUY-MAP-001 · INV-BUY-SEARCH-001 · INV-BUY-FILTER-001', async ({ page }) => {
    await loginConSolapa(page, 'Investor')
    await expect(page.getByTestId('INV-BUY-LIST-001')).toBeVisible()

    await page.getByRole('button', { name: /mapa|map/i }).click()
    await expect(page.getByTestId('INV-BUY-MAP-001')).toBeVisible()

    await page.getByRole('button', { name: /buscar|search/i }).click()
    await expect(page.getByTestId('INV-BUY-SEARCH-001')).toBeVisible()

    await page.getByRole('button', { name: /filtros|filters/i }).click()
    await expect(page.getByTestId('INV-BUY-FILTER-001')).toBeVisible()
  })

  test('INV-FAV-LIST-001', async ({ page }) => {
    await loginConSolapa(page, 'Investor')
    await page.goto('/investor/favorites')
    await expect(page.getByTestId('INV-FAV-LIST-001')).toBeVisible()
  })

  test('INV-PROJECT-DETAIL-001 · INV-PROJECT-DOCS-002 · INV-PROJECT-STAGES-001', async ({
    page
  }) => {
    await loginConSolapa(page, 'Investor')
    await expect(page.getByTestId('INV-BUY-LIST-001')).toBeVisible()

    // Presencia, no conteo: el seed le da al buyer membresía en un proyecto.
    // Un `return` temprano acá era un test verde que no probaba nada.
    const card = page.getByTestId('INV-BUY-LIST-001').locator('article').first()
    await expect(card).toBeVisible()
    await card.locator('button').first().click()

    await expect(page.getByTestId('INV-PROJECT-DETAIL-001')).toBeVisible()
    await expect(page.getByTestId('INV-PROJECT-DOCS-002')).toBeVisible()

    await page
      .getByRole('button', { name: /avance completo|view full progress|ver el avance/i })
      .click()
    await expect(page.getByTestId('INV-PROJECT-STAGES-001')).toBeVisible()
  })

  test('INV-UNITS-LIST-001 · INV-UNIT-DETAIL-001 · INV-CONTRACT-VIEW-001 · INV-DOSSIER-VIEW-001', async ({
    page
  }) => {
    await loginConSolapa(page, 'Investor')
    await page.goto('/investor/units')
    await expect(page.getByTestId('INV-UNITS-LIST-001')).toBeVisible()

    // El seed le asigna una unidad a buyer@example.com: si no está, es un fallo
    // real de la superficie, no un dato faltante que haya que saltear.
    const unidad = page.getByTestId('INV-UNITS-LIST-001').locator('button').first()
    await expect(unidad).toBeVisible()
    await unidad.click()

    await expect(page.getByTestId('INV-UNIT-DETAIL-001')).toBeVisible()
    await expect(page.getByTestId('INV-UNIT-NEWS-002')).toBeVisible()

    await page.getByRole('button', { name: /ver contrato|view contract/i }).click()
    await expect(page.getByTestId('INV-CONTRACT-VIEW-001')).toBeVisible()
    await expect(page.getByTestId('INV-RELEASES-LIST-002')).toBeVisible()

    await page
      .getByRole('button', { name: /volver|back/i })
      .first()
      .click()
    await page.getByRole('button', { name: /^dossier$/i }).click()
    await expect(page.getByTestId('INV-DOSSIER-VIEW-001')).toBeVisible()
    await expect(page.getByTestId('INV-DOSSIER-EXPORT-002')).toBeVisible()
  })

  test('INV-INVITE-VIEW-001 · INV-INVITE-ACCEPT-002 · INV-INVITE-DECLINE-003', async ({ page }) => {
    await loginConSolapa(page, 'Developer')

    const tokenDev = await page.evaluate(
      () => JSON.parse(sessionStorage.getItem('proptrust.session') ?? '{}')?.token ?? null
    )
    const referencia = `INV-${Date.now().toString().slice(-6)}`

    const invitationId = await page.evaluate(
      async ([t, ref]) => {
        const headers = { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }
        const proyectos = await (await fetch('/api/v1/developer/projects', { headers })).json()
        const proyecto = proyectos.find((p: { name: string }) => p.name === 'Torre A')
        const unidad = await (
          await fetch(`/api/v1/developer/projects/${proyecto.id}/units`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ unitReference: ref, floor: 3, sizeM2: 50 })
          })
        ).json()
        const invitacion = await (
          await fetch(`/api/v1/developer/projects/${proyecto.id}/invitations`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              unitId: unidad.id,
              investorEmail: 'buyer@example.com',
              amountMinorUnits: 5_000_000,
              currency: 'USD'
            })
          })
        ).json()
        return invitacion.id as string
      },
      [tokenDev, referencia] as const
    )

    await cambiarDeRol(page, 'Investor')
    await page.goto(`/investor/notifications?invitation=${invitationId}`)
    const tarjeta = page.getByRole('button', { name: /invitación|invitation/i }).first()
    await expect(tarjeta).toBeVisible()
    await tarjeta.click()
    await expect(page.getByTestId('INV-INVITE-VIEW-001')).toBeVisible()
    await expect(page.getByTestId('INV-INVITE-ACCEPT-002')).toBeVisible()
    await expect(page.getByTestId('INV-INVITE-DECLINE-003')).toBeVisible()
  })
})
