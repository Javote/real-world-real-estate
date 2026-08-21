import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

// Walkthrough: recorre la app como la recorrería una persona y deja una captura
// por pantalla. No es un test de regresión estricto — es la evidencia visual de
// que la app corre de punta a punta, y la base de comparación contra el
// catálogo oficial de pantallas (docs/milestone-2-diseno/M2-D2-Screenshots-catalog/).
//
// Nombrado según la convención de test IDs de M2-D5 §2.3: ROLE-AREA-ACTION-NNN.

const SHOTS = join(import.meta.dirname, '.artifacts', 'screenshots')
mkdirSync(SHOTS, { recursive: true })

// Usuarios del seed (packages/api/prisma/seed.ts).
// OJO: estos NO son los cuatro roles de M2-D1 (INV/DEV/NOT/CER). El backend
// todavía usa buyer/verifier y no tiene notary — es parte de lo que se corrige
// cuando se rehaga el modelo de roles.
const SEED_USERS = [
  { role: 'admin', email: 'admin@example.com', password: 'admin123' },
  { role: 'developer', email: 'developer@example.com', password: 'developer123' },
  { role: 'buyer', email: 'buyer@example.com', password: 'buyer123' },
  { role: 'verifier', email: 'verifier@example.com', password: 'verifier123' },
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
    `,
  })
  await page.screenshot({
    path: join(SHOTS, `${project}--${name}.png`),
    fullPage: true,
  })
}

// La página llega por SSR (TanStack Start) y el formulario es controlado por
// React. Hasta que hidrata, los clicks caen sobre DOM inerte: el botón hace
// submit nativo, nunca corre el preventDefault, y la página se recarga sin
// llamar a la API. Da fallas intermitentes que parecen de backend y no lo son.
//
// Sondeamos la hidratación con el selector de rol: cambiar de preset reescribe
// el campo de email, y eso solo puede hacerlo React ya montado.
async function waitForHydration(page: Page) {
  const email = page.getByLabel('Email')
  await expect(email).toBeVisible()
  await expect(async () => {
    await page.locator('.role-option', { hasText: 'Buyer' }).click()
    await expect(email).toHaveValue('buyer@example.com')
  }).toPass({ timeout: 20_000, intervals: [250, 500, 1000] })
}

async function gotoLogin(page: Page) {
  await page.goto('/login')
  await waitForHydration(page)
}

async function login(page: Page, email: string, password: string) {
  await gotoLogin(page)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

test.describe('Walkthrough', () => {
  test('AUTH-LOGIN-001 · la pantalla de login carga y ofrece los perfiles del seed', async ({
    page,
  }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible()
    await shot(page, '01-login')
  })

  test('AUTH-LOGIN-002 · credenciales inválidas no crean sesión', async ({ page }) => {
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
    await page.getByLabel('Email').fill('developer@example.com')
    await page.getByLabel('Contraseña').fill('contraseña-incorrecta')
    await page.getByRole('button', { name: 'Ingresar' }).click()

    await expect(page.getByText('Credenciales inválidas')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
    await shot(page, '02-login-error')
  })

  for (const user of SEED_USERS) {
    test(`AUTH-LOGIN-003 · entra como ${user.role} y ve su dashboard`, async ({ page }) => {
      await login(page, user.email, user.password)
      await expect(page.locator('body')).toContainText(/./)
      await shot(page, `03-dashboard-${user.role}`)
    })
  }

  test('DEV-PROJECT-DETAIL-001 · detalle de proyecto con sus stages y evidencia', async ({
    page,
  }) => {
    await login(page, 'developer@example.com', 'developer123')

    // El seed crea un único proyecto (slug torre-a); se entra por la primera tarjeta.
    const firstProject = page.locator('a[href^="/projects/"]').first()
    await expect(firstProject).toBeVisible()
    await firstProject.click()

    await expect(page).toHaveURL(/\/projects\//)
    await shot(page, '04-project-detail')
  })

  test('INV-VERIFY-001 · verificación por hash sin cuenta', async ({ page }) => {
    await page.goto('/verify')
    await expect(page.getByRole('heading', { name: /Verificación de documentos/i })).toBeVisible()
    await shot(page, '05-verify')
  })
})
