import type { Notification, UnreadCount } from '@plataforma/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '#/api/port'
import { optimista } from '#/lib/optimista'

const CLAVE = ['notificacion'] as const

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

// La encuesta NPS (SPEC-503) lleva a su pantalla; el resto solo se marca leída, y una leída no abre nada.
export function useAbrirNotificacion() {
  const marcarLeida = useMarcarLeida()
  const navigate = useNavigate()

  return (n: Pick<Notification, 'id' | 'readAt' | 'params'>) => {
    const token = n.params.surveyToken
    if (typeof token === 'string') {
      return () => {
        if (n.readAt === null) marcarLeida(n.id)
        void navigate({ to: '/survey/$token', params: { token } })
      }
    }
    return n.readAt === null ? () => marcarLeida(n.id) : undefined
  }
}
