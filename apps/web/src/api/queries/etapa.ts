import { queryOptions } from '@tanstack/react-query'
import { api } from '../port'
import { CON_ANCLAJE, SIN_ANCLAJE } from './frescura'

export const etapaQueries = {
  detalle: (projectId: string, stageId: string) =>
    queryOptions({
      queryKey: ['etapa', stageId, 'proyecto', projectId],
      queryFn: () => api.getProjectStage(projectId, stageId),
      ...CON_ANCLAJE
    }),
  delCertificador: (stageId: string) =>
    queryOptions({
      queryKey: ['etapa', stageId, 'certificador'],
      queryFn: () => api.getCertifierStage(stageId),
      ...SIN_ANCLAJE
    }),
  progreso: () =>
    queryOptions({
      queryKey: ['etapa', 'progreso'],
      queryFn: () => api.getDeveloperProgress(),
      ...SIN_ANCLAJE
    }),
  asignadas: () =>
    queryOptions({
      queryKey: ['etapa', 'asignadas'],
      queryFn: () => api.getCertifierAssignments(),
      ...SIN_ANCLAJE
    })
}
