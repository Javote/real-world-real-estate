import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, DEVELOPER_USER, montarRuta } from './-test-mount'
import { Route } from './developer.profile'

const t = (clave: keyof (typeof dictionary)['es-AR']) => dictionary['es-AR'][clave]

function mockearPerfil() {
  autenticarComo(DEVELOPER_USER)
  vi.spyOn(api, 'getProfile').mockResolvedValue({
    id: DEVELOPER_USER.id,
    email: DEVELOPER_USER.email,
    role: 'developer',
    fullName: DEVELOPER_USER.fullName,
    isActive: true,
    notificationPrefsJson: null,
    createdAt: new Date(),
    updatedAt: new Date()
  })
}

describe('/developer/profile', () => {
  afterEach(() => vi.restoreAllMocks())

  it('DEV-PROFILE-001: renderiza ProfileScreen con el rol y el testId del developer', async () => {
    mockearPerfil()
    montarRuta(Route, '/developer/profile')

    await screen.findByText(DEVELOPER_USER.email)
    const seccion = screen.getByTestId('DEV-PROFILE-001')
    expect(seccion.textContent).toContain(DEVELOPER_USER.fullName)
  })

  it('la flecha de volver lleva al panel del developer', async () => {
    mockearPerfil()
    const router = montarRuta(Route, '/developer/profile', ['/developer'])

    await userEvent.click(await screen.findByRole('button', { name: t('nav.backToPanel') }))

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/developer'))
  })
})
