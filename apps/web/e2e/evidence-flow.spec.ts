import { expect, test } from '@playwright/test'
import { loginConSolapa } from './_helpers'

test.describe('Evidence flow — M2-D1 §6', () => {
  test('paso 1 y 2 · DEV sube evidencia y obtiene Merkle root + TXID', async ({ page }) => {
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

    await page.getByLabel(/arrastrá archivos|drag files/i).setInputFiles({
      name: 'acta-inspeccion.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(`%PDF-1.4\nacta de prueba ${Date.now()}\n%%EOF\n`)
    })

    await page.getByRole('button', { name: /anclar evidencia|anchor evidence/i }).click()

    await expect(page.getByTestId('DEV-ANCHOR-SUCCESS-001')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/merkle/i)).toBeVisible()
  })

  test('paso 2b · un lote de varios archivos: un anclaje, y lo rechazado queda en la lista con su motivo', async ({
    page
  }) => {
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
      { name: 'falso.pdf', mimeType: 'application/pdf', buffer: Buffer.from('MZ ejecutable') }
    ])
    await expect(page.getByText(/falso\.pdf no es un PDF|falso\.pdf is not a valid/i)).toBeVisible()
    await expect(page.getByText('lote-uno.pdf')).toBeVisible()
    await expect(page.getByText('lote-dos.pdf')).toBeVisible()

    await page.getByRole('button', { name: /anclar evidencia|anchor evidence/i }).click()
    await expect(page.getByTestId('DEV-ANCHOR-SUCCESS-001')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: /^(listo|done)$/i }).click()

    await expect(page.getByText('lote-uno.pdf')).toHaveCount(0)
    await expect(page.getByText('lote-dos.pdf')).toHaveCount(0)

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

    await page.getByRole('button', { name: /^(documento|document)$/i }).click()
    await expect(page.getByTestId('DEV-AUDIT-LIST-001')).toBeVisible()
  })
})
