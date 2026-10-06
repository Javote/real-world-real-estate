import type { Notification, UnreadCount } from '@plataforma/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '#/api/port'
import { optimista } from '#/lib/optimista'

const CLAVE = ['notifications'] as const

// Marca leída en todas las listas cacheadas y baja el contador de la campana sin esperar a la API.
export function useMarcarLeida() {
  const queryClient = useQueryClient()

  const marcar = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    ...optimista(queryClient, CLAVE, (id: string) => {
      const ahora = new Date()
      queryClient.setQueriesData<Notification[] | UnreadCount>({ queryKey: CLAVE }, (datos) => {
        if (Array.isArray(datos)) {
          return datos.map((n) => (n.id === id && n.readAt === null ? { ...n, readAt: ahora } : n))
        }
        return datos && { unread: Math.max(0, datos.unread - 1) }
      })
    })
  })

  return (id: string) => marcar.mutate(id)
}
