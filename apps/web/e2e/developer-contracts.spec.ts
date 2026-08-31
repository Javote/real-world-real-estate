import { expect, test } from '@playwright/test'
import { loginConSolapa } from './_helpers'

// **M2-D5 filas 40-41 · `/developer/project/:projectId/contracts`** — capturas
// 40 y 41. Test ID: DEV-CONTRACTS-LIST-001.
//
// **DEV-RELEASE-EXECUTE-002 no aparece acá porque no existe** (D-070): la
// plataforma no administra fondos y la pantalla no ofrece liberar nada. Lo que
// este test afirma al final es justamente esa ausencia — un invariante que se
// rompe callado, porque agregar un botón "Liberar etapa N" no rompe ningún
// otro test.
//
// El contrato se produce con el ciclo real —unidad → invitación → accept— y no
// con un fixture: el anclaje que la pantalla muestra lo emite el accept del
// investor, así que un contrato insertado a mano no tendría TXID y el test
// pasaría sin probar lo que importa.
//
// **Los dos pasos de API van por `page.evaluate`** y no por la UI porque las
// filas del investor (INV-INVITE-VIEW-001, INV-INVITE-ACCEPT-002) todavía no
// están transcritas. Mismo recurso que usa `evidence-flow.spec.ts` para
// resolver el stage del certifier.

const token = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () => JSON.parse(sessionStorage.getItem('proptrust.session') ?? '{}')?.token ?? null
  )

/**
 * Cambia de rol de verdad.
 *
 * **`loginConSolapa` sola no alcanza cuando ya hay sesión.** Espera a que
 * `proptrust.session` exista, y si venís de otro rol ya existe: el poll vuelve
 * en el primer intento y el test sigue con el token anterior. Se ve como un 403
 * del endpoint del rol nuevo y parece un problema de permisos.
 */
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

    // El accept es lo que crea el contrato Y lo que ancla el commitment.
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

    // Por el tile: que la superficie sea ALCANZABLE es parte de lo que se
    // prueba (D-072).
    await page.getByRole('button', { name: /contratos|contracts/i }).click()
    await expect(page.getByTestId('DEV-CONTRACTS-LIST-001')).toBeVisible()

    const tarjeta = page.locator('article').filter({ hasText: referencia })
    await expect(tarjeta).toBeVisible()
    // El estado comercial de la unidad — lo que D-070 dice que SÍ se puede
    // mostrar — y el anclaje del acuerdo.
    await expect(tarjeta).toContainText(/vendida|sold/i)
    await expect(tarjeta.getByText(/registrado en cadena|recorded on chain/i)).toBeVisible()

    // **El invariante de D-070.** Ningún botón de liberar, en ninguno de los
    // dos idiomas, en toda la pantalla.
    await expect(page.getByRole('button', { name: /liberar|release/i })).toHaveCount(0)
  })
})
