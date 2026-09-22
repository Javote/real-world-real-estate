import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { autenticarComo, CERTIFIER_USER, montarRuta } from './-test-mount'
import { Route } from './certifier.issued'

describe('/certifier/issued', () => {
  afterEach(() => vi.restoreAllMocks())

  it('CER-ISSUED-LIST-001: vacío muestra el estado vacío, no la lista', async () => {
    autenticarComo(CERTIFIER_USER)
    vi.spyOn(api, 'listCertificates').mockResolvedValue({ items: [], nextCursor: null })

    montarRuta(Route.options.component as () => React.ReactElement, '/certifier/issued')

    const seccion = await screen.findByTestId('CER-ISSUED-LIST-001')
    await vi.waitFor(() => expect(seccion.querySelector('ul')).toBeNull())
  })

  it('con TXID: StatusPill "Certified" y dos HashChip (commitmentHash + txid)', async () => {
    autenticarComo(CERTIFIER_USER)
    vi.spyOn(api, 'listCertificates').mockResolvedValue({
      items: [
        {
          stageId: 's1',
          stageName: 'Cimentación',
          projectName: 'Torre A',
          certifiedAt: new Date('2026-09-01T00:00:00Z'),
          commitmentHash: 'a'.repeat(64),
          txid: 'b'.repeat(64),
          anchorStatus: 'Confirmed'
        }
      ],
      nextCursor: null
    })

    montarRuta(Route.options.component as () => React.ReactElement, '/certifier/issued')

    const seccion = await screen.findByTestId('CER-ISSUED-LIST-001')
    await vi.waitFor(() => expect(seccion.textContent).toContain('Torre A'))
    expect(seccion.textContent).toContain('aaaa')
    expect(seccion.textContent).toContain('bbbb')
  })

  it('sin TXID (regla 17): el estado sale del TXID, no de certifiedAt — "Pendiente" aunque haya fecha', async () => {
    autenticarComo(CERTIFIER_USER)
    vi.spyOn(api, 'listCertificates').mockResolvedValue({
      items: [
        {
          stageId: 's2',
          stageName: 'Estructura',
          projectName: 'Torre A',
          certifiedAt: new Date('2026-09-02T00:00:00Z'),
          commitmentHash: 'c'.repeat(64),
          txid: null,
          anchorStatus: null
        }
      ],
      nextCursor: null
    })

    montarRuta(Route.options.component as () => React.ReactElement, '/certifier/issued')

    const seccion = await screen.findByTestId('CER-ISSUED-LIST-001')
    await vi.waitFor(() => expect(seccion.textContent).toContain('Estructura'))
    expect(seccion.textContent).toContain('cccc')
  })
})
