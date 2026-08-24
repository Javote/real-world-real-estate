// ApiPort — ÚNICO lugar del front que hace fetch (prohibición de CLAUDE.md).
// Adaptador `real` contra apps/api. El adaptador `mock` está pendiente.

import type {
  Notification as AppNotification,
  CertifierAssignment,
  CertifierCertificate,
  CertifierKpis,
  CertifierStageView,
  DeveloperKpis,
  Dossier,
  NotaryKpis,
  NotarySignature,
  PendingDossier,
  Profile,
  UnreadCount
} from '@plataforma/shared'
import { clearSession, getSession } from '../auth/session'
import type {
  AuditEvent,
  DeveloperProject,
  DeveloperProjectDetail,
  Evidence,
  LoginResponse,
  MeResponse,
  Project,
  ProjectDetail,
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

/** Envoltorio de las listas paginadas por cursor de la API. */
export interface Paginated<T> {
  items: T[]
  /** `null` cuando no hay más páginas. */
  nextCursor: string | null
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>('/api/v1/auth/login', jsonInit('POST', { email, password })),

  me: () => request<MeResponse>('/api/v1/auth/me'),

  listProjects: () => request<Project[]>('/api/v1/projects'),

  // Paneles de rol (M2-D5 filas 33-34, 51, 55). Los tipos vienen del contrato
  // de `packages/shared`: acá no se declara la forma de nada.
  getDeveloperKpis: () => request<DeveloperKpis>('/api/v1/developer/kpis'),
  getCertifierKpis: () => request<CertifierKpis>('/api/v1/certifier/kpis'),
  getCertifierAssignments: () => request<CertifierAssignment[]>('/api/v1/certifier/assignments'),
  getNotaryKpis: () => request<NotaryKpis>('/api/v1/notary/kpis'),
  getNotaryPendingDossiers: () => request<PendingDossier[]>('/api/v1/notary/dossiers/pending'),

  getProject: (id: string) => request<ProjectDetail>(`/api/v1/projects/${id}`),

  listEvidence: (projectId: string) =>
    request<Evidence[]>(`/api/v1/projects/${projectId}/evidence`),

  uploadEvidence: (projectId: string, form: FormData) =>
    request<Evidence>(`/api/v1/projects/${projectId}/evidence`, {
      method: 'POST',
      body: form
    }),

  setMilestoneState: (stageId: string, state: StageState) =>
    request<Stage>(`/api/v1/stages/${stageId}/state`, jsonInit('PATCH', { state })),

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

  listAuditLog: (params?: { category?: string; cursor?: string }) => {
    const q = new URLSearchParams()
    if (params?.category) q.set('category', params.category)
    if (params?.cursor) q.set('cursor', params.cursor)
    const qs = q.toString()
    return request<Paginated<AuditEvent>>(`/api/v1/developer/audit-log${qs ? `?${qs}` : ''}`)
  },

  // ── Notificaciones (M2-D5 filas 22 y 62) ─────────────────────────────────

  listNotifications: (params?: { unitId?: string; category?: string }) => {
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
      jsonInit('POST', { note })
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
      jsonInit('POST', { note })
    ),

  listSignatures: (cursor?: string) =>
    request<Paginated<NotarySignature>>(
      `/api/v1/notary/signatures${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
    ),

  // ── Perfil — UNA superficie con cuatro entradas (M2-D5 §3) ───────────────

  getProfile: () => request<Profile>('/api/v1/profile'),

  updateProfile: (fullName: string) =>
    request<Profile>('/api/v1/profile', jsonInit('PATCH', { fullName })),

  updateNotificationPrefs: (prefs: Record<string, boolean>) =>
    request<Profile>('/api/v1/profile/notifications', jsonInit('PATCH', prefs)),

  downloadEvidence: async (evidenceId: string): Promise<Blob> => {
    const session = getSession()
    const res = await fetch(`/api/v1/evidence/${evidenceId}/download`, {
      headers: session ? { Authorization: `Bearer ${session.token}` } : {}
    })
    if (!res.ok) throw new ApiError(res.status, res.statusText)
    return res.blob()
  }
}
