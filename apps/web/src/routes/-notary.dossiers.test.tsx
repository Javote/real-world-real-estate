import { screen } from '@testing-library/react'
import { afterEach, describe, it, vi } from 'vitest'
import { api } from '#/api/port'
import { esAR } from '#/i18n/dictionary'
import { fabrica } from '#/test/fabrica'
import { autenticarComo, montarRuta, NOTARY_USER } from './-test-mount'
import { Route } from './notary.dossiers'

describe('/notary/dossiers', () => {
  afterEach(() => vi.restoreAllMocks())

  it('la solapa 2 renderiza la cola de dossiers pendientes dentro del panel', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getNotaryPendingDossiers').mockResolvedValue([fabrica.pendiente()])

    montarRuta(Route, '/notary/dossiers')

    await screen.findByText('Ana Torres')
  })
  it('sin dossiers pendientes, el estado vacío de la cola', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getNotaryPendingDossiers').mockResolvedValue([])

    montarRuta(Route, '/notary/dossiers')

    await screen.findByText(esAR['panel.notary.emptyPending'])
  })
})
