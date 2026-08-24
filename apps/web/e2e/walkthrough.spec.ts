import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'

// Walkthrough: recorre la app como la recorrería una persona y deja una captura
// por pantalla. No es un test de regresión estricto — es la evidencia visual de
// que la app corre de punta a punta, y la base de comparación contra el
// catálogo oficial de pantallas (docs/milestone-2-diseno/M2-D2-Screenshots-catalog/).
//
// Nombrado según la convención de test IDs de M2-D5 §2.3: ROLE-AREA-ACTION-NNN.

const SHOTS = join(import.meta.dirname, '.artifacts', 'screenshots')
mkdirSync(SHOTS, { recursive: true })

// Usuarios del seed (apps/api/src/db/seed.ts), con el landing que le
// corresponde a cada uno desde SPEC-011 (apps/web/src/auth/roles.ts
// ROLE_LANDING). El valor del rol (`buyer`/`verifier`) todavía no coincide
// con la etiqueta de UI (Investor/Certifier) — ver SPEC-011 §Preguntas
// abiertas, deuda de la misma familia que D-023.
//
// `admin` queda afuera de este listado a propósito: no tiene solapa ni
// landing en esta rebanada (SPEC-011 §Casos borde) — se prueba aparte.
const SEED_USERS = [
  {
    role: 'buyer',
    tab: 'Investor',
    email: 'buyer@example.com',
    password: 'buyer123',
    landing: '/investor/buy'
  },
  {
    role: 'developer',
    tab: 'Developer',
    email: 'developer@example.com',
    password: 'developer123',
    landing: '/developer'
  },
  {
    role: 'notary',
    tab: 'Notary',
    email: 'notary@example.com',
    password: 'notary123',
    landing: '/notary'
  },
  {
    role: 'verifier',
    tab: 'Certifier',
    email: 'verifier@example.com',
    password: 'verifier123',
    landing: '/certifier'
  }
] as const

async function shot(page: Page, name: string) {
  const project = test.info().project.name
  // El botón flotante de TanStack Devtools aparece en dev y ensucia la captura.
  // Estas imágenes son evidencia de entrega de M3, así que salen limpias.
  await page.addStyleTag({
    content: `
      [aria-label="Open TanStack Devtools"],
      .tsqd-parent-container,
      #tanstack-devtools { display: none !important; }
    `
  })
  await page.screenshot({
    path: join(SHOTS, `${project}--${name}.png`),
    fullPage: true
  })
}

// La página llega por SSR (TanStack Start) y el formulario es controlado por
// React. Hasta que hidrata, los clicks caen sobre DOM inerte: el botón hace
// submit nativo, nunca corre el preventDefault, y la página se recarga sin
// llamar a la API. Da fallas intermitentes que parecen de backend y no lo son.
//
// Sondeamos la hidratación con las solapas de rol: tocar una reescribe el
// campo de usuario, y eso solo puede hacerlo React ya montado.
async function waitForHydration(page: Page) {
  const username = page.getByLabel('Usuario')
  await expect(username).toBeVisible()
  await expect(async () => {
    await page.getByRole('tab', { name: 'Investor' }).click()
    await expect(username).toHaveValue('buyer@example.com')
  }).toPass({ timeout: 20_000, intervals: [250, 500, 1000] })
}

async function gotoLogin(page: Page) {
  await page.goto('/login')
  await waitForHydration(page)
}

async function login(page: Page, tab: string, email: string, password: string, landing: string) {
  await gotoLogin(page)
  await page.getByRole('tab', { name: tab }).click()
  await page.getByLabel('Usuario').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(new RegExp(landing.replace('/', '\\/')))
}

test.describe('Walkthrough', () => {
  test('AUTH-LOGIN-001 · la pantalla de login carga y ofrece los perfiles del seed', async ({
    page
  }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible()
    await shot(page, '01-login')
  })

  test('AUTH-LOGIN-001 · credenciales inválidas no crean sesión', async ({ page }) => {
    // FALLA ESPERADA — bug del proxy de desarrollo, no de la app.
    // El proxy de nitro convierte `POST` + `401` en `502 Bad Gateway` ("fetch
    // failed" en h3), así que el front recibe un 502 y muestra "No se pudo
    // conectar con la API" en lugar de "Credenciales inválidas". Reproducible al
    // 100%, y solo esa combinación: GET 401, POST 400 y POST 200 pasan bien.
    //
    // Es de `nitro-nightly` + `h3@2.0.1-rc.25` (ambos pre-release) y solo afecta
    // al dev-worker de Vite: en producción la API es otro origen y no hay proxy.
    // Se destraba cuando Nitro pase a estable — ver CLAUDE.md §Stack.
    //
    // Marcado a propósito: si el bug se arregla, Playwright avisa "expected to
    // fail but passed" y el recordatorio salta solo. OJO: va acá adentro y no
    // afuera — a nivel describe, test.fail() aplica a todos los tests que siguen.
    test.fail(true, 'proxy de nitro dev: POST+401 → 502')

    await gotoLogin(page)
    await page.getByLabel('Usuario').fill('developer@example.com')
    await page.getByLabel('Contraseña').fill('contraseña-incorrecta')
    await page.getByRole('button', { name: 'Ingresar' }).click()

    await expect(page.getByText('Credenciales inválidas')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
    await shot(page, '02-login-error')
  })

  for (const user of SEED_USERS) {
    test(`AUTH-LOGIN-001 · entra como ${user.role} y ve el shell de su panel`, async ({ page }) => {
      await login(page, user.tab, user.email, user.password, user.landing)
      await expect(page.locator('body')).toContainText(/./)
      await shot(page, `03-panel-${user.role}`)
    })
  }

  test('AUTH-LOGIN-001 · admin no tiene solapa ni landing en esta rebanada (SPEC-011 §Casos borde)', async ({
    page
  }) => {
    await gotoLogin(page)
    await page.getByLabel('Usuario').fill('admin@example.com')
    await page.getByLabel('Contraseña').fill('admin123')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    // ROLE_LANDING['admin'] es null: el login es válido pero no hay panel de
    // admin todavía, así que el ruteo vuelve a /login — no es un error.
    await expect(page).toHaveURL(/\/login/)
  })

  // Las dos pruebas que seguían acá —detalle de proyecto y verificación por
  // hash— recorrían `/dashboard` y `/verify`, que se borraron en D-064: no
  // existen en ningún entregable. Vuelven cuando se transcriban las
  // superficies reales que sí están en M2-D5 (`/project/:projectId`, fila
  // 06-07, y `/public/dossier/:shareToken`), con sus test IDs de verdad.
})
