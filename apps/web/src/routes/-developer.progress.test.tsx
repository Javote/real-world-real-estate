import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import type { ProgressRow } from '#/api/types'
import { dictionary } from '#/i18n/dictionary'
import { formatMonthYear } from '#/i18n/format'
import { autenticarComo, DEVELOPER_USER, montarRuta } from './-test-mount'
import { Route } from './developer.progress'

const t = (clave: keyof (typeof dictionary)['es-AR']) => dictionary['es-AR'][clave]

const fila = (sobre: Partial<ProgressRow>): ProgressRow => ({
  stageId: 's1',
  stageName: 'Cimentación',
  sequenceOrder: 1,
  state: 'Pending',
  certifiedAt: null,
  projectId: 'p1',
  projectName: 'Torre A',
  estimatedDelivery: null,
  ...sobre
})

/** Torre A: los cuatro estados, con entrega y con `certifiedAt` en la completada. */
const TORRE_A: ProgressRow[] = [
  fila({
    stageId: 'a1',
    stageName: 'Permisos',
    sequenceOrder: 1,
    state: 'Completed',
    certifiedAt: '2026-03-10T12:00:00.000Z',
    estimatedDelivery: '2027-06-15T12:00:00.000Z'
  }),
  fila({
    stageId: 'a2',
    stageName: 'Estructura',
    sequenceOrder: 2,
    state: 'InProgress',
    estimatedDelivery: '2027-06-15T12:00:00.000Z'
  }),
  fila({
    stageId: 'a3',
    stageName: 'Instalaciones',
    sequenceOrder: 3,
    state: 'Observed',
    estimatedDelivery: '2027-06-15T12:00:00.000Z'
  }),
  fila({
    stageId: 'a4',
    stageName: 'Terminaciones',
    sequenceOrder: 4,
    state: 'Pending',
    estimatedDelivery: '2027-06-15T12:00:00.000Z'
  })
]

/** Torre B: todo pendiente y sin fecha de entrega. */
const TORRE_B: ProgressRow[] = [
  fila({
    stageId: 'b1',
    stageName: 'Proyecto',
    projectId: 'p2',
    projectName: 'Torre B',
    state: 'Pending'
  })
]

describe('/developer/progress', () => {
  afterEach(() => vi.restoreAllMocks())

  it('mientras carga muestra el estado de carga y no el vacío', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'getDeveloperProgress').mockReturnValue(new Promise(() => {}))
    montarRuta(Route, '/developer/progress')

    const lista = await screen.findByTestId('DEV-PROGRESS-001')
    expect(within(lista).getByRole('status')).toBeTruthy()
    expect(screen.queryByText(t('developer.progress.empty'))).toBeNull()
  })

  it('sin etapas muestra el vacío y ninguna sección de observadas', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'getDeveloperProgress').mockResolvedValue([])
    montarRuta(Route, '/developer/progress')

    await screen.findByText(t('developer.progress.empty'))
    expect(screen.queryByTestId('DEV-PROGRESS-RESUME')).toBeNull()
  })

  it('cuenta las etapas completadas, en curso (incluida la observada) y pendientes de todos los proyectos', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'getDeveloperProgress').mockResolvedValue([...TORRE_A, ...TORRE_B])
    montarRuta(Route, '/developer/progress')

    await screen.findByText('Torre B', { selector: 'h2' })
    // Cada tile es "valor" + "etiqueta"; el resumen es la primera sección de la pantalla.
    const resumen = document.querySelector('section.grid-cols-3')
    expect(resumen?.textContent).toBe(
      `1${t('developer.progress.completed')}2${t('developer.progress.inProgress')}2${t('developer.progress.pending')}`
    )
  })

  it('cada proyecto lleva su avance general, su etapa actual, su entrega y el detalle por etapa', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'getDeveloperProgress').mockResolvedValue([...TORRE_A, ...TORRE_B])
    montarRuta(Route, '/developer/progress')

    const lista = await screen.findByTestId('DEV-PROGRESS-001')
    await within(lista).findByText('Torre A')
    const [barraA, barraB] = within(lista).getAllByRole('progressbar')
    // 1 completada de 4.
    expect(barraA.getAttribute('aria-valuenow')).toBe('25')
    expect(barraB.getAttribute('aria-valuenow')).toBe('0')

    // Torre A: la primera etapa en curso u observada es la actual, y hay fecha de entrega.
    expect(within(lista).getByText('Etapa 2: Estructura')).toBeTruthy()
    expect(
      within(lista).getByText(
        `Finalización: ${formatMonthYear('2027-06-15T12:00:00.000Z', 'es-AR')}`
      )
    ).toBeTruthy()
    expect(
      within(lista).getByText(`Etapa 1/4 · ${formatMonthYear('2026-03-10T12:00:00.000Z', 'es-AR')}`)
    ).toBeTruthy()
    // La etapa sin certificar no lleva fecha.
    expect(within(lista).getByText('Etapa 4/4')).toBeTruthy()
    // Torre B: todo pendiente, sin etapa actual ni entrega.
    expect(within(lista).queryByText(/Etapa 1: Proyecto/)).toBeNull()
    expect(within(lista).getAllByText(/Finalización/)).toHaveLength(1)

    expect(within(lista).getByText(t('stage.state.Completed'))).toBeTruthy()
    expect(within(lista).getByText(t('stage.state.InProgress'))).toBeTruthy()
    expect(within(lista).getByText(t('stage.state.Observed'))).toBeTruthy()
    expect(within(lista).getAllByText(t('stage.state.Pending'))).toHaveLength(2)
  })

  it('DEV-PROGRESS-RESUME: una etapa observada aparece aparte y "Reanudar" la pasa a `InProgress`', async () => {
    autenticarComo(DEVELOPER_USER)
    const listar = vi.spyOn(api, 'getDeveloperProgress').mockResolvedValue(TORRE_A)
    const reanudar = vi.spyOn(api, 'setMilestoneState').mockResolvedValue({} as never)
    montarRuta(Route, '/developer/progress')

    const seccion = await screen.findByTestId('DEV-PROGRESS-RESUME')
    expect(within(seccion).getByText('Torre A · Instalaciones')).toBeTruthy()
    expect(within(seccion).getByText(t('status.observed'))).toBeTruthy()

    await userEvent.click(within(seccion).getByTestId('DEV-PROGRESS-RESUME-BTN'))

    expect(reanudar).toHaveBeenCalledWith('a3', 'InProgress')
    await vi.waitFor(() => expect(listar).toHaveBeenCalledTimes(2))
  })

  it('mientras la reanudación está en vuelo, el botón queda deshabilitado', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'getDeveloperProgress').mockResolvedValue(TORRE_A)
    vi.spyOn(api, 'setMilestoneState').mockReturnValue(new Promise(() => {}))
    montarRuta(Route, '/developer/progress')

    const boton = (await screen.findByTestId('DEV-PROGRESS-RESUME-BTN')) as HTMLButtonElement
    await userEvent.click(boton)

    await vi.waitFor(() => expect(boton.disabled).toBe(true))
  })

  it('con dos etapas observadas, solo la que se está reanudando muestra el estado de carga', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'getDeveloperProgress').mockResolvedValue([
      fila({ stageId: 'o1', stageName: 'Uno', state: 'Observed' }),
      fila({ stageId: 'o2', stageName: 'Dos', sequenceOrder: 2, state: 'Observed' })
    ])
    vi.spyOn(api, 'setMilestoneState').mockReturnValue(new Promise(() => {}))
    montarRuta(Route, '/developer/progress')

    const botones = await screen.findAllByTestId('DEV-PROGRESS-RESUME-BTN')
    await userEvent.click(botones[0])

    await vi.waitFor(() => {
      expect((botones[0] as HTMLButtonElement).disabled).toBe(true)
      expect((botones[1] as HTMLButtonElement).disabled).toBe(true)
    })
    expect(botones[0].querySelector('[role="status"], svg.animate-spin')).toBeTruthy()
    expect(botones[1].querySelector('[role="status"], svg.animate-spin')).toBeNull()
  })

  it('la flecha de volver lleva al panel del developer', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'getDeveloperProgress').mockResolvedValue([])
    const router = montarRuta(Route, '/developer/progress', ['/developer'])

    await userEvent.click(await screen.findByRole('button', { name: t('nav.backToPanel') }))

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/developer'))
  })
})
