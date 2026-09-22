import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { autenticarComo, CERTIFIER_USER, montarRuta } from './-test-mount'
import { Route } from './certifier.profile'

describe('/certifier/profile', () => {
  afterEach(() => vi.restoreAllMocks())

  it('CER-PROFILE-001: renderiza ProfileScreen con el rol y el testId del certifier', async () => {
    autenticarComo(CERTIFIER_USER)
    vi.spyOn(api, 'getProfile').mockResolvedValue({
      id: CERTIFIER_USER.id,
      email: CERTIFIER_USER.email,
      role: 'verifier',
      fullName: CERTIFIER_USER.fullName,
      isActive: true,
      notificationPrefsJson: null,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    montarRuta(Route.options.component as () => React.ReactElement, '/certifier/profile')

    await screen.findByText(CERTIFIER_USER.email)
    const seccion = screen.getByTestId('CER-PROFILE-001')
    expect(seccion.textContent).toContain(CERTIFIER_USER.fullName)
  })
})
