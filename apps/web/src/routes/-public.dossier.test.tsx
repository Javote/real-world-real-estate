import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '#/api/port'
import { dictionary } from '#/i18n/dictionary'
import { montarRuta } from './-test-mount'
import { Route } from './public.dossier.$shareToken'

const t = dictionary['es-AR']

type Dossier = Awaited<ReturnType<typeof api.getPublicDossier>>

const HASH = 'a'.repeat(64)
const HASH_ARTEFACTO = 'b'.repeat(64)

const dossier = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    unitReference: 'Unidad 4B',
    projectName: 'Torre Norte',
    masterHash: HASH,
    compiledAt: '2026-05-10T12:00:00.000Z',
    status: 'signed',
    completeness: 80,
    signatureTxid: 'tx-firma-1',
    signedAt: '2026-05-11T12:00:00.000Z',
    artifacts: [
      {
        kind: 'evidence',
        referenceId: 'e1',
        label: 'Plano general',
        sha256: HASH_ARTEFACTO,
        txid: null
      },
      { kind: 'stage', referenceId: 's1', label: 'Etapa sin hash', sha256: null, txid: null }
    ],
    ...over
  }) as unknown as Dossier

const montar = () =>
  montarRuta(
    Route.options.component as () => React.ReactElement,
    '/public/dossier/$shareToken',
    [],
    '/public/dossier/tok-123'
  )

describe('/public/dossier/:shareToken (sin sesión)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('INV-DOSSIER-PUBLIC-002: pide el dossier con el token de la URL y lo muestra firmado', async () => {
    const pedir = vi.spyOn(api, 'getPublicDossier').mockResolvedValue(dossier())
    montar()

    const main = await screen.findByTestId('INV-DOSSIER-PUBLIC-002')
    await waitFor(() => expect(main.textContent).toContain('Torre Norte · Unidad 4B'))
    expect(pedir).toHaveBeenCalledWith('tok-123')
    expect(main.textContent).toContain(t['status.signed'])
    expect(main.textContent).toContain('Plano general')
    expect(main.textContent).toContain('Etapa sin hash')
    expect(main.textContent).toContain(t['investor.dossier.certificationBody'])
  })

  it('sin TXID de firma muestra "Pendiente", nunca "Firmado" (regla 17)', async () => {
    vi.spyOn(api, 'getPublicDossier').mockResolvedValue(
      dossier({ signatureTxid: null, signedAt: null, artifacts: [] })
    )
    montar()

    const main = await screen.findByTestId('INV-DOSSIER-PUBLIC-002')
    await waitFor(() => expect(main.textContent).toContain(t['status.pending']))
    expect(main.textContent).not.toContain(t['status.signed'])
  })

  it('un 404 (token vencido o inválido) muestra que el dossier no está disponible', async () => {
    vi.spyOn(api, 'getPublicDossier').mockRejectedValue(new ApiError(404, 'no existe'))
    montar()

    await screen.findByText(t['investor.public.notFound'])
  })

  it('mientras carga no muestra ni el dossier ni el aviso de no disponible', async () => {
    vi.spyOn(api, 'getPublicDossier').mockReturnValue(new Promise(() => {}))
    montar()

    const main = await screen.findByTestId('INV-DOSSIER-PUBLIC-002')
    expect(main.textContent).toBe('')
  })

  it('otro error (no 404) no muestra el aviso de no disponible', async () => {
    vi.spyOn(api, 'getPublicDossier').mockRejectedValue(new ApiError(500, 'boom'))
    montar()

    const main = await screen.findByTestId('INV-DOSSIER-PUBLIC-002')
    await waitFor(() => expect(api.getPublicDossier).toHaveBeenCalled())
    expect(main.textContent).not.toContain(t['investor.public.notFound'])
  })
})
