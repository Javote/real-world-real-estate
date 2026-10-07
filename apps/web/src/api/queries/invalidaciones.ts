import type { QueryClient, QueryKey } from '@tanstack/react-query'

// Lo que deja viejo cada mutación, por entidad y no por rol. Cada llave invalida toda query cuya
// llave empieza con ella: `['proyecto', id]` alcanza a sus documentos, etapas y unidades.
export const invalidaciones = {
  unidadGuardada: (projectId: string): QueryKey[] => [
    ['unidad'],
    ['proyecto', projectId],
    ['proyecto', 'lista'],
    ['kpi']
  ],
  evidenciaSubida: (projectId: string, stageId: string): QueryKey[] => [
    ['evidencia'],
    ['etapa', stageId],
    ['etapa', 'progreso'],
    ['proyecto', projectId],
    ['proyecto', 'lista'],
    ['kpi'],
    ['auditoria']
  ],
  documentoAnclado: (): QueryKey[] => [['evidencia'], ['proyecto'], ['kpi'], ['auditoria']],
  etapaCambiada: (): QueryKey[] => [
    ['etapa'],
    ['proyecto'],
    ['certificado'],
    ['kpi'],
    ['auditoria']
  ],
  invitacionDeCertificadorRespondida: (): QueryKey[] => [
    ['invitacion', 'certificador'],
    ['etapa', 'asignadas'],
    ['kpi']
  ],
  certificadorInvitado: (projectId: string): QueryKey[] => [
    ['invitacion', 'certificador', 'proyecto', projectId]
  ],
  dossierResuelto: (): QueryKey[] => [['dossier'], ['kpi']],
  invitacionDeInvestorAceptada: (): QueryKey[] => [
    ['invitacion', 'investor'],
    ['unidad'],
    ['contrato'],
    ['dossier', 'unidad'],
    ['proyecto']
  ],
  invitacionDeInvestorRechazada: (): QueryKey[] => [['invitacion', 'investor']],
  inversorInvitado: (projectId: string): QueryKey[] => [
    ['proyecto', projectId],
    ['proyecto', 'lista'],
    ['unidad'],
    ['usuario', 'inversores'],
    ['kpi']
  ],
  proyectoCreado: (): QueryKey[] => [['proyecto', 'lista'], ['unidad'], ['kpi'], ['capital']],
  perfilGuardado: (): QueryKey[] => [['usuario', 'perfil']]
}

export function invalidar(queryClient: QueryClient, llaves: QueryKey[]) {
  for (const queryKey of llaves) void queryClient.invalidateQueries({ queryKey })
}
