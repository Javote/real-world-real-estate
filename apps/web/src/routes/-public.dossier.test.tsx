import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '#/api/port'
import { esAR } from '#/i18n/dictionary'
import { fabrica } from '#/test/fabrica'
import { montarRuta } from './-test-mount'
import { Route } from './public.dossier.$shareToken'

const t = esAR

const HASH_ARTEFACTO = 'b'.repeat(64)

const dossier = (over: Parameters<typeof fabrica.dossierPublico>[0] = {}) =>
  fabrica.dossierPublico({
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
  })

const montar = () => montarRuta(Route, '/public/dossier/$shareToken', [], '/public/dossier/tok-123')

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

    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toBe(t['investor.public.notFound'])
    expect(aviso.closest('main')?.dataset.testid).toBe('INV-DOSSIER-PUBLIC-002')
  })

  it('mientras carga, solo la carga: ni el dossier ni el aviso de no disponible', async () => {
    vi.spyOn(api, 'getPublicDossier').mockReturnValue(new Promise(() => {}))
    montar()

    const main = await screen.findByTestId('INV-DOSSIER-PUBLIC-002')
    expect(within(main).getByRole('status')).toBeTruthy()
    expect(main.textContent).not.toContain(t['investor.public.notFound'])
  })

  it('otro error (no 404) dice que algo salió mal, no que el dossier no está disponible', async () => {
    vi.spyOn(api, 'getPublicDossier').mockRejectedValue(new ApiError(500, 'boom'))
    montar()

    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toBe(t['error.generic'])
    expect(aviso.closest('main')?.dataset.testid).toBe('INV-DOSSIER-PUBLIC-002')
  })
})
