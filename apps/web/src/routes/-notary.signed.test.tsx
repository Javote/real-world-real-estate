import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '#/api/port'
import { esAR } from '#/i18n/dictionary'
import { fabrica } from '#/test/fabrica'
import { autenticarComo, montarRuta, NOTARY_USER } from './-test-mount'
import { Route } from './notary.signed'

const montar = () => montarRuta(Route, '/notary/signed')

describe('/notary/signed', () => {
  afterEach(() => vi.restoreAllMocks())

  it('NOT-SIGNED-LIST-001: vacío muestra el estado vacío, no la lista', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'listSignatures').mockResolvedValue({ items: [], nextCursor: null })
    montar()

    const seccion = await screen.findByTestId('NOT-SIGNED-LIST-001')
    await within(seccion).findByText(esAR['notary.signed.empty'])
    expect(seccion.querySelector('ul')).toBeNull()
  })

  it('firmado: dos hashes por fila (masterHash + signatureTxid) y StatusPill "signed"', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'listSignatures').mockResolvedValue({
      items: [
        fabrica.firma({
          signatureTxid: 'b'.repeat(64),
          signedAt: '2026-09-01T00:00:00.000Z',
          status: 'signed'
        })
      ],
      nextCursor: null
    })
    montar()

    const seccion = await screen.findByTestId('NOT-SIGNED-LIST-001')
    await vi.waitFor(() => expect(seccion.textContent).toContain('Torre A'))
    expect(seccion.textContent).toContain('aaaa')
    expect(seccion.textContent).toContain('bbbb')
    expect(seccion.textContent).toContain(esAR['status.signed'])
  })

  it('sin firmar (signatureTxid null): StatusPill "pending" y un solo HashChip', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'listSignatures').mockResolvedValue({
      items: [fabrica.firma({ dossierId: 'd2', unitReference: 'Torre A · 5C' })],
      nextCursor: null
    })
    montar()

    const seccion = await screen.findByTestId('NOT-SIGNED-LIST-001')
    await vi.waitFor(() => expect(seccion.textContent).toContain('5C'))
    expect(seccion.textContent).toContain(esAR['status.pending'])
  })

  it('si la lista falla, el error y nunca el estado vacío', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'listSignatures').mockRejectedValue(new ApiError(500, 'caído'))
    montar()

    expect((await screen.findByRole('alert')).textContent).toBe(esAR['error.generic'])
    expect(screen.queryByText(esAR['notary.signed.empty'])).toBeNull()
  })

  it('mientras carga, la carga dentro de la sección y ni la lista ni el vacío', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'listSignatures').mockReturnValue(new Promise(() => {}))
    montar()

    const seccion = await screen.findByTestId('NOT-SIGNED-LIST-001')
    expect(within(seccion).getByRole('status')).toBeTruthy()
    expect(screen.queryByText(esAR['notary.signed.empty'])).toBeNull()
  })
})
