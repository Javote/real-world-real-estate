import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { autenticarComo, montarRuta, NOTARY_USER } from './-test-mount'
import { Route } from './notary.profile'

describe('/notary/profile', () => {
  afterEach(() => vi.restoreAllMocks())

  it('NOT-PROFILE-001: renderiza ProfileScreen con el rol y el testId del notario', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getProfile').mockResolvedValue({
      id: NOTARY_USER.id,
      email: NOTARY_USER.email,
      role: 'notary',
      fullName: NOTARY_USER.fullName,
      isActive: true,
      notificationPrefsJson: null,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    montarRuta(Route.options.component as () => React.ReactElement, '/notary/profile')

    await screen.findByText(NOTARY_USER.email)
    const seccion = screen.getByTestId('NOT-PROFILE-001')
    expect(seccion.textContent).toContain(NOTARY_USER.fullName)
  })
})
