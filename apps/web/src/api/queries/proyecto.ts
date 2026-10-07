import type { ProjectListQuery } from '@plataforma/shared'
import { queryOptions } from '@tanstack/react-query'
import { api } from '../port'
import { CON_ANCLAJE, SIN_ANCLAJE } from './frescura'

export const proyectoQueries = {
  lista: (params?: ProjectListQuery) =>
    queryOptions({
      queryKey: ['proyecto', 'lista', params ?? {}],
      queryFn: () => api.listProjects(params),
      ...SIN_ANCLAJE
    }),
  delDeveloper: () =>
    queryOptions({
      queryKey: ['proyecto', 'lista', 'developer'],
      queryFn: () => api.listDeveloperProjects(),
      ...SIN_ANCLAJE
    }),
  detalle: (id: string) =>
    queryOptions({
      queryKey: ['proyecto', id],
      queryFn: () => api.getProject(id),
      ...CON_ANCLAJE
    }),
  detalleDelDeveloper: (id: string) =>
    queryOptions({
      queryKey: ['proyecto', id, 'developer'],
      queryFn: () => api.getDeveloperProject(id),
      ...SIN_ANCLAJE
    }),
  desarrolladora: (id: string) =>
    queryOptions({
      queryKey: ['proyecto', id, 'desarrolladora'],
      queryFn: () => api.getProjectDeveloper(id),
      ...SIN_ANCLAJE
    }),
  documentos: (id: string) =>
    queryOptions({
      queryKey: ['proyecto', id, 'documentos'],
      queryFn: () => api.listProjectDocuments(id),
      ...CON_ANCLAJE
    }),
  etapas: (id: string) =>
    queryOptions({
      queryKey: ['proyecto', id, 'etapas'],
      queryFn: () => api.listProjectStages(id),
      ...CON_ANCLAJE
    }),
  esquema: (id: string) =>
    queryOptions({
      queryKey: ['proyecto', id, 'esquema'],
      queryFn: () => api.getBuildingSchematic(id),
      ...SIN_ANCLAJE
    }),
  unidades: (id: string) =>
    queryOptions({
      queryKey: ['proyecto', id, 'unidades'],
      queryFn: () => api.listProjectUnits(id),
      ...SIN_ANCLAJE
    }),
  contratos: (id: string) =>
    queryOptions({
      queryKey: ['proyecto', id, 'contratos'],
      queryFn: () => api.listProjectContracts(id),
      ...CON_ANCLAJE
    })
}
