import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, INVESTOR_USER, montarRuta } from './-test-mount'
import { Route } from './investor.unit.$unitId.notifications'

const t = dictionary['es-AR']

type Notificacion = Awaited<ReturnType<typeof api.listNotifications>>[number]

const notif = (over: Partial<Record<keyof Notificacion, unknown>> = {}): Notificacion =>
  ({
    id: 'n1',
    category: 'stage',
    titleKey: 'investor.news.STAGE_CREATED',
    params: {},
    unitId: 'u1',
    readAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...over
  }) as unknown as Notificacion

const montar = () =>
  montarRuta(
    Route.options.component as () => React.ReactElement,
    '/investor/unit/$unitId/notifications',
    ['/investor/unit/$unitId'],
    '/investor/unit/u1/notifications'
  )

function preparar(lista: Notificacion[] | 'cargando') {
  autenticarComo(INVESTOR_USER)
  vi.spyOn(api, 'getInvestorUnit').mockResolvedValue({
    unitReference: 'Torre A · 4B'
  } as unknown as Awaited<ReturnType<typeof api.getInvestorUnit>>)
  return vi
    .spyOn(api, 'listNotifications')
    .mockImplementation(() =>
      lista === 'cargando' ? new Promise(() => {}) : Promise.resolve(lista)
    )
}

describe('/investor/unit/$unitId/notifications', () => {
  afterEach(() => vi.restoreAllMocks())

  it('mientras carga no muestra el vacío', async () => {
    preparar('cargando')
    montar()

    await screen.findByTestId('INV-NOTIF-UNIT-001')
    expect(screen.queryByText(t['investor.notifications.empty'])).toBeNull()
  })

  it('sin novedades muestra el vacío', async () => {
    preparar([])
    montar()

    await screen.findByText(t['investor.notifications.empty'])
  })

  it('el contexto del header lleva la referencia de la unidad', async () => {
    preparar([])
    montar()

    await screen.findByText(
      t['investor.unit.notificationsContext'].replace('{unit}', 'Torre A · 4B')
    )
  })

  it('INV-NOTIF-READ-002: solo la primera sin leer lleva el test ID, y la leída no es un botón', async () => {
    preparar([
      notif({ id: 'leida', readAt: '2026-09-02T00:00:00.000Z' }),
      notif({ id: 'a' }),
      notif({ id: 'b' })
    ])
    montar()

    const marcada = await screen.findByTestId('INV-NOTIF-READ-002')
    expect(screen.getAllByTestId('INV-NOTIF-READ-002')).toHaveLength(1)
    expect(marcada.tagName).toBe('BUTTON')
    const texto = new RegExp(t['investor.news.STAGE_CREATED'])
    expect(screen.getAllByRole('button', { name: texto })).toHaveLength(2)
    expect(screen.getByRole('img', { name: t['investor.notifications.read'] })).toBeTruthy()
  })

  it('abrir una novedad sin leer la marca como leída', async () => {
    preparar([notif({ id: 'a' })])
    const marcar = vi.spyOn(api, 'markNotificationRead').mockResolvedValue(undefined as never)
    montar()

    fireEvent.click(await screen.findByTestId('INV-NOTIF-READ-002'))

    await waitFor(() => expect(marcar).toHaveBeenCalledWith('a'))
  })

  it('un titleKey fuera del diccionario se muestra tal cual', async () => {
    preparar([notif({ titleKey: 'clave.que.no.existe' })])
    montar()

    await screen.findByText('clave.que.no.existe')
  })

  it('el filtro por categoría pide esa categoría y pinta el borde; "Todos" la saca', async () => {
    const listar = preparar([notif()])
    montar()
    await screen.findByTestId('INV-NOTIF-READ-002')
    expect(listar).toHaveBeenLastCalledWith({ unitId: 'u1' })

    fireEvent.click(screen.getByRole('button', { name: t['audit.category.firma'] }))
    await waitFor(() =>
      expect(listar).toHaveBeenLastCalledWith({ unitId: 'u1', category: 'signature' })
    )
    await waitFor(() =>
      expect(screen.getByTestId('INV-NOTIF-READ-002').className).toContain('border-l-4')
    )

    fireEvent.click(screen.getByRole('button', { name: t['developer.audit.all'] }))
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith({ unitId: 'u1' }))
  })

  it('las cinco categorías de la lista se dibujan, y sus chips filtran', async () => {
    const listar = preparar([
      notif({ id: '1', category: 'stage' }),
      notif({ id: '2', category: 'document' }),
      notif({ id: '3', category: 'release' }),
      notif({ id: '4', category: 'signature' }),
      notif({ id: '5', category: 'certificate' })
    ])
    montar()
    await screen.findByTestId('INV-NOTIF-READ-002')
    expect(screen.getAllByRole('button', { name: /Etapa creada/ })).toHaveLength(5)

    for (const [chip, categoria] of [
      ['etapa', 'stage'],
      ['documento', 'document'],
      ['liberacion', 'release'],
      ['certificador', 'certificate']
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: t[`audit.category.${chip}`] }))
      await waitFor(() =>
        expect(listar).toHaveBeenLastCalledWith({ unitId: 'u1', category: categoria })
      )
    }
  })

  it('el botón de volver navega al detalle de la unidad', async () => {
    preparar([])
    const router = montar()

    fireEvent.click(await screen.findByRole('button', { name: t['investor.unit.back'] }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/investor/unit/u1'))
  })
})
