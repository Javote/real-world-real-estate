import { expect, type Page } from '@playwright/test'

import { passwordDe, ROL_DE_SOLAPA } from './_credenciales.ts'

// Ayudantes compartidos por los specs. El guion bajo lo mantiene fuera del
// `testDir` como archivo de test: Playwright levanta `*.spec.ts`, no esto.

/**
 * Espera a que React haya MONTADO, no a que exista el DOM.
 *
 * Con formularios controlados, un click antes del montaje cae sobre DOM inerte:
 * el botón hace submit nativo, nunca corre el `preventDefault` y la página
 * recarga sin llamar a la API. Da fallas intermitentes que parecen de backend y
 * no lo son. Como SPA (D-065) cambió *cuándo* monta React, no *que* haya que
 * esperarlo.
 *
 * Se sondea con las solapas de rol: tocar una reescribe el campo de usuario, y
 * eso solo puede hacerlo React ya montado.
 */
export async function waitForHydration(page: Page) {
  const username = page.getByLabel('Usuario')
  await expect(username).toBeVisible()
  await expect(async () => {
    await page.getByRole('tab', { name: 'Investor' }).click()
    await expect(username).toHaveValue('buyer@example.com')
  }).toPass({ timeout: 20_000, intervals: [250, 500, 1000] })
}

/**
 * Entra con el usuario que prefilla la solapa del rol y la password del seed.
 *
 * La password del prefill (`ROLE_PRESETS`, `login.tsx`) es el default local y
 * no sirve si el seed se corrió con `SEED_DEMO_PASSWORD`: se pisa con la que
 * resuelve `passwordDe` (`_credenciales.ts`).
 *
 * **Verifica que el prefill haya ocurrido antes de mandar el formulario.** Sin
 * eso el click en "Ingresar" puede salir con los campos vacíos: la solapa
 * dispara un `setState` de React y Playwright no lo espera solo — solo espera
 * que el botón sea clickeable, que lo es desde el primer frame. Era el motivo
 * de que los cuatro paneles fallaran en desktop y pasaran en mobile: una
 * carrera, no una diferencia de viewport.
 */
export async function loginConSolapa(page: Page, rol: string) {
  await page.goto('/login')
  await waitForHydration(page)

  await page.getByRole('tab', { name: rol }).click()
  await expect(page.getByLabel('Usuario')).not.toHaveValue('')
  await expect(page.getByLabel('Contraseña')).not.toHaveValue('')
  const rolSembrado = ROL_DE_SOLAPA[rol]
  if (!rolSembrado) throw new Error(`Solapa sin rol del seed: ${rol}`)
  await page.getByLabel('Contraseña').fill(passwordDe(rolSembrado))

  await page.getByRole('button', { name: /ingresar|sign in/i }).click()

  // **Espera a que la sesión exista antes de devolver el control.** Sin esto el
  // helper vuelve apenas se hace el click, y cualquier `page.goto()` posterior
  // aborta el POST de login en vuelo: el test siguiente arranca sin sesión y el
  // guard lo rebota a /login. Se ve como "la ruta no existe" y no lo es.
  //
  // Se espera la SESIÓN y no la URL porque no todos los roles aterrizan en el
  // mismo lugar, y admin no aterriza en ninguno (SPEC-011 §Casos borde).
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('proptrust.session') !== null), {
      timeout: 15_000
    })
    .toBe(true)
}
