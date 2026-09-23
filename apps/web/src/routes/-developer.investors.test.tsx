import type { InvestorDirectoryEntry } from '@plataforma/shared'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { dictionary } from '#/i18n/dictionary'
import { formatCurrency } from '#/i18n/format'
import { autenticarComo, DEVELOPER_USER, montarRuta } from './-test-mount'
import { Route } from './developer.investors'

const t = (clave: keyof (typeof dictionary)['es-AR']) => dictionary['es-AR'][clave]

const inversor = (sobre: Partial<InvestorDirectoryEntry>): InvestorDirectoryEntry => ({
  id: 'i-1',
  fullName: 'Ivo Inversor',
  email: 'ivo@example.com',
  units: 2,
  investedMinorUnits: 500000,
  currency: 'USD',
  projects: ['Torre A', 'Torre B'],
  ...sobre
})

describe('/developer/investors', () => {
  afterEach(() => vi.restoreAllMocks())

  it('mientras carga muestra el estado de carga y no el vacío', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listInvestors').mockReturnValue(new Promise(() => {}))
    montarRuta(Route, '/developer/investors')

    const lista = await screen.findByTestId('DEV-INVESTORS-LIST-001')
    expect(within(lista).getByRole('status')).toBeTruthy()
    expect(screen.queryByText(t('developer.investors.empty'))).toBeNull()
  })

  it('sin inversores muestra el vacío', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listInvestors').mockResolvedValue([])
    montarRuta(Route, '/developer/investors')

    await screen.findByText(t('developer.investors.empty'))
  })

  it('cada inversor muestra su inversión, la cantidad de unidades y sus proyectos', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listInvestors').mockResolvedValue([inversor({})])
    montarRuta(Route, '/developer/investors')

    const lista = await screen.findByTestId('DEV-INVESTORS-LIST-001')
    await within(lista).findByText('Ivo Inversor')
    expect(within(lista).getByText('ivo@example.com')).toBeTruthy()
    expect(
      within(lista).getByText(formatCurrency(500000, 'USD', 'es-AR').replace(/\s/g, ' '))
    ).toBeTruthy()
    expect(within(lista).getByText('2 unidades')).toBeTruthy()
    expect(within(lista).getByText('Torre A · Torre B')).toBeTruthy()
  })

  it('un inversor sin moneda muestra "Sin monto" en vez de un importe', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listInvestors').mockResolvedValue([
      inversor({ currency: null, investedMinorUnits: 0, units: 0, projects: [] })
    ])
    montarRuta(Route, '/developer/investors')

    await screen.findByText(t('developer.investors.noAmount'))
  })

  it('la flecha de volver lleva al panel del developer', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listInvestors').mockResolvedValue([])
    const router = montarRuta(Route, '/developer/investors', ['/developer'])

    await userEvent.click(await screen.findByRole('button', { name: t('nav.backToPanel') }))

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/developer'))
  })
})
