import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import type { DeveloperProject } from '#/api/types'
import { dictionary } from '#/i18n/dictionary'
import { formatCurrency, formatMonthYear } from '#/i18n/format'
import { autenticarComo, DEVELOPER_USER, montarRuta } from './-test-mount'
import { Route } from './developer.projects'

const t = (clave: keyof (typeof dictionary)['es-AR']) => dictionary['es-AR'][clave]

/** Fixture completa: todo lo anulable presente. */
const completo = (sobre: Partial<DeveloperProject> = {}): DeveloperProject => ({
  id: 'p1',
  name: 'Torre A',
  slug: 'torre-a',
  address: 'Av. Siempreviva 742',
  city: 'Rosario',
  country: 'Argentina',
  latitude: -32.9,
  longitude: -60.6,
  totalUnits: 12,
  estimatedDelivery: '2027-06-15T12:00:00.000Z',
  status: 'in_progress',
  organizationId: 'o1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  stageCount: 10,
  progress: 40,
  priceFromMinorUnits: 9000000,
  priceCurrency: 'USD',
  ...sobre
})

/** Fixture mínima: todo lo anulable en `null`. */
const minimo = (sobre: Partial<DeveloperProject> = {}): DeveloperProject =>
  completo({
    id: 'p2',
    name: 'Torre B',
    slug: 'torre-b',
    address: null,
    city: null,
    country: null,
    latitude: null,
    longitude: null,
    estimatedDelivery: null,
    status: 'planning',
    priceFromMinorUnits: null,
    priceCurrency: null,
    progress: 0,
    ...sobre
  })

const tarjeta = async (nombre: string) =>
  (await screen.findByText(nombre)).closest('article') as HTMLElement

describe('/developer/projects', () => {
  afterEach(() => vi.restoreAllMocks())

  it('mientras carga muestra el estado de carga y no el vacío', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperProjects').mockReturnValue(new Promise(() => {}))
    montarRuta(Route, '/developer/projects')

    const lista = await screen.findByTestId('DEV-PROJECTS-LIST-001')
    expect(within(lista).getByRole('status')).toBeTruthy()
    expect(screen.queryByText(t('developer.projects.empty'))).toBeNull()
  })

  it('sin proyectos muestra el vacío', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperProjects').mockResolvedValue([])
    montarRuta(Route, '/developer/projects')

    await screen.findByText(t('developer.projects.empty'))
  })

  it('un proyecto en obra muestra estado, ubicación, "desde", unidades, entrega y avance', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperProjects').mockResolvedValue([completo()])
    montarRuta(Route, '/developer/projects')

    const card = await tarjeta('Torre A')
    expect(within(card).getByText(t('projectStatus.in_progress'))).toBeTruthy()
    expect(within(card).getByText('Rosario, Argentina')).toBeTruthy()
    expect(
      within(card).getByText(formatCurrency(9000000, 'USD', 'es-AR').replace(/\s/g, ' '))
    ).toBeTruthy()
    expect(within(card).getByText('12')).toBeTruthy()
    expect(
      within(card).getByText(formatMonthYear('2027-06-15T12:00:00.000Z', 'es-AR'))
    ).toBeTruthy()
    expect(within(card).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40')
  })

  it('un proyecto terminado dice "Entregado en <año>" y no dibuja la barra de avance', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperProjects').mockResolvedValue([
      completo({ status: 'completed', progress: 100 })
    ])
    montarRuta(Route, '/developer/projects')

    const card = await tarjeta('Torre A')
    expect(within(card).getByText(t('projectStatus.completed'))).toBeTruthy()
    expect(within(card).getByText('Entregado en 2027')).toBeTruthy()
    expect(within(card).queryByRole('progressbar')).toBeNull()
  })

  it('un proyecto con todo lo opcional en `null` no dibuja ubicación, "desde" ni fecha', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperProjects').mockResolvedValue([minimo()])
    montarRuta(Route, '/developer/projects')

    const card = await tarjeta('Torre B')
    expect(within(card).getByText(t('projectStatus.planning'))).toBeTruthy()
    expect(within(card).queryByText(t('projectCard.from'))).toBeNull()
    expect(card.querySelector('svg.lucide-map-pin')).toBeNull()
    expect(card.querySelector('svg.lucide-calendar')).toBeNull()
  })

  it('con precio pero sin moneda no se dibuja el "desde"', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperProjects').mockResolvedValue([
      minimo({ priceFromMinorUnits: 100, priceCurrency: null })
    ])
    montarRuta(Route, '/developer/projects')

    const card = await tarjeta('Torre B')
    expect(within(card).queryByText(t('projectCard.from'))).toBeNull()
  })

  it('el subtítulo cuenta los proyectos', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperProjects').mockResolvedValue([completo(), minimo()])
    montarRuta(Route, '/developer/projects')

    await screen.findByText('2 proyectos')
  })

  it('tocar un proyecto navega a su detalle', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperProjects').mockResolvedValue([completo({ id: 'p-9' })])
    const router = montarRuta(Route, '/developer/projects', ['/developer/project/$projectId'])

    await userEvent.click(within(await tarjeta('Torre A')).getAllByRole('button')[0])

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/developer/project/p-9'))
  })

  it('"Nuevo" lleva al formulario de proyecto nuevo y la flecha vuelve al panel', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperProjects').mockResolvedValue([])
    const router = montarRuta(Route, '/developer/projects', [
      '/developer/project/new',
      '/developer'
    ])

    await userEvent.click(await screen.findByRole('button', { name: t('developer.projects.new') }))
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/developer/project/new'))

    await router.navigate({ to: '/developer/projects' })
    await userEvent.click(
      await screen.findByRole('button', { name: t('developer.projects.backToPanel') })
    )
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/developer'))
  })
})
