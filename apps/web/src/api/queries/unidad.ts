import { queryOptions } from '@tanstack/react-query'
import { api } from '../port'
import { CON_ANCLAJE, SIN_ANCLAJE } from './frescura'

export const unidadQueries = {
  delInvestor: () =>
    queryOptions({
      queryKey: ['unidad', 'lista', 'investor'],
      queryFn: () => api.listInvestorUnits(),
      ...SIN_ANCLAJE
    }),
  delDeveloper: () =>
    queryOptions({
      queryKey: ['unidad', 'lista', 'developer'],
      queryFn: () => api.listDeveloperUnits(),
      ...SIN_ANCLAJE
    }),
  detalle: (id: string) =>
    queryOptions({
      queryKey: ['unidad', id],
      queryFn: () => api.getInvestorUnit(id),
      ...CON_ANCLAJE
    }),
  novedades: (id: string) =>
    queryOptions({
      queryKey: ['unidad', id, 'novedades'],
      queryFn: () => api.getInvestorUnitNews(id),
      ...CON_ANCLAJE
    })
}
