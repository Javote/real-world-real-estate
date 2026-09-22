import { screen } from '@testing-library/react'
import { afterEach, describe, it, vi } from 'vitest'
import { api } from '#/api/port'
import { autenticarComo, montarRuta, NOTARY_USER } from './-test-mount'
import { Route } from './notary.dossiers'

describe('/notary/dossiers', () => {
  afterEach(() => vi.restoreAllMocks())

  it('la solapa 2 renderiza la cola de dossiers pendientes dentro del panel', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getNotaryPendingDossiers').mockResolvedValue([
      { dossierId: 'd1', unitLabel: 'Torre A · 4B', investorName: 'Ana Torres', completeness: 60 }
    ])

    montarRuta(Route.options.component as () => React.ReactElement, '/notary/dossiers')

    await screen.findByText('Ana Torres')
  })
})
