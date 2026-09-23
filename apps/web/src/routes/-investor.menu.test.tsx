import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, INVESTOR_USER, montarRuta } from './-test-mount'
import { Route } from './investor.menu'

const t = (clave: keyof (typeof dictionary)['es-AR']) => dictionary['es-AR'][clave]

const DESTINOS = [
  '/investor/buy',
  '/investor/units',
  '/investor/favorites',
  '/investor/notifications'
]

describe('/investor/menu', () => {
  afterEach(() => vi.restoreAllMocks())

  it('INV-MENU-001: lista los cuatro destinos que existen', async () => {
    autenticarComo(INVESTOR_USER)
    montarRuta(Route, '/investor/menu', DESTINOS)

    const menu = await screen.findByTestId('INV-MENU-001')
    expect(menu.querySelectorAll('button')).toHaveLength(4)
    expect(menu.textContent).toContain(t('menu.buy'))
    expect(menu.textContent).toContain(t('menu.notifications'))
  })

  it('tocar cada destino navega a su ruta', async () => {
    autenticarComo(INVESTOR_USER)
    const router = montarRuta(Route, '/investor/menu', DESTINOS)

    for (const [i, ruta] of DESTINOS.entries()) {
      const menu = await screen.findByTestId('INV-MENU-001')
      await userEvent.click(menu.querySelectorAll('button')[i] as HTMLElement)
      await vi.waitFor(() => expect(router.state.location.pathname).toBe(ruta))
      await router.navigate({ to: '/investor/menu' })
    }
  })
})
