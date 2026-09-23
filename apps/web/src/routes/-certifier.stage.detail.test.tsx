import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { autenticarComo, CERTIFIER_USER, montarRuta } from './-test-mount'
import { Route } from './certifier.stage.$stageId'

function unStage(overrides: Partial<Awaited<ReturnType<typeof api.getCertifierStage>>> = {}) {
  return {
    id: 's1',
    name: 'Cimentación',
    sequenceOrder: 1,
    state: 'InProgress' as const,
    validationCritical: true,
    projectId: 'p1',
    projectName: 'Torre A',
    evidence: [
      {
        id: 'e1',
        originalFilename: 'plano.pdf',
        category: 'plan',
        authoritative: true,
        sha256Hash: 'a'.repeat(64),
        uploadedAt: new Date('2026-09-01T00:00:00Z')
      }
    ],
    ...overrides
  }
}

function montarStage() {
  return montarRuta(
    Route.options.component as () => React.ReactElement,
    '/certifier/stage/$stageId',
    ['/certifier'],
    '/certifier/stage/s1'
  )
}

describe('/certifier/stage/$stageId', () => {
  afterEach(() => vi.restoreAllMocks())

  it('CER-STAGE-VIEW-001: con evidencia, muestra el documento y habilita Certify', async () => {
    autenticarComo(CERTIFIER_USER)
    vi.spyOn(api, 'getCertifierStage').mockResolvedValue(unStage())

    montarStage()

    await screen.findByText('plano.pdf')
    const certificar = screen.getByTestId('CER-CERTIFY-001') as HTMLButtonElement
    expect(certificar.disabled).toBe(false)
  })

  it('sin evidencia: Certify queda deshabilitado y se ve el empty-state, no el botón escondido', async () => {
    autenticarComo(CERTIFIER_USER)
    vi.spyOn(api, 'getCertifierStage').mockResolvedValue(unStage({ evidence: [] }))

    montarStage()

    await screen.findByText('Todavía no hay evidencia anclada para esta etapa.')
    expect((screen.getByTestId('CER-CERTIFY-001') as HTMLButtonElement).disabled).toBe(true)
  })

  it('etapa ya certificada (Completed): la barra de acciones desaparece', async () => {
    autenticarComo(CERTIFIER_USER)
    vi.spyOn(api, 'getCertifierStage').mockResolvedValue(unStage({ state: 'Completed' }))

    montarStage()

    await screen.findByText('plano.pdf')
    expect(screen.queryByTestId('CER-CERTIFY-001')).toBeNull()
  })

  it('CER-CERTIFY-001: certificar llama a api.certifyStage y navega de vuelta al panel', async () => {
    autenticarComo(CERTIFIER_USER)
    vi.spyOn(api, 'getCertifierStage').mockResolvedValue(unStage())
    const certificar = vi
      .spyOn(api, 'certifyStage')
      .mockResolvedValue({ anchor: { txid: 'b'.repeat(64), status: 'Confirmed' } })

    montarStage()

    await screen.findByText('plano.pdf')
    await userEvent.click(screen.getByTestId('CER-CERTIFY-001'))

    expect(certificar).toHaveBeenCalledWith('s1')
    await screen.findByText('/certifier')
  })

  it('un error al certificar muestra el mensaje de error de la pantalla', async () => {
    autenticarComo(CERTIFIER_USER)
    vi.spyOn(api, 'getCertifierStage').mockResolvedValue(unStage())
    vi.spyOn(api, 'certifyStage').mockRejectedValue(new Error('falló'))

    montarStage()

    await screen.findByText('plano.pdf')
    await userEvent.click(screen.getByTestId('CER-CERTIFY-001'))

    await screen.findByText('No se pudo certificar. Revisá el estado de la etapa.')
  })

  it('CER-OBSERVE-001: observar abre el modal y manda la nota a api.observeStage', async () => {
    autenticarComo(CERTIFIER_USER)
    vi.spyOn(api, 'getCertifierStage').mockResolvedValue(unStage())
    const observar = vi
      .spyOn(api, 'observeStage')
      .mockResolvedValue({ anchor: { txid: null, status: 'Pending' } })

    montarStage()

    await screen.findByText('plano.pdf')
    await userEvent.click(screen.getByRole('button', { name: 'Observar' }))

    const nota = await screen.findByLabelText(/observaciones/i)
    // `delay: null` — SPEC-019 §Paso 0, punto 5: bajo carga, 30 caracteres
    // tecla por tecla pasan el `testTimeout`.
    await userEvent.type(nota, 'Falta la certificación de obra', { delay: null })
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }))

    expect(observar).toHaveBeenCalledWith('s1', 'Falta la certificación de obra')
    await screen.findByText('/certifier')
  })
  it('cancelar el modal de observación lo cierra sin observar', async () => {
    autenticarComo(CERTIFIER_USER)
    vi.spyOn(api, 'getCertifierStage').mockResolvedValue(unStage())
    const observar = vi.spyOn(api, 'observeStage')

    montarStage()

    await screen.findByText('plano.pdf')
    await userEvent.click(screen.getByRole('button', { name: 'Observar' }))
    await screen.findByLabelText(/observaciones/i)
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    await vi.waitFor(() => expect(screen.queryByLabelText(/observaciones/i)).toBeNull())
    expect(observar).not.toHaveBeenCalled()
  })

  it('mientras certifica, el botón dice "Certificando…"', async () => {
    autenticarComo(CERTIFIER_USER)
    vi.spyOn(api, 'getCertifierStage').mockResolvedValue(unStage())
    vi.spyOn(api, 'certifyStage').mockReturnValue(new Promise(() => {}))

    montarStage()

    await screen.findByText('plano.pdf')
    await userEvent.click(screen.getByTestId('CER-CERTIFY-001'))

    await screen.findByText('Certificando…')
  })
})
