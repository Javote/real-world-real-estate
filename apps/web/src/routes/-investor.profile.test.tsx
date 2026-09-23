import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { autenticarComo, INVESTOR_USER, montarRuta } from './-test-mount'
import { Route } from './investor.profile'

describe('/investor/profile', () => {
  afterEach(() => vi.restoreAllMocks())

  it('INV-PROFILE-VIEW-001: renderiza ProfileScreen con el rol y el testId del investor', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'getProfile').mockResolvedValue({
      id: INVESTOR_USER.id,
      email: INVESTOR_USER.email,
      role: 'buyer',
      fullName: INVESTOR_USER.fullName,
      isActive: true,
      notificationPrefsJson: null,
      createdAt: new Date(),
      updatedAt: new Date()
    } as never)

    montarRuta(Route, '/investor/profile')

    await screen.findByText(INVESTOR_USER.email)
    expect(screen.getByTestId('INV-PROFILE-VIEW-001').textContent).toContain(INVESTOR_USER.fullName)
  })
})
