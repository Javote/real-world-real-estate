import { queryOptions } from '@tanstack/react-query'
import { api } from '../port'
import { CON_ANCLAJE, SIN_ANCLAJE } from './frescura'

export const contratoQueries = {
  deUnidad: (unitId: string) =>
    queryOptions({
      queryKey: ['contrato', 'unidad', unitId],
      queryFn: () => api.getInvestorContract(unitId),
      ...SIN_ANCLAJE
    }),
  liberaciones: (contractId: string) =>
    queryOptions({
      queryKey: ['contrato', contractId, 'liberaciones'],
      queryFn: () => api.listContractReleases(contractId),
      ...CON_ANCLAJE
    })
}
