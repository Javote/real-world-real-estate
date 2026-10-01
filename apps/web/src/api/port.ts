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
  Dossier,
  DossierShare,
  GeocodeResult,
  InvestorDirectoryEntry,
  InviteCertifierInput,
  LoginRequest,
  NotaryKpis,
  NotarySignature,
  NotificationQuery,
  ObserveStageInput,
  PendingDossier,
  Profile,
  ProjectListQuery,
  RejectDossierInput,
  StageTransitionInput,
  UnreadCount,
  UpdateNotificationPrefsInput,
  UpdateProfileInput,
  UpdateUnitInput
} from '@plataforma/shared'
import { clearSession, getSession } from '../auth/session'
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
  PublicDossier,
  Stage,
  StageEvidenceAnchor,
  StageState,
  UserSummary
} from './types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown
  ) {
    super(message)
  }
}

const API_BASE = import.meta.env.VITE_API_ORIGIN ?? ''

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = getSession()
  const headers = new Headers(init.headers)
  if (session) headers.set('Authorization', `Bearer ${session.token}`)

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })

  if (res.status === 401) clearSession()
  if (!res.ok) {
    let message = res.statusText
    let cuerpo: unknown
    try {
      const body = await res.json()
      cuerpo = body
      message = body?.message ?? JSON.stringify(body)
    } catch {}
    throw new ApiError(res.status, message, cuerpo)
  }
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
  getNotaryKpis: () => request<NotaryKpis>('/api/v1/notary/kpis'),
  getNotaryPendingDossiers: () => request<PendingDossier[]>('/api/v1/notary/dossiers/pending'),

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

  getUnitDossier: (id: string) => request<Dossier>(`/api/v1/investor/units/${id}/dossier`),

  exportUnitDossier: (id: string): Promise<Blob> =>
    requestBlob(`/api/v1/investor/units/${id}/dossier/export.pdf`),

  shareUnitDossier: (id: string) =>
    request<DossierShare>(`/api/v1/investor/units/${id}/dossier/share`, jsonInit('POST', {})),

  getPublicDossier: (shareToken: string) =>
    request<PublicDossier>(`/api/v1/public/dossier/${shareToken}`),

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

  getDossier: (dossierId: string) => request<Dossier>(`/api/v1/notary/dossiers/${dossierId}`),

  signDossier: (dossierId: string) =>
    request<{ dossierId: string; masterHash: string; anchor: { txid: string | null } }>(
      `/api/v1/notary/dossiers/${dossierId}/sign`,
      jsonInit('POST', {})
    ),

  rejectDossier: (dossierId: string, note: string) =>
    request<{ dossierId: string; status: string }>(
      `/api/v1/notary/dossiers/${dossierId}/reject`,
      jsonInit<RejectDossierInput>('POST', { note })
    ),

  listSignatures: (cursor?: string) =>
    request<Paginated<NotarySignature>>(
      `/api/v1/notary/signatures${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
    ),

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
