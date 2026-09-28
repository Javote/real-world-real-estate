import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { describir, violacionesNuevas } from '../a11y/hallazgos'
import { loginConSolapa } from './_helpers'

// **SPEC-112 §3 — axe-core sobre el DOM final, en el navegador real.** Es la
// capa que mide lo que jsdom no puede: contraste, landmarks de la página
// entera, lo que el CSS esconde de verdad. Recorre lo de SPEC-112 §Alcance
// (login, alta de proyecto, subir evidencia, certificar, dossier, audit log),
// en mobile y desktop.
//
// Afirma que no haya violaciones FUERA de `a11y/hallazgos.ts`: lo registrado
// ya tiene su spec, lo nuevo pone esto en rojo. Como el resto de `e2e/`, no
// bloquea CI (D-015 §5, SPEC-112 §Invariantes). El resultado completo de axe
// —incluidas las registradas— queda adjunto a cada test en el reporte.

// M2-D3 pide WCAG 2.1 AA. `best-practice` suma landmarks y encabezados, que
// son lo que un lector de pantalla usa para moverse.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']

async function sinViolacionesNuevas(page: Page, superficie: string) {
  await page.waitForLoadState('networkidle')
  const resultado = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  await test.info().attach(`axe · ${superficie}`, {
    body: JSON.stringify(resultado.violations, null, 2),
    contentType: 'application/json'
  })
  const nuevas = violacionesNuevas(resultado.violations)
  expect(nuevas, `${superficie}:\n\n${describir(nuevas)}`).toEqual([])
}

async function tokenDe(page: Page) {
  return page.evaluate(
    () => JSON.parse(sessionStorage.getItem('proptrust.session') ?? '{}')?.token ?? null
  )
}

/** El primer id de una lista de la API, para la ruta que lo necesita. */
async function primerId(page: Page, ruta: string, campo: string) {
  const token = await tokenDe(page)
  const id = await page.evaluate(
    async ([t, r, c]) => {
      const res = await fetch(r, { headers: { Authorization: `Bearer ${t}` } })
      const lista = await res.json()
      return lista[0]?.[c] ?? null
    },
    [token, ruta, campo] as const
  )
  expect(id, `${ruta} no devolvió ningún ${campo}: ¿la base está sembrada?`).not.toBeNull()
  return id as string
}

test('login', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('Usuario')).toBeVisible()
  await sinViolacionesNuevas(page, '/login')
})

test('developer · panel, obras, alta de proyecto, audit log y subir evidencia', async ({
  page
}) => {
  await loginConSolapa(page, 'Developer')

  await page.goto('/developer')
  await expect(page.getByTestId('DEV-PANEL-KPIS-001')).toBeVisible()
  await sinViolacionesNuevas(page, '/developer')

  await page.goto('/developer/projects')
  await sinViolacionesNuevas(page, '/developer/projects')

  await page.goto('/developer/project/new')
  await expect(page.getByTestId('DEV-PROJECT-CREATE-001')).toBeVisible()
  await sinViolacionesNuevas(page, '/developer/project/new')

  await page.goto('/developer/audit-log')
  await expect(page.getByTestId('DEV-AUDIT-LIST-001')).toBeVisible()
  await sinViolacionesNuevas(page, '/developer/audit-log')

  const proyecto = await primerId(page, '/api/v1/developer/projects', 'id')
  await page.goto(`/developer/project/${proyecto}/upload`)
  await expect(page.getByTestId('DEV-EVIDENCE-UPLOAD-001')).toBeVisible()
  await sinViolacionesNuevas(page, '/developer/project/:id/upload')
})

test('certifier · panel, etapa y el modal de observar', async ({ page }) => {
  await loginConSolapa(page, 'Certifier')

  await page.goto('/certifier')
  await expect(page.getByTestId('CER-PANEL-001')).toBeVisible()
  await sinViolacionesNuevas(page, '/certifier')

  const etapa = await primerId(page, '/api/v1/certifier/assignments', 'stageId')
  await page.goto(`/certifier/stage/${etapa}`)
  await expect(page.getByTestId('CER-STAGE-VIEW-001')).toBeVisible()
  await sinViolacionesNuevas(page, '/certifier/stage/:id')

  // Un modal abierto: el foco y el contenido detrás cambian lo que axe ve.
  await page.getByRole('button', { name: /observar|observe/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await sinViolacionesNuevas(page, 'ObserveStageModal')
})

test('investor · comprar, mis unidades y dossier', async ({ page }) => {
  await loginConSolapa(page, 'Investor')

  await page.goto('/investor/buy')
  await expect(page.getByTestId('INV-BUY-LIST-001')).toBeVisible()
  await sinViolacionesNuevas(page, '/investor/buy')

  await page.goto('/investor/units')
  await expect(page.getByTestId('INV-UNITS-LIST-001')).toBeVisible()
  await sinViolacionesNuevas(page, '/investor/units')

  const unidad = await primerId(page, '/api/v1/investor/units', 'id')
  await page.goto(`/investor/unit/${unidad}/dossier`)
  await expect(page.getByTestId('INV-DOSSIER-VIEW-001').first()).toBeVisible()
  await sinViolacionesNuevas(page, '/investor/unit/:id/dossier')
})

test('notary · panel y revisión de dossier', async ({ page }) => {
  await loginConSolapa(page, 'Notary')

  await page.goto('/notary')
  await expect(page.getByTestId('NOT-PANEL-001')).toBeVisible()
  await sinViolacionesNuevas(page, '/notary')

  const dossier = await primerId(page, '/api/v1/notary/dossiers/pending', 'dossierId')
  await page.goto(`/notary/dossier/${dossier}`)
  await expect(page.getByTestId('NOT-DOSSIER-VIEW-001')).toBeVisible()
  await sinViolacionesNuevas(page, '/notary/dossier/:id')
})
