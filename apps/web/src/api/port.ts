import type {
  AnchorDocumentInput,
  Notification as AppNotification,
  AuditLogQuery,
  CapitalByProject,
  CapitalMonthlyPoint,
  CapitalSummary,
  CertifierAssignment,
  CertifierCertificate,
  CertifierKpis,
  CertifierStageView,
  CreateDeveloperProjectInput,
  CreateInvitationInput,
  CreateUnitInput,
  DeveloperDocument,
  DeveloperDocumentListQuery,
  DeveloperKpis,
  GeocodeResult,
  InvestorDirectoryEntry,
  InviteCertifierInput,
  LoginRequest,
  NotificationQuery,
  ObserveStageInput,
  PilotMetricsReport,
  Profile,
  ProjectListQuery,
  RespondNpsSurveyInput,
  StageTransitionInput,
  UnreadCount,
  UpdateNotificationPrefsInput,
  UpdateProfileInput,
  UpdateUnitInput
} from '@plataforma/shared'
import type { ApiClient } from '@plataforma/shared/contract'
import { clearSession, getSession } from '../auth/session'
import { API_BASE, ApiError, fetchConSesion } from './transporte'
import type {
  AuditEvent,
  BuildingSchematicFloor,
  BundleFiles,
  CertifierInvitation,
  ContractRelease,
  DeveloperContract,
  DeveloperProfile,
  DeveloperProject,
  DeveloperProjectDetail,
  DeveloperProjectUnit,
  DeveloperUnit,
  InvestorContract,
  InvestorInvitation,
  InvestorUnit,
  InvestorUnitDetail,
  InvestorUnitNews,
  Invitation,
  InvitationAcceptResult,
  LoginResponse,
  MeResponse,
  MerkleProof,
  ProgressRow,
  Project,
  ProjectCover,
  ProjectCreated,
  ProjectDetail,
  ProjectDocument,
  ProjectStageDetail,
  Stage,
  StageEvidenceAnchor,
  StageState,
  UserSummary
} from './types'

export { ApiError }

// El cliente del contrato baja la primera vez que una pantalla lo usa, no con el JS inicial.
let clientePendiente: Promise<ApiClient> | undefined
const elCliente = () => (clientePendiente ??= import('./cliente').then((m) => m.cliente))

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetchConSesion(`${API_BASE}${path}`, init)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

async function requestBlob(path: string): Promise<Blob> {
  const session = getSession()
  const res = await fetch(`${API_BASE}${path}`, {
    headers: session ? { Authorization: `Bearer ${session.token}` } : {}
  })
  if (res.status === 401) clearSession()
  if (!res.ok) throw new ApiError(res.status, res.statusText)
  return res.blob()
}

export function projectCoverUrl(projectId: string, coverUpdatedAt: string | null): string | null {
  if (!coverUpdatedAt) return null
  const v = new URLSearchParams({ v: coverUpdatedAt })
  return `${API_BASE}/api/v1/public/projects/${projectId}/cover?${v}`
}

export interface Paginated<T> {
  items: T[]
  nextCursor: string | null
}

function jsonInit<B>(method: string, body: B): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>(
      '/api/v1/auth/login',
      jsonInit<LoginRequest>('POST', { email, password })
    ),

  me: () => request<MeResponse>('/api/v1/auth/me'),

  listProjects: (params?: ProjectListQuery) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.q) q.set('q', params.q)
    if (params?.bbox) q.set('bbox', params.bbox)
    if (params?.sort) q.set('sort', params.sort)
    if (params?.city) q.set('city', params.city)
    const qs = q.toString()
    return request<Project[]>(`/api/v1/projects${qs ? `?${qs}` : ''}`)
  },

  getDeveloperKpis: () => request<DeveloperKpis>('/api/v1/developer/kpis'),
  getCertifierKpis: () => request<CertifierKpis>('/api/v1/certifier/kpis'),
  getCertifierAssignments: () => request<CertifierAssignment[]>('/api/v1/certifier/assignments'),
  getNotaryKpis: async () => (await elCliente()).dossier.notary.kpis(),
  getPilotMetrics: () => request<PilotMetricsReport>('/api/v1/admin/pilot-metrics'),
  getNotaryPendingDossiers: async () => (await elCliente()).dossier.notary.pendientes(),

  getProject: (id: string) => request<ProjectDetail>(`/api/v1/projects/${id}`),

  getProjectDeveloper: (id: string) =>
    request<DeveloperProfile>(`/api/v1/projects/${id}/developer`),

  setMilestoneState: (stageId: string, state: StageState) =>
    request<Stage>(
      `/api/v1/stages/${stageId}/state`,
      jsonInit<StageTransitionInput>('PATCH', { state })
    ),

  listDeveloperProjects: () => request<DeveloperProject[]>('/api/v1/developer/projects'),

  getDeveloperProject: (id: string) =>
    request<DeveloperProjectDetail>(`/api/v1/developer/projects/${id}`),

  uploadStageEvidence: (projectId: string, stageId: string, form: FormData) =>
    request<StageEvidenceAnchor>(
      `/api/v1/developer/projects/${projectId}/stages/${stageId}/evidence`,
      { method: 'POST', body: form }
    ),

  listAuditLog: (params?: Pick<AuditLogQuery, 'category' | 'cursor'>) => {
    const q = new URLSearchParams()
    if (params?.category) q.set('category', params.category)
    if (params?.cursor) q.set('cursor', params.cursor)
    const qs = q.toString()
    return request<Paginated<AuditEvent>>(`/api/v1/developer/audit-log${qs ? `?${qs}` : ''}`)
  },

  listDeveloperUnits: () => request<DeveloperUnit[]>('/api/v1/developer/units'),

  listProjectUnits: (projectId: string) =>
    request<DeveloperProjectUnit[]>(`/api/v1/developer/projects/${projectId}/units`),

  createProjectUnit: (projectId: string, unidad: CreateUnitInput) =>
    request<DeveloperProjectUnit>(
      `/api/v1/developer/projects/${projectId}/units`,
      jsonInit<CreateUnitInput>('POST', unidad)
    ),

  updateUnit: (unitId: string, cambios: UpdateUnitInput) =>
    request<DeveloperProjectUnit>(
      `/api/v1/developer/units/${unitId}`,
      jsonInit<UpdateUnitInput>('PATCH', cambios)
    ),

  listProjectContracts: (projectId: string) =>
    request<DeveloperContract[]>(`/api/v1/developer/projects/${projectId}/contracts`),

  createInvitation: (projectId: string, invitacion: CreateInvitationInput) =>
    request<Invitation>(
      `/api/v1/developer/projects/${projectId}/invitations`,
      jsonInit<CreateInvitationInput>('POST', invitacion)
    ),

  getDeveloperProgress: () => request<ProgressRow[]>('/api/v1/developer/progress'),

  listInvestors: () => request<InvestorDirectoryEntry[]>('/api/v1/developer/investors'),

  getCapitalSummary: () => request<CapitalSummary>('/api/v1/developer/capital/summary'),

  getCapitalMonthly: () => request<CapitalMonthlyPoint[]>('/api/v1/developer/capital/monthly'),

  getCapitalByProject: () => request<CapitalByProject[]>('/api/v1/developer/capital/by-project'),

  geocodeAddress: (q: string) =>
    request<GeocodeResult>(`/api/v1/developer/geocode?${new URLSearchParams({ q })}`),

  createProject: (proyecto: CreateDeveloperProjectInput) =>
    request<ProjectCreated>(
      '/api/v1/developer/projects',
      jsonInit<CreateDeveloperProjectInput>('POST', proyecto)
    ),

  uploadProjectCover: (projectId: string, archivo: File) => {
    const form = new FormData()
    form.append('file', archivo)
    return request<ProjectCover>(`/api/v1/developer/projects/${projectId}/cover`, {
      method: 'PUT',
      body: form
    })
  },

  listDeveloperDocuments: (status?: DeveloperDocumentListQuery['status']) => {
    const qs = status ? `?status=${status}` : ''
    return request<DeveloperDocument[]>(`/api/v1/developer/documents${qs}`)
  },

  anchorDocument: (evidenceId: string) =>
    request<StageEvidenceAnchor>(
      '/api/v1/developer/documents',
      jsonInit<AnchorDocumentInput>('POST', { evidenceId })
    ),

  listInvestorUnits: () => request<InvestorUnit[]>('/api/v1/investor/units'),

  listProjectDocuments: (id: string) =>
    request<ProjectDocument[]>(`/api/v1/projects/${id}/documents`),

  listProjectStages: (id: string) => request<Stage[]>(`/api/v1/projects/${id}/stages`),

  getProjectStage: (id: string, stageId: string) =>
    request<ProjectStageDetail>(`/api/v1/projects/${id}/stages/${stageId}`),

  getBuildingSchematic: (id: string) =>
    request<BuildingSchematicFloor[]>(`/api/v1/projects/${id}/building-schematic`),

  listFavorites: () => request<Project[]>('/api/v1/investor/favorites'),

  addFavorite: (projectId: string) =>
    request<void>(`/api/v1/investor/favorites/${projectId}`, { method: 'POST' }),

  removeFavorite: (projectId: string) =>
    request<void>(`/api/v1/investor/favorites/${projectId}`, { method: 'DELETE' }),

  getInvestorUnit: (id: string) => request<InvestorUnitDetail>(`/api/v1/investor/units/${id}`),

  getInvestorUnitNews: (id: string) =>
    request<InvestorUnitNews[]>(`/api/v1/investor/units/${id}/news`),

  getInvestorContract: (unitId: string) =>
    request<InvestorContract>(`/api/v1/investor/contracts/${unitId}`),

  listContractReleases: (contractId: string) =>
    request<ContractRelease[]>(`/api/v1/contracts/${contractId}/releases`),

  getUnitDossier: async (id: string) => (await elCliente()).dossier.investor.dossier({ id }),

  exportUnitDossier: (id: string): Promise<Blob> =>
    requestBlob(`/api/v1/investor/units/${id}/dossier/export.pdf`),

  shareUnitDossier: async (id: string) => (await elCliente()).dossier.investor.compartir({ id }),

  getPublicDossier: async (shareToken: string) =>
    (await elCliente()).dossier.publico.dossier({ shareToken }),

  respondNpsSurvey: (token: string, respuesta: RespondNpsSurveyInput) =>
    request<void>(
      `/api/v1/investor/surveys/${token}/respond`,
      jsonInit<RespondNpsSurveyInput>('POST', respuesta)
    ),

  getBundleFiles: (bundleId: string) => request<BundleFiles>(`/api/v1/evidence/${bundleId}/files`),

  getMerkleProof: (bundleId: string, fileHash: string) =>
    request<MerkleProof>(`/api/v1/evidence/${bundleId}/proof/${fileHash}`),

  getInvitation: (id: string) => request<InvestorInvitation>(`/api/v1/investor/invitations/${id}`),

  acceptInvitation: (id: string) =>
    request<InvitationAcceptResult>(
      `/api/v1/investor/invitations/${id}/accept`,
      jsonInit('POST', {})
    ),

  declineInvitation: (id: string) =>
    request<void>(`/api/v1/investor/invitations/${id}/decline`, { method: 'POST' }),

  listNotifications: (params?: NotificationQuery) => {
    const q = new URLSearchParams()
    if (params?.unitId) q.set('unitId', params.unitId)
    if (params?.category) q.set('category', params.category)
    const qs = q.toString()
    return request<AppNotification[]>(`/api/v1/investor/notifications${qs ? `?${qs}` : ''}`)
  },

  markNotificationRead: (id: string) =>
    request<void>(`/api/v1/notifications/${id}/read`, { method: 'PATCH' }),

  getUnreadCount: () => request<UnreadCount>('/api/v1/notifications/unread-count'),

  getCertifierStage: (stageId: string) =>
    request<CertifierStageView>(`/api/v1/certifier/stages/${stageId}`),

  certifyStage: (stageId: string) =>
    request<{ anchor: { txid: string | null; status: string } }>(
      `/api/v1/certifier/stages/${stageId}/certify`,
      jsonInit('POST', {})
    ),

  observeStage: (stageId: string, note: string) =>
    request<{ anchor: { txid: string | null; status: string } }>(
      `/api/v1/certifier/stages/${stageId}/observe`,
      jsonInit<ObserveStageInput>('POST', { note })
    ),

  listCertificates: (cursor?: string) =>
    request<Paginated<CertifierCertificate>>(
      `/api/v1/certifier/certificates${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
    ),

  listUsers: () => request<UserSummary[]>('/api/v1/users'),

  listProjectCertifierInvitations: (projectId: string) =>
    request<CertifierInvitation[]>(`/api/v1/projects/${projectId}/certifier-invitations`),

  inviteCertifier: (projectId: string, certifierId: string) =>
    request<CertifierInvitation>(
      `/api/v1/projects/${projectId}/certifier-invitations`,
      jsonInit<InviteCertifierInput>('POST', { certifierId })
    ),

  getMyCertifierInvitations: () => request<CertifierInvitation[]>('/api/v1/certifier/invitations'),

  acceptCertifierInvitation: (id: string) =>
    request<CertifierInvitation>(
      `/api/v1/certifier/invitations/${id}/accept`,
      jsonInit('POST', {})
    ),

  declineCertifierInvitation: (id: string) =>
    request<CertifierInvitation>(
      `/api/v1/certifier/invitations/${id}/decline`,
      jsonInit('POST', {})
    ),

  getDossier: async (dossierId: string) =>
    (await elCliente()).dossier.notary.porId({ id: dossierId }),

  signDossier: async (dossierId: string) =>
    (await (await elCliente()).dossier.notary.firmar({ id: dossierId })).body,

  rejectDossier: async (dossierId: string, note: string) =>
    (await elCliente()).dossier.notary.rechazar({ id: dossierId, note }),

  listSignatures: async (cursor?: string) => (await elCliente()).dossier.notary.firmas({ cursor }),

  getProfile: () => request<Profile>('/api/v1/profile'),

  updateProfile: (fullName: string) =>
    request<Profile>('/api/v1/profile', jsonInit<UpdateProfileInput>('PATCH', { fullName })),

  updateNotificationPrefs: (prefs: UpdateNotificationPrefsInput) =>
    request<Profile>(
      '/api/v1/profile/notifications',
      jsonInit<UpdateNotificationPrefsInput>('PATCH', prefs)
    ),

  downloadEvidence: (evidenceId: string): Promise<Blob> =>
    requestBlob(`/api/v1/evidence/${evidenceId}/download`)
}
