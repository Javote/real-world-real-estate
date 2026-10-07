import { queryOptions } from '@tanstack/react-query'
import { api } from '../port'
import { CON_ANCLAJE, SIN_ANCLAJE } from './frescura'

export const dossierQueries = {
  deUnidad: (unitId: string) =>
    queryOptions({
      queryKey: ['dossier', 'unidad', unitId],
      queryFn: () => api.getUnitDossier(unitId),
      ...CON_ANCLAJE
    }),
  detalle: (dossierId: string) =>
    queryOptions({
      queryKey: ['dossier', dossierId],
      queryFn: () => api.getDossier(dossierId),
      ...CON_ANCLAJE
    }),
  publico: (shareToken: string) =>
    queryOptions({
      queryKey: ['dossier', 'publico', shareToken],
      queryFn: () => api.getPublicDossier(shareToken),
      ...CON_ANCLAJE
    }),
  pendientes: () =>
    queryOptions({
      queryKey: ['dossier', 'pendientes'],
      queryFn: () => api.getNotaryPendingDossiers(),
      ...SIN_ANCLAJE
    }),
  firmas: () =>
    queryOptions({
      queryKey: ['dossier', 'firmas'],
      queryFn: () => api.listSignatures(),
      ...CON_ANCLAJE
    })
}
