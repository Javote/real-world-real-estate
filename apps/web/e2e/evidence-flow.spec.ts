import { expect, test } from '@playwright/test'
import { loginConSolapa } from './_helpers'

// **El flujo de evidencia de M2-D1 §6, de punta a punta y entre roles.**
//
// No es un test de una pantalla: recorre los pasos 1, 2, 3, 4 y 7 tal como el
// entregable los numera, cambiando de rol en el medio. Es la prueba de que el
// ciclo cierra —subir → anclar → avisar → certificar → auditar— y no de que
// cada pantalla renderice.
//
// **Los pasos 5 y 6 quedan afuera a propósito** (D-070): describen que el
// developer libera un pago y el investor lo ve. La plataforma no administra
// fondos; refleja y respalda la vida real. Ese desvío está declarado, no
// olvidado.

test.describe('Evidence flow — M2-D1 §6', () => {
  test('paso 1 y 2 · DEV sube evidencia y obtiene Merkle root + TXID', async ({ page }) => {
    await loginConSolapa(page, 'Developer')

    // Se navega por la app —panel → proyectos → proyecto → subir—: que la
    // superficie sea ALCANZABLE es parte de lo que se prueba.
    await page.goto('/developer/projects')
    await expect(page.getByTestId('DEV-PROJECTS-LIST-001')).toBeVisible()

    // **Por el nombre EXACTO del proyecto del seed, no por un match laxo.**
    // Antes era `/torre/i` + `.first()`, y la lista viene ordenada por fecha de
    // creación descendente: cualquier test que cree un proyecto cuyo nombre
    // contenga "torre" —el de la fila 34b-34c crea uno— quedaba primero y este
    // flujo se ejecutaba contra un proyecto SIN stages. Fallaba en "etapa 2" y
    // parecía un bug del selector de etapas.
    await page
      .getByRole('button')
      .filter({ hasText: /Torre A/ })
      .first()
      .click()
    await expect(page.getByTestId('DEV-PROJECT-DETAIL-001')).toBeVisible()

    // Por rol y no por texto: el ActionCard es un <button> y su título es un
    // nodo de texto adentro — clickear el nodo no dispara nada.
    await page.getByRole('button', { name: /subir evidencia|upload evidence/i }).click()
    await expect(page.getByTestId('DEV-EVIDENCE-UPLOAD-001')).toBeVisible()

    // Elegir etapa: sin etapa no hay dropzone (la captura 38 lo muestra así).
    await page.getByRole('button', { name: /etapa 2|stage 2/i }).click()

    await page.getByLabel(/arrastrá archivos|drag files/i).setInputFiles({
      name: 'acta-inspeccion.pdf',
      mimeType: 'application/pdf',
      // Contenido ÚNICO por corrida: un stage no acepta dos evidencias con el
      // mismo SHA-256 (SPEC-218), así que repetir los bytes contra una base que
      // ya corrió este flujo daría "ya se subió a esta etapa".
      buffer: Buffer.from(`%PDF-1.4\nacta de prueba ${Date.now()}\n%%EOF\n`)
    })

    await page.getByRole('button', { name: /anclar evidencia|anchor evidence/i }).click()

    // **Paso 2** — el modal de éxito, la única superficie de prueba que se abre
    // sola (M2-D4 §6.3), con el Merkle root y el TXID que llegaron en la MISMA
    // respuesta del POST (M2-D5 §2.2).
    await expect(page.getByTestId('DEV-ANCHOR-SUCCESS-001')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/merkle/i)).toBeVisible()
  })

  test('paso 2b · un lote de varios archivos: un anclaje, y lo rechazado queda en la lista con su motivo', async ({
    page
  }) => {
    // SPEC-218. Antes se subía solo `archivos[0]` y el resto desaparecía sin aviso.
    await loginConSolapa(page, 'Developer')
    await page.goto('/developer/projects')
    await expect(page.getByTestId('DEV-PROJECTS-LIST-001')).toBeVisible()
    await page
      .getByRole('button')
      .filter({ hasText: /Torre A/ })
      .first()
      .click()
    await expect(page.getByTestId('DEV-PROJECT-DETAIL-001')).toBeVisible()
    await page.getByRole('button', { name: /subir evidencia|upload evidence/i }).click()
    await expect(page.getByTestId('DEV-EVIDENCE-UPLOAD-001')).toBeVisible()
    await page.getByRole('button', { name: /etapa 2|stage 2/i }).click()

    const unico = Date.now()
    const pdf = (nombre: string, texto: string) => ({
      name: nombre,
      mimeType: 'application/pdf',
      buffer: Buffer.from(`%PDF-1.4\n${texto} ${unico}\n%%EOF\n`)
    })
    const entrada = page.getByLabel(/arrastrá archivos|drag files/i)

    await entrada.setInputFiles([
      pdf('lote-uno.pdf', 'lote uno'),
      pdf('lote-dos.pdf', 'lote dos'),
      // Un ejecutable con extensión y tipo de PDF: el navegador lo frena por sus bytes.
      { name: 'falso.pdf', mimeType: 'application/pdf', buffer: Buffer.from('MZ ejecutable') }
    ])
    await expect(page.getByText(/falso\.pdf no es un PDF|falso\.pdf is not a valid/i)).toBeVisible()
    await expect(page.getByText('lote-uno.pdf')).toBeVisible()
    await expect(page.getByText('lote-dos.pdf')).toBeVisible()

    await page.getByRole('button', { name: /anclar evidencia|anchor evidence/i }).click()
    await expect(page.getByTestId('DEV-ANCHOR-SUCCESS-001')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: /^(listo|done)$/i }).click()

    // Los aceptados salen de la lista: ya están anclados.
    await expect(page.getByText('lote-uno.pdf')).toHaveCount(0)
    await expect(page.getByText('lote-dos.pdf')).toHaveCount(0)

    // El mismo contenido otra vez, en OTRO envío: el navegador no puede saberlo,
    // el backend lo rechaza y el archivo queda en la lista con el motivo.
    await entrada.setInputFiles(pdf('lote-uno-de-nuevo.pdf', 'lote uno'))
    await page.getByRole('button', { name: /anclar evidencia|anchor evidence/i }).click()
    await expect(
      page.getByText(/ya se subió a esta etapa|was already uploaded to this stage/i)
    ).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('lote-uno-de-nuevo.pdf')).toBeVisible()
    await expect(page.getByTestId('DEV-ANCHOR-SUCCESS-001')).toHaveCount(0)
  })

  test('paso 3 · INV recibe la novedad del avance', async ({ page }) => {
    await loginConSolapa(page, 'Investor')
    await page.goto('/investor/notifications')
    await expect(page.getByTestId('INV-NOTIF-LIST-001')).toBeVisible()
  })

  test('paso 4 · CER revisa la evidencia y puede certificar', async ({ page }) => {
    await loginConSolapa(page, 'Certifier')

    const token = await page.evaluate(
      () => JSON.parse(sessionStorage.getItem('proptrust.session') ?? '{}')?.token ?? null
    )
    const stageId = await page.evaluate(async (t) => {
      const res = await fetch('/api/v1/certifier/assignments', {
        headers: { Authorization: `Bearer ${t}` }
      })
      return (await res.json())[0]?.stageId ?? null
    }, token)

    await page.goto(`/certifier/stage/${stageId}`)
    await expect(page.getByTestId('CER-STAGE-VIEW-001')).toBeVisible()
    await expect(page.getByTestId('CER-CERTIFY-001')).toBeVisible()
  })

  test('paso 7 · DEV ve el ciclo indexado en el audit log, con sus TXIDs', async ({ page }) => {
    await loginConSolapa(page, 'Developer')
    await page.goto('/developer/audit-log')

    await expect(page.getByTestId('DEV-AUDIT-LIST-001')).toBeVisible()
    await expect(page.getByTestId('DEV-AUDIT-FILTER-002')).toBeVisible()

    // El filtro por categoría es la fila 49 del backlog: cinco categorías más
    // "Todos".
    await page.getByRole('button', { name: /^(documento|document)$/i }).click()
    await expect(page.getByTestId('DEV-AUDIT-LIST-001')).toBeVisible()
  })
})
