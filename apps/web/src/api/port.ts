// ApiPort — ÚNICO lugar del front que hace fetch (prohibición de CLAUDE.md).
// Adaptador `real` contra packages/api. El adaptador `mock` está pendiente.

import { clearSession, getSession } from '../auth/session'
import type {
  Evidence,
  LoginResponse,
  MeResponse,
  Milestone,
  MilestoneState,
  Project,
  ProjectDetail,
} from './types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = getSession()
  const headers = new Headers(init.headers)
  if (session) headers.set('Authorization', `Bearer ${session.token}`)

  const res = await fetch(path, { ...init, headers })

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

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>('/api/v1/auth/login', jsonInit('POST', { email, password })),

  me: () => request<MeResponse>('/api/v1/auth/me'),

  listProjects: () => request<Project[]>('/api/v1/projects'),

  getProject: (id: string) => request<ProjectDetail>(`/api/v1/projects/${id}`),

  listEvidence: (projectId: string) =>
    request<Evidence[]>(`/api/v1/projects/${projectId}/evidence`),

  uploadEvidence: (projectId: string, form: FormData) =>
    request<Evidence>(`/api/v1/projects/${projectId}/evidence`, {
      method: 'POST',
      body: form,
    }),

  setMilestoneState: (milestoneId: string, state: MilestoneState) =>
    request<Milestone>(`/api/v1/milestones/${milestoneId}/state`, jsonInit('PATCH', { state })),

  downloadEvidence: async (evidenceId: string): Promise<Blob> => {
    const session = getSession()
    const res = await fetch(`/api/v1/evidence/${evidenceId}/download`, {
      headers: session ? { Authorization: `Bearer ${session.token}` } : {},
    })
    if (!res.ok) throw new ApiError(res.status, res.statusText)
    return res.blob()
  },
}
