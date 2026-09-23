import type { CapitalByProject, CapitalMonthlyPoint, CapitalSummary } from '@plataforma/shared'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { dictionary } from '#/i18n/dictionary'
import { formatCurrency } from '#/i18n/format'
import { autenticarComo, DEVELOPER_USER, montarRuta } from './-test-mount'
import { Route } from './developer.capital'

const t = (clave: keyof (typeof dictionary)['es-AR']) => dictionary['es-AR'][clave]

const resumen = (sobre: Partial<CapitalSummary> = {}): CapitalSummary => ({
  raisedMinorUnits: 1000000,
  releasedMinorUnits: 0,
  pendingMinorUnits: 1000000,
  contracts: 2,
  currency: 'USD',
  ...sobre
})

const proyecto = (sobre: Partial<CapitalByProject> = {}): CapitalByProject => ({
  projectId: 'p1',
  projectName: 'Torre A',
  raisedMinorUnits: 250000,
  releasedMinorUnits: 0,
  unitsSold: 1,
  totalUnits: 10,
  investors: 3,
  currency: 'USD',
  ...sobre
})

const punto = (month: string, raisedMinorUnits: number): CapitalMonthlyPoint => ({
  month,
  raisedMinorUnits,
  releasedMinorUnits: 0
})

function mockear(
  r: CapitalSummary,
  mensual: CapitalMonthlyPoint[],
  porProyecto: CapitalByProject[]
) {
  autenticarComo(DEVELOPER_USER)
  vi.spyOn(api, 'getCapitalSummary').mockResolvedValue(r)
  vi.spyOn(api, 'getCapitalMonthly').mockResolvedValue(mensual)
  vi.spyOn(api, 'getCapitalByProject').mockResolvedValue(porProyecto)
}

describe('/developer/capital', () => {
  afterEach(() => vi.restoreAllMocks())

  it('mientras alguna de las tres consultas carga muestra un solo estado de carga', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'getCapitalSummary').mockResolvedValue(resumen())
    vi.spyOn(api, 'getCapitalMonthly').mockReturnValue(new Promise(() => {}))
    vi.spyOn(api, 'getCapitalByProject').mockResolvedValue([])
    montarRuta(Route, '/developer/capital')

    await screen.findByRole('status')
    expect(screen.queryByTestId('DEV-CAPITAL-SUMMARY-001')).toBeNull()
  })

  it('con moneda única muestra el total levantado, una barra por mes y una card por proyecto', async () => {
    mockear(
      resumen(),
      [punto('2026-05', 400000), punto('2026-06', 600000)],
      [proyecto(), proyecto({ projectId: 'p2', projectName: 'Torre B', raisedMinorUnits: 750000 })]
    )
    montarRuta(Route, '/developer/capital')

    const resumenEl = await screen.findByTestId('DEV-CAPITAL-SUMMARY-001')
    // `Intl` separa moneda y monto con un espacio no cortante; el matcher normaliza el DOM, no esto.
    expect(
      within(resumenEl).getByText(formatCurrency(1000000, 'USD', 'es-AR').replace(/\s/g, ' '))
    ).toBeTruthy()
    expect(within(resumenEl).getByText(t('developer.capital.totalRaised'))).toBeTruthy()

    const mensual = screen.getByTestId('DEV-CAPITAL-MONTHLY-002')
    expect(within(mensual).getAllByRole('listitem')).toHaveLength(2)
    expect(within(mensual).getByText('may')).toBeTruthy()
    expect(within(mensual).getByText('jun')).toBeTruthy()

    expect(screen.getByText('Torre A')).toBeTruthy()
    expect(screen.getByText('Torre B')).toBeTruthy()
    // El porcentaje de cada proyecto es su parte del total.
    expect(screen.getAllByRole('progressbar').map((b) => b.getAttribute('aria-valuenow'))).toEqual([
      '25',
      '75'
    ])
  })

  it('sin moneda única no se suma: el total y las barras muestran el guión, no un cero', async () => {
    mockear(resumen({ currency: null }), [punto('2026-06', 500000)], [proyecto({ currency: null })])
    montarRuta(Route, '/developer/capital')

    const resumenEl = await screen.findByTestId('DEV-CAPITAL-SUMMARY-001')
    expect(within(resumenEl).getAllByText(t('panel.emptyValue')).length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText(t('panel.emptyValue')).length).toBeGreaterThanOrEqual(3)
  })

  it('sin serie mensual ni proyectos muestra los dos vacíos', async () => {
    mockear(resumen({ raisedMinorUnits: 0, pendingMinorUnits: 0, contracts: 0 }), [], [])
    montarRuta(Route, '/developer/capital')

    await screen.findByText(t('developer.capital.monthlyEmpty'))
    expect(screen.getByText(t('developer.capital.empty'))).toBeTruthy()
  })

  it('con total en cero la parte de cada proyecto es 0%, no NaN', async () => {
    mockear(
      resumen({ raisedMinorUnits: 0, pendingMinorUnits: 0 }),
      [],
      [proyecto({ raisedMinorUnits: 0, investors: 0 })]
    )
    montarRuta(Route, '/developer/capital')

    const barra = await screen.findByRole('progressbar')
    expect(barra.getAttribute('aria-valuenow')).toBe('0')
  })

  it('un mes con movimiento chico se dibuja con el piso del 4%, distinto de uno sin movimiento', async () => {
    mockear(resumen(), [punto('2026-05', 1), punto('2026-06', 1000000)], [])
    montarRuta(Route, '/developer/capital')

    const mensual = await screen.findByTestId('DEV-CAPITAL-MONTHLY-002')
    const barras = [...mensual.querySelectorAll<HTMLElement>('li .bg-primary')]
    expect(barras.map((b) => b.style.height)).toEqual(['4%', '100%'])
  })

  it('la flecha de volver lleva al panel del developer', async () => {
    mockear(resumen(), [], [])
    const router = montarRuta(Route, '/developer/capital', ['/developer'])

    await userEvent.click(await screen.findByRole('button', { name: t('nav.backToPanel') }))

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/developer'))
  })
})
