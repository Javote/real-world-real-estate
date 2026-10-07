import { queryOptions } from '@tanstack/react-query'
import { api } from '../port'
import { CON_ANCLAJE } from './frescura'

export const certificadoQueries = {
  lista: () =>
    queryOptions({
      queryKey: ['certificado', 'lista'],
      queryFn: () => api.listCertificates(),
      ...CON_ANCLAJE
    })
}
