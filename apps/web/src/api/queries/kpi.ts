import { queryOptions } from '@tanstack/react-query'
import { api } from '../port'
import { CON_ANCLAJE, SIN_ANCLAJE } from './frescura'

export const kpiQueries = {
  // `verifiedDocuments` cuenta anclajes confirmados.
  developer: () =>
    queryOptions({
      queryKey: ['kpi', 'developer'],
      queryFn: () => api.getDeveloperKpis(),
      ...CON_ANCLAJE
    }),
  certificador: () =>
    queryOptions({
      queryKey: ['kpi', 'certificador'],
      queryFn: () => api.getCertifierKpis(),
      ...SIN_ANCLAJE
    }),
  // `verified` y `signed` cuentan firmas ancladas.
  notary: () =>
    queryOptions({
      queryKey: ['kpi', 'notary'],
      queryFn: () => api.getNotaryKpis(),
      ...CON_ANCLAJE
    })
}
