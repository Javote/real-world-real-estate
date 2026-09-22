import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { autenticarComo, montarRuta, NOTARY_USER } from './-test-mount'
import { Route } from './notary.index'

describe('/notary (panel)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('NOT-PANEL-001: día 1, los cuatro KPI en guión — cero dossiers no es lo mismo que sin dato', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getNotaryKpis').mockResolvedValue({
      pendingDossiers: null,
      verified: null,
      signed: null,
      unitsUnderReview: null
    })
    vi.spyOn(api, 'getNotaryPendingDossiers').mockResolvedValue([])

    montarRuta(Route.options.component as () => React.ReactElement, '/notary/')

    const panel = await screen.findByTestId('NOT-PANEL-001')
    expect(panel.textContent).not.toContain('null')
    await screen.findByTestId('NOT-PENDING-002')
  })

  it('NOT-PANEL-001 con datos: muestra los cuatro valores de `getNotaryKpis`', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getNotaryKpis').mockResolvedValue({
      pendingDossiers: 3,
      verified: 12,
      signed: 5,
      unitsUnderReview: 2
    })
    vi.spyOn(api, 'getNotaryPendingDossiers').mockResolvedValue([])

    montarRuta(Route.options.component as () => React.ReactElement, '/notary/')

    const panel = await screen.findByTestId('NOT-PANEL-001')
    await vi.waitFor(() => expect(panel.textContent).toContain('3'))
    expect(panel.textContent).toContain('12')
    expect(panel.textContent).toContain('5')
    expect(panel.textContent).toContain('2')
  })
})
