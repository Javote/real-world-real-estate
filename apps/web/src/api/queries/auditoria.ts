import { queryOptions } from '@tanstack/react-query'
import { api } from '../port'
import { CON_ANCLAJE } from './frescura'

export const auditoriaQueries = {
  lista: () =>
    queryOptions({
      queryKey: ['auditoria', 'lista'],
      queryFn: () => api.listAuditLog(),
      ...CON_ANCLAJE
    })
}
