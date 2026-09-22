import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { autenticarComo, CERTIFIER_USER, montarRuta } from './-test-mount'
import { Route } from './certifier.index'

function montarPanel() {
  return montarRuta(Route.options.component as () => React.ReactElement, '/certifier/')
}

describe('/certifier (panel)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('CER-PANEL-001 con datos, sin invitaciones pendientes: no se dibuja CER-INVITATIONS-003', async () => {
    autenticarComo(CERTIFIER_USER)
    vi.spyOn(api, 'getCertifierKpis').mockResolvedValue({
      assigned: 4,
      certified: 9,
      observed: 1,
      totalStages: 14
    })
    vi.spyOn(api, 'getCertifierAssignments').mockResolvedValue([])
    vi.spyOn(api, 'getMyCertifierInvitations').mockResolvedValue([])

    montarPanel()

    const panel = await screen.findByTestId('CER-PANEL-001')
    await vi.waitFor(() => expect(panel.textContent).toContain('4'))
    expect(panel.textContent).toContain('9')
    expect(panel.textContent).toContain('1')
    expect(panel.textContent).toContain('14')
    await screen.findByTestId('CER-ASSIGNMENTS-002')
    expect(screen.queryByTestId('CER-INVITATIONS-003')).toBeNull()
  })

  it('CER-INVITATIONS-003: con una invitación pendiente, aceptar la manda a api.acceptCertifierInvitation', async () => {
    autenticarComo(CERTIFIER_USER)
    vi.spyOn(api, 'getCertifierKpis').mockResolvedValue({
      assigned: 0,
      certified: 0,
      observed: 0,
      totalStages: 0
    })
    vi.spyOn(api, 'getCertifierAssignments').mockResolvedValue([])
    vi.spyOn(api, 'getMyCertifierInvitations').mockResolvedValue([
      {
        id: 'i1',
        projectId: 'p1',
        projectName: 'Torre A',
        certifierId: CERTIFIER_USER.id,
        certifierName: CERTIFIER_USER.fullName,
        status: 'pending',
        createdAt: '2026-09-01T00:00:00.000Z',
        respondedAt: null
      }
    ])
    const aceptar = vi.spyOn(api, 'acceptCertifierInvitation').mockResolvedValue({
      id: 'i1',
      projectId: 'p1',
      projectName: 'Torre A',
      certifierId: CERTIFIER_USER.id,
      certifierName: CERTIFIER_USER.fullName,
      status: 'accepted',
      createdAt: '2026-09-01T00:00:00.000Z',
      respondedAt: '2026-09-02T00:00:00.000Z'
    })

    montarPanel()

    const invitaciones = await screen.findByTestId('CER-INVITATIONS-003')
    expect(invitaciones.textContent).toContain('Torre A')

    const botones = invitaciones.querySelectorAll('button')
    await userEvent.click(botones[0] as HTMLButtonElement)

    expect(aceptar).toHaveBeenCalledWith('i1')
  })

  it('CER-INVITATIONS-003: rechazar la manda a api.declineCertifierInvitation', async () => {
    autenticarComo(CERTIFIER_USER)
    vi.spyOn(api, 'getCertifierKpis').mockResolvedValue({
      assigned: 0,
      certified: 0,
      observed: 0,
      totalStages: 0
    })
    vi.spyOn(api, 'getCertifierAssignments').mockResolvedValue([])
    vi.spyOn(api, 'getMyCertifierInvitations').mockResolvedValue([
      {
        id: 'i1',
        projectId: 'p1',
        projectName: 'Torre A',
        certifierId: CERTIFIER_USER.id,
        certifierName: CERTIFIER_USER.fullName,
        status: 'pending',
        createdAt: '2026-09-01T00:00:00.000Z',
        respondedAt: null
      }
    ])
    const rechazar = vi.spyOn(api, 'declineCertifierInvitation').mockResolvedValue({
      id: 'i1',
      projectId: 'p1',
      projectName: 'Torre A',
      certifierId: CERTIFIER_USER.id,
      certifierName: CERTIFIER_USER.fullName,
      status: 'declined',
      createdAt: '2026-09-01T00:00:00.000Z',
      respondedAt: '2026-09-02T00:00:00.000Z'
    })

    montarPanel()

    const invitaciones = await screen.findByTestId('CER-INVITATIONS-003')
    const botones = invitaciones.querySelectorAll('button')
    await userEvent.click(botones[1] as HTMLButtonElement)

    expect(rechazar).toHaveBeenCalledWith('i1')
  })

  it('CER-INVITATIONS-003: un error al responder muestra el mensaje con role="alert"', async () => {
    autenticarComo(CERTIFIER_USER)
    vi.spyOn(api, 'getCertifierKpis').mockResolvedValue({
      assigned: 0,
      certified: 0,
      observed: 0,
      totalStages: 0
    })
    vi.spyOn(api, 'getCertifierAssignments').mockResolvedValue([])
    vi.spyOn(api, 'getMyCertifierInvitations').mockResolvedValue([
      {
        id: 'i1',
        projectId: 'p1',
        projectName: 'Torre A',
        certifierId: CERTIFIER_USER.id,
        certifierName: CERTIFIER_USER.fullName,
        status: 'pending',
        createdAt: '2026-09-01T00:00:00.000Z',
        respondedAt: null
      }
    ])
    vi.spyOn(api, 'acceptCertifierInvitation').mockRejectedValue(new Error('falló'))

    montarPanel()

    const invitaciones = await screen.findByTestId('CER-INVITATIONS-003')
    const botones = invitaciones.querySelectorAll('button')
    await userEvent.click(botones[0] as HTMLButtonElement)

    await screen.findByRole('alert')
  })
})
