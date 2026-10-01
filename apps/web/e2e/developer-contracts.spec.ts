import { expect, test } from '@playwright/test'
import { loginConSolapa } from './_helpers'

const token = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () => JSON.parse(sessionStorage.getItem('proptrust.session') ?? '{}')?.token ?? null
  )

async function cambiarDeRol(page: import('@playwright/test').Page, rol: string) {
  await page.goto('/login')
  await page.evaluate(() => sessionStorage.clear())
  await loginConSolapa(page, rol)
}

test.describe('Filas 40-41 — los contratos como registro', () => {
  test('DEV ve el acuerdo con su anclaje, y ningún botón de liberar', async ({ page }) => {
    await loginConSolapa(page, 'Developer')

    const tokenDev = await token(page)
    const referencia = `CON-${Date.now().toString().slice(-6)}`

    const { projectId, invitationId } = await page.evaluate(
      async ([t, ref]) => {
        const headers = { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }

        const proyectos = await (await fetch('/api/v1/developer/projects', { headers })).json()
        const proyecto = proyectos.find((p: { name: string }) => p.name === 'Torre A')

        const unidad = await (
          await fetch(`/api/v1/developer/projects/${proyecto.id}/units`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ unitReference: ref, floor: 2, sizeM2: 60 })
          })
        ).json()

        const invitacion = await (
          await fetch(`/api/v1/developer/projects/${proyecto.id}/invitations`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              unitId: unidad.id,
              investorEmail: 'buyer@example.com',
              amountMinorUnits: 12_000_000,
              currency: 'USD'
            })
          })
        ).json()

        return { projectId: proyecto.id as string, invitationId: invitacion.id as string }
      },
      [tokenDev, referencia] as const
    )

    await cambiarDeRol(page, 'Investor')
    const tokenInv = await token(page)
    const aceptado = await page.evaluate(
      async ([t, id]) => {
        const res = await fetch(`/api/v1/investor/invitations/${id}/accept`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
          body: '{}'
        })
        return res.status
      },
      [tokenInv, invitationId] as const
    )
    expect(aceptado).toBe(201)

    await cambiarDeRol(page, 'Developer')
    await page.goto(`/developer/project/${projectId}`)
    await expect(page.getByTestId('DEV-PROJECT-DETAIL-001')).toBeVisible()

    await page.getByRole('button', { name: /contratos|contracts/i }).click()
    await expect(page.getByTestId('DEV-CONTRACTS-LIST-001')).toBeVisible()

    const tarjeta = page.locator('article').filter({ hasText: referencia })
    await expect(tarjeta).toBeVisible()
    await expect(tarjeta).toContainText(/vendida|sold/i)
    await expect(tarjeta.getByText(/registrado en cadena|recorded on chain/i)).toBeVisible()

    await expect(page.getByRole('button', { name: /liberar|release/i })).toHaveCount(0)
  })
})
