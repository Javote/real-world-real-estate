import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '#/auth/session'
import { clearSession } from '#/auth/session'
import {
  ADMIN_USER,
  autenticarComo,
  CERTIFIER_USER,
  DEVELOPER_USER,
  INVESTOR_USER,
  montarRuta,
  NOTARY_USER
} from './-test-mount'
import { Route } from './index'

const ATERRIZAJES: [string, Session['user'], string][] = [
  ['investor', INVESTOR_USER, '/investor/buy'],
  ['developer', DEVELOPER_USER, '/developer'],
  ['notary', NOTARY_USER, '/notary'],
  ['certifier', CERTIFIER_USER, '/certifier'],
  ['admin', ADMIN_USER, '/admin']
]

describe('/ (redirección al aterrizaje)', () => {
  afterEach(() => {
    clearSession()
    vi.restoreAllMocks()
  })

  it('sin sesión manda a /login', async () => {
    clearSession()
    montarRuta(
      Route.options.component as () => React.ReactElement,
      '/',
      ATERRIZAJES.map(([, , ruta]) => ruta)
    )

    await screen.findByText('LOGIN-STUB')
  })

  it.each(ATERRIZAJES)('con sesión de %s manda a su aterrizaje', async (_rol, user, ruta) => {
    autenticarComo(user)
    montarRuta(
      Route.options.component as () => React.ReactElement,
      '/',
      ATERRIZAJES.map(([, , r]) => r)
    )

    await screen.findByText(ruta)
    expect(screen.queryByText('LOGIN-STUB')).toBeNull()
  })
})
