import { queryOptions } from '@tanstack/react-query'
import { api } from '../port'
import { SIN_ANCLAJE } from './frescura'

export const invitacionQueries = {
  deInvestor: (id: string) =>
    queryOptions({
      queryKey: ['invitacion', 'investor', id],
      queryFn: () => api.getInvitation(id),
      ...SIN_ANCLAJE
    }),
  delCertificador: () =>
    queryOptions({
      queryKey: ['invitacion', 'certificador', 'mias'],
      queryFn: () => api.getMyCertifierInvitations(),
      ...SIN_ANCLAJE
    }),
  aCertificadoresDelProyecto: (projectId: string) =>
    queryOptions({
      queryKey: ['invitacion', 'certificador', 'proyecto', projectId],
      queryFn: () => api.listProjectCertifierInvitations(projectId),
      ...SIN_ANCLAJE
    })
}
