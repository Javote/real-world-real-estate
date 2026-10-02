import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'

import { passwordDe, SOLAPA_ES } from './_credenciales.ts'

const SHOTS = join(import.meta.dirname, '.artifacts', 'screenshots')
mkdirSync(SHOTS, { recursive: true })

const SEED_USERS = [
  {
    role: 'buyer',
    tab: 'Investor',
    email: 'buyer@example.com',
    password: passwordDe('buyer'),
    landing: '/investor/buy'
  },
  {
    role: 'developer',
    tab: 'Developer',
    email: 'developer@example.com',
    password: passwordDe('developer'),
    landing: '/developer'
  },
  {
    role: 'notary',
    tab: 'Notary',
    email: 'notary@example.com',
    password: passwordDe('notary'),
    landing: '/notary'
  },
  {
    role: 'verifier',
    tab: 'Certifier',
    email: 'verifier@example.com',
    password: passwordDe('verifier'),
    landing: '/certifier'
  }
] as const

async function shot(page: Page, name: string) {
  const project = test.info().project.name
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

async function waitForHydration(page: Page) {
  const username = page.getByLabel('Usuario')
  await expect(username).toBeVisible()
  await expect(async () => {
    await page.getByRole('tab', { name: 'Inversor' }).click()
    await expect(username).toHaveValue('buyer@example.com')
  }).toPass({ timeout: 20_000, intervals: [250, 500, 1000] })
}

async function gotoLogin(page: Page) {
  await page.goto('/login')
  await waitForHydration(page)
}

async function login(page: Page, tab: string, email: string, password: string, landing: string) {
  await gotoLogin(page)
  await page.getByRole('tab', { name: SOLAPA_ES[tab] ?? tab }).click()
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
    await gotoLogin(page)
    await page.getByLabel('Usuario').fill('developer@example.com')
    await page.getByLabel('Contraseña').fill('contraseña-incorrecta')
    await page.getByRole('button', { name: 'Ingresar' }).click()

    await expect(page.locator('p').filter({ hasText: 'Credenciales inválidas' })).toBeVisible()
    await expect(page.locator('[aria-live="assertive"]')).toHaveText('Credenciales inválidas')
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

  test('AUTH-LOGIN-001 · admin no tiene solapa, pero entra tipeando su usuario y cae en /admin (D-095)', async ({
    page
  }) => {
    await gotoLogin(page)
    await page.getByLabel('Usuario').fill('admin@example.com')
    await page.getByLabel('Contraseña').fill(passwordDe('admin'))
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page).toHaveURL(/\/admin/)
    await expect(page.getByTestId('ADMIN-PROJECT-001')).toBeVisible()
  })

  test('AUTH-ME-001 · la sesión se revalida contra el servidor en cada pantalla protegida', async ({
    page
  }) => {
    const llamadas: number[] = []
    page.on('response', (r) => {
      if (r.url().includes('/api/v1/auth/me')) llamadas.push(r.status())
    })

    await login(page, 'Developer', 'developer@example.com', passwordDe('developer'), '/developer')

    await expect.poll(() => llamadas, { timeout: 15_000 }).toContain(200)

    await page.evaluate(() => {
      const raw = JSON.parse(sessionStorage.getItem('proptrust.session') ?? '{}')
      sessionStorage.setItem(
        'proptrust.session',
        JSON.stringify({ ...raw, token: 'roto.roto.roto' })
      )
    })
    await page.goto('/developer')
    await expect(page).toHaveURL(/\/login/)
    await expect.poll(() => llamadas, { timeout: 15_000 }).toContain(401)
  })
})
