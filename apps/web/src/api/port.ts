// ApiPort — ÚNICO lugar del front que hace fetch (prohibición de CLAUDE.md).
// Adaptador `real` contra apps/api. El adaptador `mock` está pendiente.

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
  InvestorDirectoryEntry,
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
  ContractRelease,
  DeveloperContract,
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
  ProjectCreated,
  ProjectDetail,
  ProjectDocument,
  ProjectStageDetail,
  PublicDossier,
  Stage,
  StageEvidenceAnchor,
  StageState
} from './types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}

// Origen de la API. Vacío en dev: el proxy de Vite manda `/api` a :8787 desde
// el mismo origen. En producción el web es estático y vive en otro origen, así
// que `VITE_API_ORIGIN` trae la URL absoluta (D-065) y la API la acepta por su
// lista blanca de CORS.
const API_BASE = import.meta.env.VITE_API_ORIGIN ?? ''

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = getSession()
  const headers = new Headers(init.headers)
  if (session) headers.set('Authorization', `Bearer ${session.token}`)

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })

  if (res.status === 401) clearSession()
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      message = body?.message ?? JSON.stringify(body)
    } catch {
      // cuerpo no-JSON: queda statusText
    }
    throw new ApiError(res.status, message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/**
 * GET de un archivo. Es el único camino binario y NO pasa por `request()`
 * (`request()` parsea JSON), pero tiene que hacer lo mismo que él: usar
 * `API_BASE` —en producción el web vive en otro origen— y limpiar la sesión
 * ante un 401. `downloadEvidence` hacía las dos mal: pegaba contra una URL
 * relativa (el sitio estático, no la API) y no limpiaba la sesión.
 */
async function requestBlob(path: string): Promise<Blob> {
  const session = getSession()
  const res = await fetch(`${API_BASE}${path}`, {
    headers: session ? { Authorization: `Bearer ${session.token}` } : {}
  })
  if (res.status === 401) clearSession()
  if (!res.ok) throw new ApiError(res.status, res.statusText)
  return res.blob()
}

/** Envoltorio de las listas paginadas por cursor de la API. */
export interface Paginated<T> {
  items: T[]
  /** `null` cuando no hay más páginas. */
  nextCursor: string | null
}

// El cuerpo se declara con el tipo de `packages/shared` en cada call site
// (`jsonInit<CreateInvitationInput>(…)`): si la API agrega un campo obligatorio
// o renombra uno, el schema cambia y esto deja de compilar — en vez de un 400
// en runtime. `port.contract.test.ts` cruza además lo que realmente sale
// contra el OpenAPI.
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

  // Paneles de rol (M2-D5 filas 33-34, 51, 55). Los tipos vienen del contrato
  // de `packages/shared`: acá no se declara la forma de nada.
  getDeveloperKpis: () => request<DeveloperKpis>('/api/v1/developer/kpis'),
  getCertifierKpis: () => request<CertifierKpis>('/api/v1/certifier/kpis'),
  getCertifierAssignments: () => request<CertifierAssignment[]>('/api/v1/certifier/assignments'),
  getNotaryKpis: () => request<NotaryKpis>('/api/v1/notary/kpis'),
  getNotaryPendingDossiers: () => request<PendingDossier[]>('/api/v1/notary/dossiers/pending'),

  getProject: (id: string) => request<ProjectDetail>(`/api/v1/projects/${id}`),

  setMilestoneState: (stageId: string, state: StageState) =>
    request<Stage>(
      `/api/v1/stages/${stageId}/state`,
      jsonInit<StageTransitionInput>('PATCH', { state })
    ),

  // ── Superficie del developer (M2-D5 filas 35-36, 37, 38/44c, 49, 62) ─────

  listDeveloperProjects: () => request<DeveloperProject[]>('/api/v1/developer/projects'),

  getDeveloperProject: (id: string) =>
    request<DeveloperProjectDetail>(`/api/v1/developer/projects/${id}`),

  /**
   * Fila 38 — sube y **ancla en la misma request**.
   *
   * M2-D5 §2.2 lo obliga: *"client awaits success with TXID/Merkle root in the
   * same response"*. Es lo que alimenta el `AnchoringSuccessModal`, la única
   * superficie de prueba que se abre sola (M2-D4 §6.3).
   */
  uploadStageEvidence: (projectId: string, stageId: string, form: FormData) =>
    request<StageEvidenceAnchor>(
      `/api/v1/developer/projects/${projectId}/stages/${stageId}/evidence`,
      { method: 'POST', body: form }
    ),

  // `limit` no entra: la API le pone su default y el front no pagina por tamaño.
  listAuditLog: (params?: Pick<AuditLogQuery, 'category' | 'cursor'>) => {
    const q = new URLSearchParams()
    if (params?.category) q.set('category', params.category)
    if (params?.cursor) q.set('cursor', params.cursor)
    const qs = q.toString()
    return request<Paginated<AuditEvent>>(`/api/v1/developer/audit-log${qs ? `?${qs}` : ''}`)
  },

  listDeveloperUnits: () => request<DeveloperUnit[]>('/api/v1/developer/units'),

  // ── Unidades de un proyecto (M2-D5 fila 44b) ─────────────────────────────
  //
  // `unitReference` solo entra en el alta: el PATCH del endpoint no lo acepta,
  // porque la referencia es la identidad comercial de la unidad y renombrarla
  // rompería cualquier contrato o invitación que ya la nombre.

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

  /**
   * Fila 39 — emite la invitación y deja la unidad reservada.
   *
   * `amountMinorUnits` es entero y en la unidad mínima (regla 1): la pantalla
   * recibe pesos o dólares del formulario y hace la cuenta una sola vez, acá
   * llega ya convertido.
   */
  /**
   * Filas 40-41 — los contratos del proyecto como registro (D-070).
   *
   * **No hay método para liberar una etapa y no lo va a haber acá.** El
   * endpoint existe en el backend como deuda declarada de un encuadre viejo;
   * exponerlo en el `ApiPort` sería el primer paso para que alguien construya
   * el botón que D-070 declaró que no es el producto.
   */
  listProjectContracts: (projectId: string) =>
    request<DeveloperContract[]>(`/api/v1/developer/projects/${projectId}/contracts`),

  createInvitation: (projectId: string, invitacion: CreateInvitationInput) =>
    request<Invitation>(
      `/api/v1/developer/projects/${projectId}/invitations`,
      jsonInit<CreateInvitationInput>('POST', invitacion)
    ),

  getDeveloperProgress: () => request<ProgressRow[]>('/api/v1/developer/progress'),

  listInvestors: () => request<InvestorDirectoryEntry[]>('/api/v1/developer/investors'),

  // ── Capital del developer (M2-D5 filas 42-43) ────────────────────────────
  //
  // **Montos DECLARADOS, no fondos que la plataforma tenga** (D-021): "capital
  // levantado" es la suma de los contratos firmados.

  getCapitalSummary: () => request<CapitalSummary>('/api/v1/developer/capital/summary'),

  getCapitalMonthly: () => request<CapitalMonthlyPoint[]>('/api/v1/developer/capital/monthly'),

  getCapitalByProject: () => request<CapitalByProject[]>('/api/v1/developer/capital/by-project'),

  createProject: (proyecto: CreateDeveloperProjectInput) =>
    request<ProjectCreated>(
      '/api/v1/developer/projects',
      jsonInit<CreateDeveloperProjectInput>('POST', proyecto)
    ),

  listDeveloperDocuments: (status?: DeveloperDocumentListQuery['status']) => {
    const qs = status ? `?status=${status}` : ''
    return request<DeveloperDocument[]>(`/api/v1/developer/documents${qs}`)
  },

  /** Ancla un documento pendiente. Es idempotente: re-anclar devuelve el evento existente. */
  anchorDocument: (evidenceId: string) =>
    request<StageEvidenceAnchor>(
      '/api/v1/developer/documents',
      jsonInit<AnchorDocumentInput>('POST', { evidenceId })
    ),

  listInvestorUnits: () => request<InvestorUnit[]>('/api/v1/investor/units'),

  // ── Superficie del investor (M2-D5 filas 03-13, 15-30, 63) ───────────────

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

  // ── Notificaciones (M2-D5 filas 22 y 62) ─────────────────────────────────

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

  // ── Superficie del certifier (M2-D5 filas 56v, 56c, 57, 58) ──────────────
  //
  // `certify` y `observe` son **transiciones de la misma FSM** con distinta
  // autorización: las dos devuelven el stage actualizado y su anclaje.

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

  // ── Superficie del notary (M2-D5 filas 52v, 52s, 52r, 53) ────────────────

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

  // ── Perfil — UNA superficie con cuatro entradas (M2-D5 §3) ───────────────

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
