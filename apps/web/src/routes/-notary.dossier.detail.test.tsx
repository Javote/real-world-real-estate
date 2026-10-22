import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '#/api/port'
import { esAR } from '#/i18n/dictionary'
import { fabrica } from '#/test/fabrica'
import { autenticarComo, montarRuta, NOTARY_USER } from './-test-mount'
import { Route } from './notary.dossier.$dossierId'

const ARTEFACTO = {
  kind: 'stage' as const,
  referenceId: 's1',
  label: 'Cimentación',
  sha256: 'd'.repeat(64),
  txid: null
}
const unDossier = () => fabrica.dossier({ artifacts: [ARTEFACTO] })

const montar = () =>
  montarRuta(Route, '/notary/dossier/$dossierId', ['/notary'], '/notary/dossier/d1')

describe('/notary/dossier/$dossierId', () => {
  afterEach(() => vi.restoreAllMocks())

  it('NOT-DOSSIER-VIEW-001: pendiente de firma — muestra las acciones de firmar y rechazar', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getDossier').mockResolvedValue(unDossier())

    montar()

    await screen.findByText('Torre A · 4B')
    expect(screen.getByTestId('NOT-DOSSIER-SIGN-001')).toBeTruthy()
    expect(screen.getByTestId('NOT-DOSSIER-REJECT-001')).toBeTruthy()
  })

  it('firmado: las acciones desaparecen (firmar es terminal, D-026)', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getDossier').mockResolvedValue({
      ...unDossier(),
      status: 'signed',
      signatureTxid: 'b'.repeat(64),
      signedAt: '2026-09-02T00:00:00.000Z'
    })

    montar()

    await screen.findByText('Torre A · 4B')
    expect(screen.queryByTestId('NOT-DOSSIER-SIGN-001')).toBeNull()
    expect(screen.queryByTestId('NOT-DOSSIER-REJECT-001')).toBeNull()
  })

  it('rechazado: sin acciones hasta que el dossier cambie y vuelva a la cola', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getDossier').mockResolvedValue({
      ...unDossier(),
      status: 'rejected',
      rejectionNote: 'falta el permiso municipal'
    })

    montar()

    await screen.findByText('Torre A · 4B')
    expect(screen.queryByTestId('NOT-DOSSIER-SIGN-001')).toBeNull()
    expect(screen.queryByTestId('NOT-DOSSIER-REJECT-001')).toBeNull()
  })

  it('NOT-DOSSIER-SIGN-001: firmar llama a api.signDossier y navega de vuelta al panel', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getDossier').mockResolvedValue(unDossier())
    const firmar = vi.spyOn(api, 'signDossier').mockResolvedValue(undefined as never)

    montar()

    await screen.findByText('Torre A · 4B')
    await userEvent.click(screen.getByTestId('NOT-DOSSIER-SIGN-001'))

    expect(firmar).toHaveBeenCalledWith('d1')
    await screen.findByText('/notary')
  })

  it('NOT-DOSSIER-REJECT-001: abre el modal de observación y manda la nota a api.rejectDossier', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getDossier').mockResolvedValue(unDossier())
    const rechazar = vi.spyOn(api, 'rejectDossier').mockResolvedValue(undefined as never)

    montar()

    await screen.findByText('Torre A · 4B')
    await userEvent.click(screen.getByTestId('NOT-DOSSIER-REJECT-001'))

    const nota = await screen.findByLabelText(/observaciones/i)
    await userEvent.type(nota, 'Falta el plano firmado', { delay: null })
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }))

    expect(rechazar).toHaveBeenCalledWith('d1', 'Falta el plano firmado')
    await screen.findByText('/notary')
  })

  it('sin artifacts: muestra el estado vacío en vez de una lista vacía', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getDossier').mockResolvedValue({ ...unDossier(), artifacts: [] })

    montar()

    await screen.findByText('Torre A · 4B')
    expect(screen.queryByText('Cimentación')).toBeNull()
  })
  it('cancelar el modal de rechazo lo cierra sin rechazar', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getDossier').mockResolvedValue(unDossier())
    const rechazar = vi.spyOn(api, 'rejectDossier')

    montar()

    await screen.findByText('Torre A · 4B')
    await userEvent.click(screen.getByTestId('NOT-DOSSIER-REJECT-001'))
    await screen.findByLabelText(/observaciones/i)
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    await vi.waitFor(() => expect(screen.queryByLabelText(/observaciones/i)).toBeNull())
    expect(rechazar).not.toHaveBeenCalled()
  })

  it('mientras firma, el botón dice "Firmando…"', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getDossier').mockResolvedValue(unDossier())
    vi.spyOn(api, 'signDossier').mockReturnValue(new Promise(() => {}))

    montar()

    await screen.findByText('Torre A · 4B')
    await userEvent.click(screen.getByTestId('NOT-DOSSIER-SIGN-001'))

    await screen.findByText('Firmando…')
  })

  it('un artifact sin sha256 se lista sin HashChip', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getDossier').mockResolvedValue({
      ...unDossier(),
      artifacts: [{ ...ARTEFACTO, sha256: null }]
    })

    montar()

    await screen.findByText('Cimentación')
    expect(screen.queryByText(/dddd/)).toBeNull()
  })
  it('mientras carga, el título y la carga dentro de la sección; nada del dossier', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getDossier').mockReturnValue(new Promise(() => {}))
    montar()

    const seccion = await screen.findByTestId('NOT-DOSSIER-VIEW-001')
    expect(within(seccion).getByRole('status')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Revisión de dossier' })).toBeTruthy()
    expect(screen.queryByTestId('NOT-DOSSIER-SIGN-001')).toBeNull()
  })

  it('un dossier que no existe (404) dice que no se encontró, sin acciones', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getDossier').mockRejectedValue(new ApiError(404, 'no'))
    montar()

    expect((await screen.findByRole('alert')).textContent).toBe(esAR['error.notFound'])
    expect(screen.queryByTestId('NOT-DOSSIER-SIGN-001')).toBeNull()
  })

  it('si la API falla, el error y no un dossier vacío', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getDossier').mockRejectedValue(new ApiError(403, 'no'))
    montar()

    expect((await screen.findByRole('alert')).textContent).toBe(esAR['error.forbidden'])
  })
})
