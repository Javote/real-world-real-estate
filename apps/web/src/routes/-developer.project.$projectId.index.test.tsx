import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, DEVELOPER_USER, montarRuta } from './-test-mount'
import { Route } from './developer.project.$projectId.index'

const t = dictionary['es-AR']

type Proyecto = Awaited<ReturnType<typeof api.getDeveloperProject>>
type Capital = Awaited<ReturnType<typeof api.getCapitalByProject>>[number]

const etapa = (id: string, orden: number, state: string) => ({
  id,
  name: `Etapa ${orden}`,
  sequenceOrder: orden,
  state
})

const proyecto = (over: Record<string, unknown> = {}): Proyecto =>
  ({
    id: 'p1',
    name: 'Torre Alpine',
    city: 'Rosario',
    country: 'Argentina',
    status: 'in_progress',
    stages: [etapa('s1', 1, 'Completed'), etapa('s2', 2, 'Pending')],
    evidenceCount: 0,
    ...over
  }) as unknown as Proyecto

const capital = (over: Record<string, unknown> = {}): Capital =>
  ({
    projectId: 'p1',
    projectName: 'Torre Alpine',
    raisedMinorUnits: 840_000_000,
    releasedMinorUnits: 0,
    unitsSold: 3,
    totalUnits: 10,
    investors: 2,
    currency: 'USD',
    ...over
  }) as unknown as Capital

const montar = () =>
  montarRuta(
    Route.options.component as () => React.ReactElement,
    '/developer/project/$projectId/',
    [
      '/developer/projects',
      '/developer/project/$projectId/units',
      '/developer/project/$projectId/invite',
      '/developer/project/$projectId/upload',
      '/developer/project/$projectId/contracts'
    ],
    '/developer/project/p1/'
  )

function preparar(p: Proyecto | 'cargando', cap: Capital[]) {
  autenticarComo(DEVELOPER_USER)
  vi.spyOn(api, 'getDeveloperProject').mockImplementation(() =>
    p === 'cargando' ? new Promise(() => {}) : Promise.resolve(p)
  )
  vi.spyOn(api, 'getCapitalByProject').mockResolvedValue(cap)
}

describe('/developer/project/$projectId (hub)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('cargando: sin tarjeta del proyecto, avance 0% y capital vacío', async () => {
    preparar('cargando', [])
    montar()

    const hub = await screen.findByTestId('DEV-PROJECT-DETAIL-001')
    expect(hub.querySelector('article')).toBeNull()
    expect(hub.textContent).toContain('0%')
    expect(hub.textContent).toContain(t['panel.emptyValue'])
  })

  it('con ubicación y capital: "ciudad, país", estado, avance derivado y monto compacto', async () => {
    preparar(proyecto(), [capital({ projectId: 'otro', investors: 9 }), capital()])
    montar()

    const hub = await screen.findByTestId('DEV-PROJECT-DETAIL-001')
    await waitFor(() => expect(hub.textContent).toContain('Rosario, Argentina'))
    expect(hub.textContent).toContain(t['project.status.in_progress'])
    expect(hub.textContent).toContain('50%')
    expect(hub.textContent).not.toContain(t['panel.emptyValue'])
  })

  it('sin ubicación ni capital de este proyecto: sin línea de ubicación y monto vacío', async () => {
    preparar(proyecto({ city: null, country: null }), [capital({ projectId: 'otro' })])
    montar()

    const hub = await screen.findByTestId('DEV-PROJECT-DETAIL-001')
    await waitFor(() => expect(hub.querySelector('article')).not.toBeNull())
    expect(hub.querySelector('article p')).toBeNull()
    expect(hub.textContent).toContain(t['panel.emptyValue'])
  })

  it('capital sin moneda: muestra el valor vacío en vez del monto', async () => {
    preparar(proyecto(), [capital({ currency: null })])
    montar()

    const hub = await screen.findByTestId('DEV-PROJECT-DETAIL-001')
    await waitFor(() => expect(hub.querySelector('article')).not.toBeNull())
    expect(hub.textContent).toContain(t['panel.emptyValue'])
  })

  it.each([
    ['developer.project.unitsAction', '/developer/project/p1/units'],
    ['developer.project.inviteAction', '/developer/project/p1/invite'],
    ['developer.project.uploadAction', '/developer/project/p1/upload'],
    ['developer.project.contractsAction', '/developer/project/p1/contracts']
  ] as const)('el tile %s navega a %s', async (clave, destino) => {
    preparar(proyecto(), [])
    const router = montar()

    fireEvent.click(await screen.findByRole('button', { name: t[clave] }))

    await waitFor(() => expect(router.state.location.pathname).toBe(destino))
  })

  it('el botón de volver lleva al listado de proyectos', async () => {
    preparar(proyecto(), [])
    const router = montar()
    await screen.findByTestId('DEV-PROJECT-DETAIL-001')

    fireEvent.click(screen.getByRole('button', { name: t['nav.back'] }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/developer/projects'))
  })
})
