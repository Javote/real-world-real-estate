import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { useMarcarLeida } from './notificaciones'

const LISTA = ['notifications', null]
const CONTADOR = ['notifications', 'unread-count']

const notif = (id: string, readAt: Date | null = null) => ({
  id,
  category: 'stage',
  titleKey: 'x',
  params: {},
  unitId: null,
  readAt,
  createdAt: new Date('2026-09-01T00:00:00.000Z')
})

function preparar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(LISTA, [notif('a'), notif('b')])
  queryClient.setQueryData(CONTADOR, { unread: 2 })
  // Una lista que todavía no llegó: no hay qué marcar.
  void queryClient.prefetchQuery({
    queryKey: ['notifications', 'stage'],
    queryFn: () => new Promise(() => {})
  })
  // Ningún refresco contesta: lo que se ve es lo que escribió el hook.
  vi.spyOn(api, 'listNotifications').mockReturnValue(new Promise(() => {}))
  vi.spyOn(api, 'getUnreadCount').mockReturnValue(new Promise(() => {}))
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useMarcarLeida(), { wrapper })
  return { queryClient, marcar: result.current }
}

const leidas = (queryClient: QueryClient) =>
  queryClient
    .getQueryData<ReturnType<typeof notif>[]>(LISTA)
    ?.filter((n) => n.readAt !== null)
    .map((n) => n.id)

describe('useMarcarLeida', () => {
  afterEach(() => vi.restoreAllMocks())

  it('marca leída y baja la campana antes de que conteste la API', async () => {
    vi.spyOn(api, 'markNotificationRead').mockReturnValue(new Promise(() => {}))
    const { queryClient, marcar } = preparar()

    act(() => marcar('a'))

    await waitFor(() => expect(leidas(queryClient)).toEqual(['a']))
    expect(queryClient.getQueryData(CONTADOR)).toEqual({ unread: 1 })
    expect(queryClient.getQueryData(['notifications', 'stage'])).toBeUndefined()
  })

  it('la campana no baja de cero', async () => {
    vi.spyOn(api, 'markNotificationRead').mockReturnValue(new Promise(() => {}))
    const { queryClient, marcar } = preparar()
    queryClient.setQueryData(CONTADOR, { unread: 0 })

    act(() => marcar('a'))

    await waitFor(() => expect(leidas(queryClient)).toEqual(['a']))
    expect(queryClient.getQueryData(CONTADOR)).toEqual({ unread: 0 })
  })

  it('si la API falla, vuelve la lista y la campana de antes', async () => {
    const llamada = vi.spyOn(api, 'markNotificationRead').mockRejectedValue(new Error('caída'))
    const { queryClient, marcar } = preparar()

    act(() => marcar('a'))

    await waitFor(() => expect(llamada).toHaveBeenCalledWith('a'))
    await waitFor(() => expect(queryClient.getQueryData(CONTADOR)).toEqual({ unread: 2 }))
    expect(leidas(queryClient)).toEqual([])
  })
})
