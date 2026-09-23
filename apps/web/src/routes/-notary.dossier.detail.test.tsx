import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { autenticarComo, montarRuta, NOTARY_USER } from './-test-mount'
import { Route } from './notary.dossier.$dossierId'

function unDossier() {
  return {
    id: 'd1',
    unitId: 'u1',
    unitReference: 'Torre A · 4B',
    projectId: 'p1',
    projectName: 'Torre A',
    masterHash: 'a'.repeat(64),
    compiledAt: new Date('2026-09-01T00:00:00Z'),
    status: 'compiled' as const,
    artifacts: [
      {
        kind: 'stage' as const,
        referenceId: 's1',
        label: 'Cimentación',
        sha256: 'd'.repeat(64),
        txid: null
      }
    ],
    completeness: 40,
    signatureTxid: null,
    signedAt: null,
    rejectionNote: null
  }
}

describe('/notary/dossier/$dossierId', () => {
  afterEach(() => vi.restoreAllMocks())

  it('NOT-DOSSIER-VIEW-001: pendiente de firma — muestra las acciones de firmar y rechazar', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getDossier').mockResolvedValue(unDossier())

    montarRuta(
      Route.options.component as () => React.ReactElement,
      '/notary/dossier/$dossierId',
      ['/notary'],
      '/notary/dossier/d1'
    )

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
      signedAt: new Date('2026-09-02T00:00:00Z')
    })

    montarRuta(
      Route.options.component as () => React.ReactElement,
      '/notary/dossier/$dossierId',
      ['/notary'],
      '/notary/dossier/d1'
    )

    await screen.findByText('Torre A · 4B')
    expect(screen.queryByTestId('NOT-DOSSIER-SIGN-001')).toBeNull()
    expect(screen.queryByTestId('NOT-DOSSIER-REJECT-001')).toBeNull()
  })

  it('NOT-DOSSIER-SIGN-001: firmar llama a api.signDossier y navega de vuelta al panel', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getDossier').mockResolvedValue(unDossier())
    const firmar = vi.spyOn(api, 'signDossier').mockResolvedValue(undefined as never)

    montarRuta(
      Route.options.component as () => React.ReactElement,
      '/notary/dossier/$dossierId',
      ['/notary'],
      '/notary/dossier/d1'
    )

    await screen.findByText('Torre A · 4B')
    await userEvent.click(screen.getByTestId('NOT-DOSSIER-SIGN-001'))

    expect(firmar).toHaveBeenCalledWith('d1')
    await screen.findByText('/notary')
  })

  it('NOT-DOSSIER-REJECT-001: abre el modal de observación y manda la nota a api.rejectDossier', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getDossier').mockResolvedValue(unDossier())
    const rechazar = vi.spyOn(api, 'rejectDossier').mockResolvedValue(undefined as never)

    montarRuta(
      Route.options.component as () => React.ReactElement,
      '/notary/dossier/$dossierId',
      ['/notary'],
      '/notary/dossier/d1'
    )

    await screen.findByText('Torre A · 4B')
    await userEvent.click(screen.getByTestId('NOT-DOSSIER-REJECT-001'))

    const nota = await screen.findByLabelText(/observaciones/i)
    // `delay: null` — SPEC-019 §Paso 0, punto 5: bajo carga, 23 caracteres
    // tecla por tecla pasan el `testTimeout`.
    await userEvent.type(nota, 'Falta el plano firmado', { delay: null })
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }))

    expect(rechazar).toHaveBeenCalledWith('d1', 'Falta el plano firmado')
    await screen.findByText('/notary')
  })

  it('sin artifacts: muestra el estado vacío en vez de una lista vacía', async () => {
    autenticarComo(NOTARY_USER)
    vi.spyOn(api, 'getDossier').mockResolvedValue({ ...unDossier(), artifacts: [] })

    montarRuta(
      Route.options.component as () => React.ReactElement,
      '/notary/dossier/$dossierId',
      ['/notary'],
      '/notary/dossier/d1'
    )

    await screen.findByText('Torre A · 4B')
    expect(screen.queryByText('Cimentación')).toBeNull()
  })
})
