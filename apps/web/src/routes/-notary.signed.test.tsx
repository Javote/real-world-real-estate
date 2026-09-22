import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { autenticarComo, montarRuta, NOTARY_USER } from './-test-mount'
import { Route } from './notary.signed'

describe('/notary/signed', () => {
  afterEach(() => vi.restoreAllMocks())

  it('NOT-SIGNED-LIST-001: vacío muestra el estado vacío, no la lista', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'listSignatures').mockResolvedValue({ items: [], nextCursor: null })

    montarRuta(Route.options.component as () => React.ReactElement, '/notary/signed')

    const seccion = await screen.findByTestId('NOT-SIGNED-LIST-001')
    await vi.waitFor(() => expect(seccion.querySelector('ul')).toBeNull())
  })

  it('firmado: dos hashes por fila (masterHash + signatureTxid) y StatusPill "signed"', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'listSignatures').mockResolvedValue({
      items: [
        {
          dossierId: 'd1',
          unitReference: 'Torre A · 4B',
          projectName: 'Torre A',
          masterHash: 'a'.repeat(64),
          signatureTxid: 'b'.repeat(64),
          signedAt: new Date('2026-09-01T00:00:00Z'),
          status: 'signed'
        }
      ],
      nextCursor: null
    })

    montarRuta(Route.options.component as () => React.ReactElement, '/notary/signed')

    const seccion = await screen.findByTestId('NOT-SIGNED-LIST-001')
    await vi.waitFor(() => expect(seccion.textContent).toContain('Torre A'))
    expect(seccion.textContent).toContain('aaaa')
    expect(seccion.textContent).toContain('bbbb')
  })

  it('sin firmar (signatureTxid null): StatusPill "pending" y un solo HashChip', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'listSignatures').mockResolvedValue({
      items: [
        {
          dossierId: 'd2',
          unitReference: 'Torre A · 5C',
          projectName: 'Torre A',
          masterHash: 'c'.repeat(64),
          signatureTxid: null,
          signedAt: null,
          status: 'compiled'
        }
      ],
      nextCursor: null
    })

    montarRuta(Route.options.component as () => React.ReactElement, '/notary/signed')

    const seccion = await screen.findByTestId('NOT-SIGNED-LIST-001')
    await vi.waitFor(() => expect(seccion.textContent).toContain('5C'))
    expect(seccion.textContent).toContain('cccc')
  })
})
