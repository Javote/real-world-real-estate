import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import type { InvestorInvitation } from '#/api/types'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, INVESTOR_USER, montarRuta } from './-test-mount'
import { Route } from './investor.notifications'

const t = (clave: keyof (typeof dictionary)['es-AR']) => dictionary['es-AR'][clave]

const ahora = new Date().toISOString()

const notificacion = (id: string, sobre: Record<string, unknown> = {}) =>
  ({
    id,
    category: 'stage',
    titleKey: 'notif.titulo.inexistente',
    params: {},
    unitId: null,
    readAt: null,
    createdAt: ahora,
    ...sobre
  }) as never

const invitacion = (sobre: Partial<InvestorInvitation> = {}): InvestorInvitation => ({
  id: 'inv-1',
  investorEmail: 'investor@example.com',
  amountMinorUnits: 5000000,
  currency: 'USD',
  status: 'pending',
  createdAt: ahora,
  unitReference: 'A-101',
  projectName: 'Torre A',
  ...sobre
})

const RUTAS_EXTRA = ['/investor/unit/$unitId']

describe('/investor/notifications', () => {
  afterEach(() => vi.restoreAllMocks())

  it('mientras carga muestra el estado de carga y no el vacío', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listNotifications').mockReturnValue(new Promise(() => {}))
    montarRuta(Route, '/investor/notifications')

    const lista = await screen.findByTestId('INV-NOTIF-LIST-001')
    expect(within(lista).getByRole('status')).toBeTruthy()
    expect(screen.queryByText(t('investor.notifications.empty'))).toBeNull()
  })

  it('sin invitación y sin notificaciones muestra el vacío', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listNotifications').mockResolvedValue([])
    montarRuta(Route, '/investor/notifications')

    await screen.findByText(t('investor.notifications.empty'))
  })

  it('con invitación y sin notificaciones no muestra el vacío: la card de la invitación ya ocupa la lista', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listNotifications').mockResolvedValue([])
    vi.spyOn(api, 'getInvitation').mockResolvedValue(invitacion())
    montarRuta(Route, '/investor/notifications', [], '/investor/notifications?invitation=inv-1')

    await screen.findByText(t('investor.invite.cta'))
    expect(screen.queryByText(t('investor.notifications.empty'))).toBeNull()
  })

  it('una notificación no leída marca como leída al abrirla; una leída no es un botón', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listNotifications').mockResolvedValue([
      notificacion('n-1', { titleKey: 'clave.no.leida' }),
      notificacion('n-2', { titleKey: 'clave.leida', readAt: ahora })
    ])
    const marcar = vi.spyOn(api, 'markNotificationRead').mockResolvedValue(undefined as never)
    montarRuta(Route, '/investor/notifications')

    const noLeida = await screen.findByText('clave.no.leida')
    const leida = screen.getByText('clave.leida')
    expect(noLeida.closest('button')).not.toBeNull()
    expect(leida.closest('button')).toBeNull()

    await userEvent.click(noLeida)
    await waitFor(() => expect(marcar).toHaveBeenCalledWith('n-1'))
    expect(marcar).toHaveBeenCalledTimes(1)
  })

  it('una clave de título que el diccionario conoce se muestra traducida', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listNotifications').mockResolvedValue([
      notificacion('n-1', { titleKey: 'investor.notifications.empty' })
    ])
    montarRuta(Route, '/investor/notifications')

    await screen.findByText(t('investor.notifications.empty'))
  })

  it('filtrar por categoría pide solo esa categoría; "Todas" vuelve a pedir sin filtro', async () => {
    autenticarComo(INVESTOR_USER)
    const listar = vi
      .spyOn(api, 'listNotifications')
      .mockResolvedValue([notificacion('n-1', { category: 'document', titleKey: 'clave.doc' })])
    montarRuta(Route, '/investor/notifications')
    await screen.findByText('clave.doc')
    expect(listar).toHaveBeenLastCalledWith(undefined)

    await userEvent.click(screen.getByRole('button', { name: t('audit.category.documento') }))
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith({ category: 'document' }))

    await userEvent.click(screen.getByRole('button', { name: t('developer.audit.all') }))
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith(undefined))
  })

  it('cada categoría del filtro se puede elegir', async () => {
    autenticarComo(INVESTOR_USER)
    const listar = vi
      .spyOn(api, 'listNotifications')
      .mockResolvedValue([
        notificacion('n-1', { category: 'certificate', titleKey: 'clave.cert' }),
        notificacion('n-2', { category: 'release', titleKey: 'clave.rel' }),
        notificacion('n-3', { category: 'signature', titleKey: 'clave.firma' })
      ])
    montarRuta(Route, '/investor/notifications')
    await screen.findByText('clave.cert')

    const categorias = [
      ['audit.category.etapa', 'stage'],
      ['audit.category.liberacion', 'release'],
      ['audit.category.firma', 'signature'],
      ['audit.category.certificador', 'certificate']
    ] as const
    for (const [clave, categoria] of categorias) {
      await userEvent.click(screen.getByRole('button', { name: t(clave) }))
      await waitFor(() => expect(listar).toHaveBeenLastCalledWith({ category: categoria }))
      await screen.findByText('clave.cert')
    }
  })

  it('un parámetro `invitation` vacío se descarta: no pide ninguna invitación', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listNotifications').mockResolvedValue([])
    const pedir = vi.spyOn(api, 'getInvitation')
    montarRuta(Route, '/investor/notifications', [], '/investor/notifications?invitation=')

    // Sin invitación válida, la lista vacía es lo que se ve.
    await screen.findByText(t('investor.notifications.empty'))
    expect(pedir).not.toHaveBeenCalled()
  })

  it('el parser de la URL conserva un `invitation` no vacío y descarta el vacío o el que no es texto', () => {
    const validar = Route.options.validateSearch as (raw: Record<string, unknown>) => unknown
    expect(validar({ invitation: 'inv-1' })).toEqual({ invitation: 'inv-1' })
    expect(validar({ invitation: '' })).toEqual({})
    expect(validar({ invitation: 7 })).toEqual({})
  })

  it('?invitation=<id>: aparece la InvitationCard pendiente y abrirla muestra el modal con los datos', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listNotifications').mockResolvedValue([])
    const pedir = vi.spyOn(api, 'getInvitation').mockResolvedValue(invitacion())
    montarRuta(Route, '/investor/notifications', [], '/investor/notifications?invitation=inv-1')

    await userEvent.click(await screen.findByText(t('investor.invite.cta')))

    expect(pedir).toHaveBeenCalledWith('inv-1')
    const modal = await screen.findByTestId('INV-INVITE-VIEW-001')
    expect(modal.textContent).toContain('Torre A')
    expect(modal.textContent).toContain('A-101')
    expect(within(modal).getByTestId('INV-INVITE-ACCEPT-002')).toBeTruthy()
  })

  it('INV-INVITE-ACCEPT-002: aceptar llama a acceptInvitation y navega a la unidad del contrato', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listNotifications').mockResolvedValue([])
    vi.spyOn(api, 'getInvitation').mockResolvedValue(invitacion())
    const aceptar = vi
      .spyOn(api, 'acceptInvitation')
      .mockResolvedValue({ contract: { unitId: 'un-7' }, anchor: {} } as never)
    const router = montarRuta(
      Route,
      '/investor/notifications',
      RUTAS_EXTRA,
      '/investor/notifications?invitation=inv-1'
    )

    await userEvent.click(await screen.findByText(t('investor.invite.cta')))
    await userEvent.click(await screen.findByTestId('INV-INVITE-ACCEPT-002'))

    expect(aceptar).toHaveBeenCalledWith('inv-1')
    await waitFor(() => expect(router.state.location.pathname).toBe('/investor/unit/un-7'))
  })

  it('mientras acepta, el botón muestra el texto de envío y queda deshabilitado', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listNotifications').mockResolvedValue([])
    vi.spyOn(api, 'getInvitation').mockResolvedValue(invitacion())
    vi.spyOn(api, 'acceptInvitation').mockReturnValue(new Promise(() => {}))
    montarRuta(Route, '/investor/notifications', [], '/investor/notifications?invitation=inv-1')

    await userEvent.click(await screen.findByText(t('investor.invite.cta')))
    await userEvent.click(await screen.findByTestId('INV-INVITE-ACCEPT-002'))

    const boton = await screen.findByRole('button', { name: t('investor.invite.submitting') })
    expect(boton).toHaveProperty('disabled', true)
  })

  it('INV-INVITE-DECLINE-003: rechazar llama a declineInvitation, cierra el modal y limpia la URL', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listNotifications').mockResolvedValue([])
    vi.spyOn(api, 'getInvitation').mockResolvedValue(invitacion())
    const rechazar = vi.spyOn(api, 'declineInvitation').mockResolvedValue(undefined as never)
    const router = montarRuta(
      Route,
      '/investor/notifications',
      [],
      '/investor/notifications?invitation=inv-1'
    )

    await userEvent.click(await screen.findByText(t('investor.invite.cta')))
    await userEvent.click(await screen.findByTestId('INV-INVITE-DECLINE-003'))

    expect(rechazar).toHaveBeenCalledWith('inv-1')
    await waitFor(() => expect(router.state.location.search).toEqual({}))
    await waitFor(() => expect(screen.queryByTestId('INV-INVITE-VIEW-001')).toBeNull())
  })

  it('una invitación ya resuelta no ofrece aceptar ni rechazar, y su card no muestra la llamada a la acción', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listNotifications').mockResolvedValue([])
    vi.spyOn(api, 'getInvitation').mockResolvedValue(invitacion({ status: 'accepted' }))
    montarRuta(Route, '/investor/notifications', [], '/investor/notifications?invitation=inv-1')

    const card = (await screen.findByText(t('investor.invite.title'))).closest(
      'button'
    ) as HTMLElement
    expect(within(card).queryByText(t('investor.invite.cta'))).toBeNull()
    await userEvent.click(card)

    await screen.findByText(t('investor.invite.resolved'))
    expect(screen.queryByTestId('INV-INVITE-ACCEPT-002')).toBeNull()
    expect(screen.queryByTestId('INV-INVITE-DECLINE-003')).toBeNull()
  })

  it('Escape cierra el modal de la invitación sin aceptar ni rechazar', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listNotifications').mockResolvedValue([])
    vi.spyOn(api, 'getInvitation').mockResolvedValue(invitacion())
    const aceptar = vi.spyOn(api, 'acceptInvitation')
    const rechazar = vi.spyOn(api, 'declineInvitation')
    montarRuta(Route, '/investor/notifications', [], '/investor/notifications?invitation=inv-1')

    await userEvent.click(await screen.findByText(t('investor.invite.cta')))
    await screen.findByTestId('INV-INVITE-VIEW-001')
    await userEvent.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByTestId('INV-INVITE-VIEW-001')).toBeNull())
    expect(aceptar).not.toHaveBeenCalled()
    expect(rechazar).not.toHaveBeenCalled()
  })
})
