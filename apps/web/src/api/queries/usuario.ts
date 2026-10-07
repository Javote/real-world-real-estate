import { queryOptions } from '@tanstack/react-query'
import { api } from '../port'
import { SIN_ANCLAJE } from './frescura'

export const usuarioQueries = {
  perfil: () =>
    queryOptions({
      queryKey: ['usuario', 'perfil'],
      queryFn: () => api.getProfile(),
      ...SIN_ANCLAJE
    }),
  lista: () =>
    queryOptions({
      queryKey: ['usuario', 'lista'],
      queryFn: () => api.listUsers(),
      ...SIN_ANCLAJE
    }),
  inversores: () =>
    queryOptions({
      queryKey: ['usuario', 'inversores'],
      queryFn: () => api.listInvestors(),
      ...SIN_ANCLAJE
    })
}
