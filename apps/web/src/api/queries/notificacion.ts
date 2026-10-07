import type { NotificationQuery } from '@plataforma/shared'
import { queryOptions } from '@tanstack/react-query'
import { api } from '../port'
import { SIN_ANCLAJE } from './frescura'

type Categoria = NonNullable<NotificationQuery['category']>

export const notificacionQueries = {
  lista: (categoria: Categoria | null) =>
    queryOptions({
      queryKey: ['notificacion', 'lista', categoria],
      queryFn: () => api.listNotifications(categoria ? { category: categoria } : undefined),
      ...SIN_ANCLAJE
    }),
  deUnidad: (unitId: string, categoria: Categoria | null) =>
    queryOptions({
      queryKey: ['notificacion', 'unidad', unitId, categoria],
      queryFn: () =>
        api.listNotifications({ unitId, ...(categoria ? { category: categoria } : {}) }),
      ...SIN_ANCLAJE
    }),
  noLeidas: () =>
    queryOptions({
      queryKey: ['notificacion', 'no-leidas'],
      queryFn: () => api.getUnreadCount(),
      ...SIN_ANCLAJE
    })
}
