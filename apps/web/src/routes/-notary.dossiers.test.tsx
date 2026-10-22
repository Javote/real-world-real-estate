import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '#/api/port'
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

  it('mientras carga, la carga dentro del panel', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getNotaryPendingDossiers').mockReturnValue(new Promise(() => {}))

    montarRuta(Route, '/notary/dossiers')

    await screen.findByRole('status')
    expect(screen.queryByText(esAR['panel.notary.emptyPending'])).toBeNull()
  })

  it('si la cola falla, el error y nunca la cola vacía', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getNotaryPendingDossiers').mockRejectedValue(new ApiError(500, 'caído'))

    montarRuta(Route, '/notary/dossiers')

    expect((await screen.findByRole('alert')).textContent).toBe(esAR['error.generic'])
    expect(screen.queryByText(esAR['panel.notary.emptyPending'])).toBeNull()
  })
})
