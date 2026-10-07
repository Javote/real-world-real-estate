import { queryOptions } from '@tanstack/react-query'
import { api } from '../port'
import { CON_ANCLAJE } from './frescura'

export const evidenciaQueries = {
  delBundle: (bundleId: string) =>
    queryOptions({
      queryKey: ['evidencia', 'bundle', bundleId],
      queryFn: () => api.getBundleFiles(bundleId),
      ...CON_ANCLAJE
    }),
  delDeveloper: () =>
    queryOptions({
      queryKey: ['evidencia', 'developer'],
      queryFn: () => api.listDeveloperDocuments(),
      ...CON_ANCLAJE
    })
}

// Los binarios viven aparte: ninguna invalidación los toca, y la URL que devuelven la revoca la
// pantalla que la creó (`useObjectUrls`), así que no sobreviven a desmontarla.
export const archivoQueries = {
  url: (evidenceId: string, aUrl: (blob: Blob) => string) =>
    queryOptions({
      queryKey: ['archivo', evidenceId],
      queryFn: async () => aUrl(await api.downloadEvidence(evidenceId)),
      staleTime: 0,
      gcTime: 0
    }),
  fotosDeEtapa: (stageId: string, ids: string[], aUrl: (blob: Blob) => string) =>
    queryOptions({
      queryKey: ['archivo', 'etapa', stageId, ids.join(',')],
      queryFn: async () => {
        const pares = await Promise.all(
          ids.map(async (id) => ({ id, url: aUrl(await api.downloadEvidence(id)) }))
        )
        return Object.fromEntries(pares.map((p) => [p.id, p.url])) as Record<string, string>
      },
      staleTime: 0,
      gcTime: 0
    })
}
