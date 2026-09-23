import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '#/api/port'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, INVESTOR_USER, montarRuta } from './-test-mount'
import { Route } from './investor.unit.$unitId.contract'

const t = dictionary['es-AR']

type Contrato = Awaited<ReturnType<typeof api.getInvestorContract>>
type Liberacion = Awaited<ReturnType<typeof api.listContractReleases>>[number]

const TXID = 'c'.repeat(64)

const contrato = (over: Partial<Record<keyof Contrato, unknown>> = {}): Contrato =>
  ({
    id: 'c1',
    totalMinorUnits: 15000000,
    currency: 'USD',
    signedAt: Date.parse('2026-08-15T12:00:00Z'),
    investorId: 'u-inv',
    unitReference: 'Torre A · 4B',
    ...over
  }) as unknown as Contrato

const liberacion = (over: Partial<Record<keyof Liberacion, unknown>> = {}): Liberacion =>
  ({
    id: 'r1',
    stageNumber: 2,
    amountMinorUnits: 500000,
    releasedAt: Date.parse('2026-09-01T12:00:00Z'),
    commitment: null,
    txid: TXID,
    anchorStatus: 'Confirmed',
    ...over
  }) as unknown as Liberacion

const montar = () =>
  montarRuta(
    Route.options.component as () => React.ReactElement,
    '/investor/unit/$unitId/contract',
    ['/investor/unit/$unitId'],
    '/investor/unit/u1/contract'
  )

function preparar(opciones: {
  contrato?: Contrato | Error | 'cargando'
  releases?: Liberacion[]
  unidad?: 'ok' | 'error'
}) {
  autenticarComo(INVESTOR_USER)
  vi.spyOn(api, 'getInvestorUnit').mockImplementation(() =>
    opciones.unidad === 'error'
      ? Promise.reject(new ApiError(500, 'boom'))
      : Promise.resolve({ unitReference: 'Torre A · 4B' } as unknown as Awaited<
          ReturnType<typeof api.getInvestorUnit>
        >)
  )
  const c = opciones.contrato ?? contrato()
  vi.spyOn(api, 'getInvestorContract').mockImplementation(() =>
    c === 'cargando'
      ? new Promise(() => {})
      : c instanceof Error
        ? Promise.reject(c)
        : Promise.resolve(c)
  )
  return vi.spyOn(api, 'listContractReleases').mockResolvedValue(opciones.releases ?? [])
}

describe('/investor/unit/$unitId/contract', () => {
  afterEach(() => vi.restoreAllMocks())

  it('INV-CONTRACT-VIEW-001: contrato firmado — monto, fecha de firma y referencia de la unidad', async () => {
    preparar({ releases: [] })
    montar()

    await screen.findByText(t['investor.contract.summary'])
    const vista = screen.getByTestId('INV-CONTRACT-VIEW-001')
    expect(vista.textContent).toContain(t['investor.contract.total'])
    expect(vista.textContent).toContain('150.000')
    expect(vista.textContent).toContain('2026')
    expect(vista.textContent).not.toContain(t['investor.contract.unsigned'])
    await screen.findByText('Torre A · 4B')
  })

  it('contrato sin firmar — dice "sin fecha de firma"', async () => {
    preparar({ contrato: contrato({ signedAt: null }) })
    montar()

    await screen.findByText(t['investor.contract.unsigned'])
  })

  it('sin contrato todavía (404) — mensaje de ausencia, sin resumen', async () => {
    preparar({ contrato: new ApiError(404, 'no hay contrato') })
    montar()

    await screen.findByText(t['investor.contract.missing'])
    expect(screen.queryByText(t['investor.contract.summary'])).toBeNull()
  })

  it('el 404 tiene botón de volver a la unidad', async () => {
    preparar({ contrato: new ApiError(404, 'no hay contrato') })
    const router = montar()
    await screen.findByText(t['investor.contract.missing'])

    fireEvent.click(screen.getByRole('button', { name: t['nav.back'] }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/investor/unit/u1'))
  })

  it('con contrato, el botón de volver también lleva a la unidad', async () => {
    preparar({ releases: [] })
    const router = montar()
    await screen.findByText(t['investor.contract.summary'])

    fireEvent.click(screen.getByRole('button', { name: t['nav.back'] }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/investor/unit/u1'))
  })

  it('sin permiso (403) — muestra el error de acceso', async () => {
    preparar({ contrato: new ApiError(403, 'no') })
    montar()

    await screen.findByText(t['error.forbidden'])
    expect(screen.queryByText(t['investor.contract.summary'])).toBeNull()
  })

  it('un error que no es de ausencia no reemplaza la pantalla: sin resumen, con cronograma', async () => {
    preparar({ contrato: new ApiError(500, 'boom'), unidad: 'error' })
    montar()

    await screen.findByText(t['investor.contract.schedule'])
    expect(screen.queryByText(t['investor.contract.summary'])).toBeNull()
  })

  it('mientras el contrato carga no hay resumen ni cronograma vacío definitivo', async () => {
    preparar({ contrato: 'cargando' })
    montar()

    await screen.findByText(t['investor.contract.schedule'])
    expect(screen.queryByText(t['investor.contract.summary'])).toBeNull()
  })

  it('sin liberaciones muestra el vacío del cronograma', async () => {
    preparar({ releases: [] })
    montar()

    await screen.findByText(t['investor.contract.emptyReleases'])
  })

  it('pide las liberaciones del contrato por su id', async () => {
    const pedir = preparar({ releases: [] })
    montar()

    await screen.findByText(t['investor.contract.emptyReleases'])
    expect(pedir).toHaveBeenCalledWith('c1')
  })

  it('INV-RELEASES-LIST-002: una liberación anclada abre el modal de su TXID', async () => {
    preparar({ releases: [liberacion()] })
    montar()

    const lista = await screen.findByTestId('INV-RELEASES-LIST-002')
    await waitFor(() => expect(lista.textContent).toContain(`${t['investor.contract.stage']} 2`))
    expect(lista.textContent).toContain('5.000')
    expect(screen.queryByTestId('INV-TXID-MODAL-001')).toBeNull()

    fireEvent.click(await screen.findByRole('button', { name: /cccccc/ }))

    const modal = await screen.findByTestId('INV-TXID-MODAL-001')
    expect(modal.textContent).toContain(`${t['investor.contract.stage']} 2`)
  })

  it('el modal del TXID se cierra con Escape', async () => {
    preparar({ releases: [liberacion()] })
    montar()

    fireEvent.click(await screen.findByRole('button', { name: /cccccc/ }))
    await screen.findByTestId('INV-TXID-MODAL-001')

    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByTestId('INV-TXID-MODAL-001')).toBeNull())
  })

  it('una liberación sin TXID figura como pendiente y no ofrece modal (regla 17)', async () => {
    preparar({ releases: [liberacion({ txid: null, anchorStatus: null })] })
    montar()

    const lista = await screen.findByTestId('INV-RELEASES-LIST-002')
    await waitFor(() => expect(lista.textContent).toContain(t['status.pending']))
    expect(screen.queryByRole('button', { name: /cccccc/ })).toBeNull()
    expect(screen.queryByTestId('INV-TXID-MODAL-001')).toBeNull()
  })
})
