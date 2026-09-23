import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import type { DeveloperProject, DeveloperUnit } from '#/api/types'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, DEVELOPER_USER, montarRuta } from './-test-mount'
import { Route } from './developer.units'

const t = (clave: keyof (typeof dictionary)['es-AR']) => dictionary['es-AR'][clave]

const unidad = (sobre: Partial<DeveloperUnit>): DeveloperUnit => ({
  id: 'u1',
  unitReference: 'A-101',
  status: 'available',
  priceMinorUnits: 100000,
  currency: 'USD',
  investorId: null,
  projectId: 'p1',
  projectName: 'Torre A',
  ...sobre
})

const proyecto = (sobre: Partial<DeveloperProject>): DeveloperProject => ({
  id: 'p1',
  name: 'Torre A',
  slug: 'torre-a',
  address: null,
  city: 'Rosario',
  country: 'Argentina',
  latitude: null,
  longitude: null,
  totalUnits: 4,
  estimatedDelivery: null,
  status: 'in_progress',
  organizationId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  stageCount: 10,
  progress: 0,
  priceFromMinorUnits: null,
  priceCurrency: null,
  ...sobre
})

const UNIDADES: DeveloperUnit[] = [
  // Torre A: una vendida, una entregada, una disponible y una reservada.
  unidad({ id: 'u1', status: 'sold' }),
  unidad({ id: 'u2', status: 'delivered' }),
  unidad({ id: 'u3', status: 'available' }),
  unidad({ id: 'u4', status: 'reserved' }),
  // Torre B: solo disponibles, y su proyecto no viene en el listado de proyectos.
  unidad({ id: 'u5', status: 'available', projectId: 'p2', projectName: 'Torre B' })
]

const tarjeta = async (nombre: string) =>
  (await screen.findByText(nombre, { selector: 'h2' })).closest('article') as HTMLElement

describe('/developer/units', () => {
  afterEach(() => vi.restoreAllMocks())

  it('mientras carga muestra el estado de carga y no el vacío', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperUnits').mockReturnValue(new Promise(() => {}))
    vi.spyOn(api, 'listDeveloperProjects').mockResolvedValue([])
    montarRuta(Route, '/developer/units')

    const lista = await screen.findByTestId('DEV-UNITS-INVENTORY-001')
    expect(within(lista).getByRole('status')).toBeTruthy()
    expect(screen.queryByText(t('developer.units.empty'))).toBeNull()
  })

  it('sin unidades muestra el vacío', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperUnits').mockResolvedValue([])
    vi.spyOn(api, 'listDeveloperProjects').mockResolvedValue([])
    montarRuta(Route, '/developer/units')

    await screen.findByText(t('developer.units.empty'))
  })

  it('agrupa por proyecto: total, vendidas (vendida o entregada), disponibles y ocupación', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperUnits').mockResolvedValue(UNIDADES)
    vi.spyOn(api, 'listDeveloperProjects').mockResolvedValue([proyecto({})])
    montarRuta(Route, '/developer/units')

    const a = await tarjeta('Torre A')
    // Total 4, vendidas 2 (sold + delivered), disponibles 1; la reservada solo cuenta en el total.
    const conteos = [...a.querySelectorAll('.bg-surface-alt > span:first-child')].map(
      (n) => n.textContent
    )
    expect(conteos).toEqual(['4', '2', '1'])
    expect(within(a).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50')

    const b = await tarjeta('Torre B')
    const conteosB = [...b.querySelectorAll('.bg-surface-alt > span:first-child')].map(
      (n) => n.textContent
    )
    expect(conteosB).toEqual(['1', '0', '1'])
    expect(within(b).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
  })

  it('el resumen de arriba cuenta todas las unidades y el subtítulo dice cuántas se vendieron', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperUnits').mockResolvedValue(UNIDADES)
    vi.spyOn(api, 'listDeveloperProjects').mockResolvedValue([proyecto({})])
    montarRuta(Route, '/developer/units')

    await screen.findByText('5 unidades en total, 2 vendidas')
    const resumen = document.querySelector('section.grid-cols-3')
    expect(resumen?.textContent).toBe(
      `5${t('developer.projectUnits.countTotal')}2${t('developer.projectUnits.countSold')}2${t('developer.projectUnits.countAvailable')}`
    )
  })

  it('con ubicación en el listado de proyectos la muestra; sin ella, la card no la dibuja', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperUnits').mockResolvedValue(UNIDADES)
    vi.spyOn(api, 'listDeveloperProjects').mockResolvedValue([proyecto({})])
    montarRuta(Route, '/developer/units')

    const a = await tarjeta('Torre A')
    expect(within(a).getByText('Rosario, Argentina')).toBeTruthy()
    const b = await tarjeta('Torre B')
    expect(b.querySelector('p')).toBeNull()
  })

  it('un proyecto con ciudad y sin país (o al revés) muestra solo lo que tiene', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperUnits').mockResolvedValue([unidad({})])
    vi.spyOn(api, 'listDeveloperProjects').mockResolvedValue([proyecto({ country: null })])
    montarRuta(Route, '/developer/units')

    const a = await tarjeta('Torre A')
    expect(within(a).getByText('Rosario')).toBeTruthy()
  })

  it('la flecha de volver lleva al panel del developer', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperUnits').mockResolvedValue([])
    vi.spyOn(api, 'listDeveloperProjects').mockResolvedValue([])
    const router = montarRuta(Route, '/developer/units', ['/developer'])

    await userEvent.click(await screen.findByRole('button', { name: t('nav.backToPanel') }))

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/developer'))
  })
})
