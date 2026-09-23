import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, DEVELOPER_USER, montarRuta } from './-test-mount'
import { Route } from './developer.project.$projectId.contracts'

const t = dictionary['es-AR']

type Contrato = Awaited<ReturnType<typeof api.listProjectContracts>>[number]

const TXID = 'a'.repeat(64)

const contrato = (over: Partial<Record<keyof Contrato, unknown>> = {}): Contrato =>
  ({
    id: 'c1',
    totalMinorUnits: 15_000_000,
    currency: 'USD',
    signedAt: Date.parse('2026-08-15T12:00:00Z'),
    unitId: 'u1',
    unitReference: 'Torre A · 4B',
    unitStatus: 'sold',
    investorName: 'Ana Inversora',
    txid: TXID,
    commitment: null,
    ...over
  }) as unknown as Contrato

const montar = () =>
  montarRuta(
    Route.options.component as () => React.ReactElement,
    '/developer/project/$projectId/contracts',
    ['/developer/project/$projectId'],
    '/developer/project/p1/contracts'
  )

function preparar(contratos: Contrato[] | 'cargando', proyecto = true) {
  autenticarComo(DEVELOPER_USER)
  vi.spyOn(api, 'getDeveloperProject').mockImplementation(() =>
    proyecto
      ? Promise.resolve({ name: 'Torre Alpine' } as unknown as Awaited<
          ReturnType<typeof api.getDeveloperProject>
        >)
      : new Promise(() => {})
  )
  return vi
    .spyOn(api, 'listProjectContracts')
    .mockImplementation(() =>
      contratos === 'cargando' ? new Promise(() => {}) : Promise.resolve(contratos)
    )
}

describe('/developer/project/$projectId/contracts', () => {
  afterEach(() => vi.restoreAllMocks())

  it('mientras carga no hay tarjetas ni el vacío definitivo, y falta el contexto del proyecto', async () => {
    preparar('cargando', false)
    montar()

    const lista = await screen.findByTestId('DEV-CONTRACTS-LIST-001')
    expect(within(lista).queryByRole('article')).toBeNull()
    expect(screen.queryByText(t['developer.contracts.empty'])).toBeNull()
    expect(screen.queryByText('Torre Alpine')).toBeNull()
  })

  it('sin contratos: mensaje de vacío, nombre del proyecto como contexto', async () => {
    preparar([])
    montar()

    await screen.findByText(t['developer.contracts.empty'])
    await screen.findByText('Torre Alpine')
  })

  it('contrato firmado y anclado: fecha de firma, badge anclado y chip del TXID', async () => {
    const pedir = preparar([contrato()])
    montar()

    const lista = await screen.findByTestId('DEV-CONTRACTS-LIST-001')
    await waitFor(() => expect(lista.textContent).toContain('Ana Inversora'))
    expect(pedir).toHaveBeenCalledWith('p1')
    expect(lista.textContent).toContain('Torre A · 4B')
    expect(lista.textContent).toContain(t['developer.contracts.anchoredBadge'])
    expect(lista.textContent).not.toContain(t['developer.contracts.unsigned'])
    expect(lista.textContent).toContain(t['unitStatus.sold'])
    expect(within(lista).getByRole('button', { name: new RegExp(t['hash.copy']) })).toBeTruthy()
  })

  it('contrato sin firmar y sin TXID: "sin firmar", pendiente y sin chip (regla 17)', async () => {
    preparar([contrato({ signedAt: null, txid: null, unitStatus: 'reserved' })])
    montar()

    const lista = await screen.findByTestId('DEV-CONTRACTS-LIST-001')
    await waitFor(() => expect(lista.textContent).toContain(t['developer.contracts.unsigned']))
    expect(lista.textContent).toContain(t['developer.contracts.pendingBadge'])
    expect(lista.textContent).not.toContain(t['developer.contracts.anchoredBadge'])
    expect(within(lista).queryByRole('button', { name: new RegExp(t['hash.copy']) })).toBeNull()
  })

  it('el botón de volver lleva al detalle del proyecto', async () => {
    preparar([])
    const router = montar()
    await screen.findByText(t['developer.contracts.empty'])

    fireEvent.click(screen.getByRole('button', { name: t['nav.back'] }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/developer/project/p1'))
  })
})
