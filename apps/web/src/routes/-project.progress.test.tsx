import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '#/api/port'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, INVESTOR_USER, montarRuta } from './-test-mount'
import { Route } from './project.$projectId.progress'

const t = dictionary['es-AR']

type Proyecto = Awaited<ReturnType<typeof api.getProject>>
type Stages = Awaited<ReturnType<typeof api.listProjectStages>>
type Documentos = Awaited<ReturnType<typeof api.listProjectDocuments>>

const stage = (n: number, state: string) => ({
  id: `s${n}`,
  projectId: 'p1',
  name: `Etapa-${n}`,
  sequenceOrder: n,
  state
})

const stages = [
  stage(1, 'Completed'),
  stage(2, 'InProgress'),
  stage(3, 'Pending')
] as unknown as Stages

const proyecto = (over: Record<string, unknown> = {}) =>
  ({
    id: 'p1',
    name: 'Torre Norte',
    estimatedDelivery: '2027-06-15T12:00:00.000Z',
    stages: [],
    ...over
  }) as unknown as Proyecto

const doc = (id: string, over: Record<string, unknown>) => ({
  id,
  stageId: 's1',
  evidenceType: 'document',
  mimeType: 'application/pdf',
  ...over
})

const RUTAS = ['/project/$projectId', '/project/$projectId/stage/$stageId']

function montar() {
  return montarRuta(Route, '/project/$projectId/progress', RUTAS, '/project/p1/progress')
}

function mockear(opciones: { proyecto?: Proyecto; stages?: Stages; documentos?: unknown[] } = {}) {
  autenticarComo(INVESTOR_USER)
  vi.spyOn(api, 'getProject').mockResolvedValue(opciones.proyecto ?? proyecto())
  vi.spyOn(api, 'listProjectStages').mockResolvedValue(opciones.stages ?? stages)
  vi.spyOn(api, 'listProjectDocuments').mockResolvedValue(
    (opciones.documentos ?? []) as unknown as Documentos
  )
}

describe('/project/:projectId/progress (investor)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('INV-PROJECT-STAGES-001: un 403 al pedir las etapas muestra "sin acceso"', async () => {
    mockear()
    vi.spyOn(api, 'listProjectStages').mockRejectedValue(new ApiError(403, 'no'))
    montar()

    const p = await screen.findByText(t['error.forbidden'])
    expect(p.getAttribute('data-testid')).toBe('INV-PROJECT-STAGES-001')
  })

  it('INV-PROJECT-STAGES-001: un 403 al pedir el proyecto muestra "sin acceso" aunque las etapas lleguen', async () => {
    mockear()
    vi.spyOn(api, 'getProject').mockRejectedValue(new ApiError(403, 'no'))
    montar()

    const p = await screen.findByText(t['error.forbidden'])
    expect(p.getAttribute('data-testid')).toBe('INV-PROJECT-STAGES-001')
  })

  it('mientras carga: spinner, sin lista ni aviso de vacío', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'getProject').mockReturnValue(new Promise(() => {}))
    vi.spyOn(api, 'listProjectStages').mockReturnValue(new Promise(() => {}))
    vi.spyOn(api, 'listProjectDocuments').mockReturnValue(new Promise(() => {}))
    montar()

    const seccion = await screen.findByTestId('INV-PROJECT-STAGES-001')
    expect(within(seccion).getByRole('status')).toBeTruthy()
    expect(seccion.textContent).not.toContain(t['developer.progress.empty'])
  })

  it('un proyecto sin etapas muestra el aviso de vacío', async () => {
    mockear({ stages: [] as unknown as Stages })
    montar()

    await screen.findByText(t['developer.progress.empty'])
  })

  it('lista las etapas con su posición "N de total", su estado y la etapa actual', async () => {
    mockear()
    montar()

    const seccion = await screen.findByTestId('INV-PROJECT-STAGES-001')
    await within(seccion).findByRole('button', { name: /^Etapa-3Etapa / })
    expect(seccion.textContent).toContain('Etapa 1 de 3')
    expect(seccion.textContent).toContain('Etapa 3 de 3')
    expect(seccion.textContent).toContain(t['stage.state.Completed'])
    expect(seccion.textContent).toContain(t['stage.state.InProgress'])
    expect(seccion.textContent).toContain(t['stage.state.Pending'])
    expect(seccion.textContent).toContain('Etapa actual: Etapa-2')
    expect(seccion.textContent).toContain('2027')
  })

  it('un proyecto sin fecha de entrega no la muestra', async () => {
    mockear({ proyecto: proyecto({ estimatedDelivery: null }) })
    montar()

    const seccion = await screen.findByTestId('INV-PROJECT-STAGES-001')
    await within(seccion).findByRole('button', { name: /^Etapa-3Etapa / })
    expect(seccion.textContent).not.toContain('Finalización')
  })

  it('con todo completado no hay "etapa actual"', async () => {
    mockear({ stages: [stage(1, 'Completed'), stage(2, 'Completed')] as unknown as Stages })
    montar()

    const seccion = await screen.findByTestId('INV-PROJECT-STAGES-001')
    await within(seccion).findByRole('button', { name: /^Etapa-2Etapa / })
    expect(seccion.textContent).not.toContain('Etapa actual')
  })

  it('cuenta las fotos por etapa: evidencia tipo foto e imágenes por MIME, sin contar documentos ni huérfanas', async () => {
    mockear({
      documentos: [
        doc('f1', { evidenceType: 'photo', mimeType: 'image/jpeg' }),
        doc('f2', { mimeType: 'image/png' }),
        doc('d1', { stageId: 's2' }),
        doc('f3', { stageId: null, evidenceType: 'photo', mimeType: 'image/jpeg' })
      ]
    })
    montar()

    const primera = await screen.findByRole('button', { name: /^Etapa-1Etapa / })
    await waitFor(() => expect(primera.textContent).toContain('+2'))
    const segunda = screen.getByRole('button', { name: /^Etapa-2Etapa / })
    expect(segunda.textContent).not.toContain('+')
  })

  it('tocar una etapa de la lista navega a su detalle', async () => {
    mockear()
    montar()

    await userEvent.click(await screen.findByRole('button', { name: /^Etapa-3Etapa / }))

    await screen.findByText('/project/$projectId/stage/$stageId')
  })

  it('tocar un nodo del timeline navega a su detalle', async () => {
    mockear()
    montar()

    const timeline = await screen.findByRole('list', { name: t['investor.project.timelineAria'] })
    await userEvent.click(await within(timeline).findByRole('button', { name: 'Etapa-2' }))

    await screen.findByText('/project/$projectId/stage/$stageId')
  })

  it('volver lleva al proyecto', async () => {
    mockear()
    montar()

    await userEvent.click(await screen.findByRole('button', { name: t['investor.project.back'] }))

    await screen.findByText('/project/$projectId')
  })
})
