import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import type { InvestorUnit } from '#/api/types'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, INVESTOR_USER, montarRuta } from './-test-mount'
import { Route } from './investor.units'

const t = (clave: keyof (typeof dictionary)['es-AR']) => dictionary['es-AR'][clave]

const unidad = (sobre: Partial<InvestorUnit>): InvestorUnit => ({
  id: 'un-1',
  unitReference: 'A-101',
  status: 'sold',
  sizeM2: 60,
  priceMinorUnits: 100000,
  currency: 'USD',
  projectId: 'p1',
  projectName: 'Torre A',
  city: 'Rosario',
  progress: 40,
  ...sobre
})

describe('/investor/units', () => {
  afterEach(() => vi.restoreAllMocks())

  it('mientras carga muestra el estado de carga y no el vacío', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listInvestorUnits').mockReturnValue(new Promise(() => {}))
    montarRuta(Route, '/investor/units')

    const lista = await screen.findByTestId('INV-UNITS-LIST-001')
    expect(within(lista).getByRole('status')).toBeTruthy()
    expect(screen.queryByText(t('investor.units.empty'))).toBeNull()
  })

  it('sin unidades muestra el vacío', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listInvestorUnits').mockResolvedValue([])
    montarRuta(Route, '/investor/units')

    await screen.findByText(t('investor.units.empty'))
  })

  it('cada estado de unidad muestra su etiqueta, incluida `delivered`, y el proyecto con su ciudad', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listInvestorUnits').mockResolvedValue([
      unidad({ id: 'a', unitReference: 'U-SOLD', status: 'sold' }),
      unidad({ id: 'b', unitReference: 'U-DELIVERED', status: 'delivered' }),
      unidad({ id: 'c', unitReference: 'U-RESERVED', status: 'reserved', city: null }),
      unidad({ id: 'd', unitReference: 'U-AVAILABLE', status: 'available' })
    ])
    montarRuta(Route, '/investor/units')

    const lista = await screen.findByTestId('INV-UNITS-LIST-001')
    await within(lista).findByText('U-DELIVERED')
    const tarjeta = (ref: string) => within(lista).getByText(ref).closest('button') as HTMLElement

    expect(within(tarjeta('U-SOLD')).getByText(t('unitStatus.sold'))).toBeTruthy()
    expect(within(tarjeta('U-DELIVERED')).getByText(t('unitStatus.delivered'))).toBeTruthy()
    expect(within(tarjeta('U-RESERVED')).getByText(t('unitStatus.reserved'))).toBeTruthy()
    expect(within(tarjeta('U-AVAILABLE')).getByText(t('unitStatus.available'))).toBeTruthy()
    expect(within(tarjeta('U-SOLD')).getByText('Torre A · Rosario')).toBeTruthy()
    // Sin ciudad, el nombre del proyecto va solo.
    expect(within(tarjeta('U-RESERVED')).getByText('Torre A')).toBeTruthy()
  })

  it('una unidad `delivered` lleva el tono verificado, como `sold`: no cae al neutro', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listInvestorUnits').mockResolvedValue([
      unidad({ id: 'a', unitReference: 'U-SOLD', status: 'sold' }),
      unidad({ id: 'b', unitReference: 'U-DELIVERED', status: 'delivered' }),
      unidad({ id: 'd', unitReference: 'U-AVAILABLE', status: 'available' })
    ])
    montarRuta(Route, '/investor/units')

    const lista = await screen.findByTestId('INV-UNITS-LIST-001')
    await within(lista).findByText('U-DELIVERED')
    const clase = (estado: Parameters<typeof t>[0]) => within(lista).getByText(t(estado)).className

    expect(clase('unitStatus.delivered')).toBe(clase('unitStatus.sold'))
    expect(clase('unitStatus.delivered')).not.toBe(clase('unitStatus.available'))
  })

  it('tocar una unidad navega a su detalle', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listInvestorUnits').mockResolvedValue([unidad({ id: 'un-9' })])
    const router = montarRuta(Route, '/investor/units', ['/investor/unit/$unitId'])

    await userEvent.click(await screen.findByText('A-101'))

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/investor/unit/un-9'))
  })
})
