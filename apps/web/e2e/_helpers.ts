import { expect, type Page } from '@playwright/test'

import { passwordDe, ROL_DE_SOLAPA, SOLAPA_ES } from './_credenciales.ts'

export async function waitForHydration(page: Page) {
  const username = page.getByLabel('Usuario')
  await expect(username).toBeVisible()
  await expect(async () => {
    await page.getByRole('tab', { name: 'Inversor' }).click()
    await expect(username).toHaveValue('buyer@example.com')
  }).toPass({ timeout: 20_000, intervals: [250, 500, 1000] })
}

export async function loginConSolapa(page: Page, rol: string) {
  await page.goto('/login')
  await waitForHydration(page)

  await page.getByRole('tab', { name: SOLAPA_ES[rol] ?? rol }).click()
  await expect(page.getByLabel('Usuario')).not.toHaveValue('')
  const rolSembrado = ROL_DE_SOLAPA[rol]
  if (!rolSembrado) throw new Error(`Solapa sin rol del seed: ${rol}`)
  await page.getByLabel('Contraseña').fill(passwordDe(rolSembrado))

  await page.getByRole('button', { name: /ingresar|sign in/i }).click()

  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('proptrust.session') !== null), {
      timeout: 15_000
    })
    .toBe(true)
}
