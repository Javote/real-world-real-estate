import { queryOptions } from '@tanstack/react-query'
import { api } from '../port'
import { SIN_ANCLAJE } from './frescura'

export const favoritoQueries = {
  lista: () =>
    queryOptions({
      queryKey: ['favorito', 'lista'],
      queryFn: () => api.listFavorites(),
      ...SIN_ANCLAJE
    })
}
