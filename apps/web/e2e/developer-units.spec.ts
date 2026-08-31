import { expect, test } from '@playwright/test'
import { loginConSolapa } from './_helpers'

// **M2-D5 fila 44b · `/developer/project/:projectId/units`** — captura 44b.
// Test IDs: DEV-UNITS-LIST-001, DEV-UNIT-CREATE-002, DEV-UNIT-UPDATE-003.
//
// Los tres viven en la misma pantalla, así que el test recorre las tres
// acciones en un solo pase: listar, agregar, corregir. Navega por la app
// —proyectos → proyecto → administrar unidades— porque que la superficie sea
// ALCANZABLE es parte de lo que se prueba (D-072: un tile sin destino no
// existe, y un destino sin tile no se encuentra).
//
// **La referencia lleva un sufijo único.** La suite corre contra la base de
// desarrollo sin aislamiento, así que un `5A` fijo choca con la corrida
// anterior; y por lo mismo el test afirma que SU unidad está, nunca cuántas
// hay.

test.describe('Fila 44b — unidades del proyecto', () => {
  test('DEV lista, agrega y corrige una unidad del proyecto', async ({ page }) => {
    await loginConSolapa(page, 'Developer')

    await page.goto('/developer/projects')
    await expect(page.getByTestId('DEV-PROJECTS-LIST-001')).toBeVisible()

    // Por el nombre EXACTO del proyecto del seed: la lista viene ordenada por
    // fecha de creación descendente y el test de la fila 34b-34c crea uno.
    await page
      .getByRole('button')
      .filter({ hasText: /Torre A/ })
      .first()
      .click()
    await expect(page.getByTestId('DEV-PROJECT-DETAIL-001')).toBeVisible()

    // Por rol y no por texto: el ActionCard es un <button> y su título es un
    // nodo de texto adentro.
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

    // La corrección usa el MISMO formulario: tocar la fila lo pone en modo
    // edición y el test ID cambia a DEV-UNIT-UPDATE-003.
    await fila.click()
    await expect(page.getByTestId('DEV-UNIT-UPDATE-003')).toBeVisible()

    await page.getByLabel(/^piso$|^floor$/i).fill('9')
    await page.getByRole('button', { name: /guardar cambios|save changes/i }).click()

    await expect(fila).toContainText(/piso 9|floor 9/i, { timeout: 15_000 })

    // Guardar sale del modo edición: la card vuelve a ser el alta.
    await expect(page.getByTestId('DEV-UNIT-CREATE-002')).toBeVisible()
  })
})
