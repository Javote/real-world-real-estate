import { screen } from '@testing-library/react'
import { afterEach, describe, it, vi } from 'vitest'
import { api } from '#/api/port'
import { autenticarComo, CERTIFIER_USER, montarRuta } from './-test-mount'
import { Route } from './certifier.assigned'

describe('/certifier/assigned', () => {
  afterEach(() => vi.restoreAllMocks())

  it('la solapa 2 renderiza la cola de stages asignados dentro del panel', async () => {
    autenticarComo(CERTIFIER_USER)
    vi.spyOn(api, 'getCertifierAssignments').mockResolvedValue([
      { stageId: 's1', projectName: 'Torre A', stageName: 'Cimentación', sequenceOrder: 1 }
    ])

    montarRuta(Route.options.component as () => React.ReactElement, '/certifier/assigned')

    await screen.findByText('Torre A')
  })
})
