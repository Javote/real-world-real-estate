import { queryOptions } from '@tanstack/react-query'
import { api } from '../port'
import { SIN_ANCLAJE } from './frescura'

export const capitalQueries = {
  resumen: () =>
    queryOptions({
      queryKey: ['capital', 'resumen'],
      queryFn: () => api.getCapitalSummary(),
      ...SIN_ANCLAJE
    }),
  mensual: () =>
    queryOptions({
      queryKey: ['capital', 'mensual'],
      queryFn: () => api.getCapitalMonthly(),
      ...SIN_ANCLAJE
    }),
  porProyecto: () =>
    queryOptions({
      queryKey: ['capital', 'por-proyecto'],
      queryFn: () => api.getCapitalByProject(),
      ...SIN_ANCLAJE
    })
}
