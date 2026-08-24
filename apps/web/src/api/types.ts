// Tipos de las respuestas de apps/api.
//
// Lo de auth ya NO se declara acá: viene de @plataforma/shared, que es donde el
// contrato existe una sola vez (regla 6). Si la API cambia la forma de una
// respuesta de auth sin actualizar el schema, el typecheck de este package falla
// — que es exactamente el punto de tener el package.
//
// Son `export type`: el front no carga Zod en runtime, solo usa los tipos, y
// `verbatimModuleSyntax` los borra al compilar.
import type { StageState, UserRole } from '@plataforma/shared'

export type { LoginResponse, MeResponse, SessionUser, UserRole } from '@plataforma/shared'

// El resto sigue siendo espejo manual. Cada uno migra a packages/shared cuando
// su rebanada lo toque (SPEC-008 §NO-alcance): migrarlos todos ahora sería
// escribir schemas para endpoints que van a cambiar de forma igual.
// La FSM del stage YA migró (D-059): la tabla de transiciones y sus estados
// viven en @plataforma/shared, que es el espejo del validador Aiken. El front
// solo necesita el tipo — `canTransition` es del lado que decide.
export type MilestoneState = StageState
export type ProjectStatus = 'planning' | 'in_progress' | 'delayed' | 'completed'
export type EvidenceType = 'document' | 'photo' | 'certificate'

export interface Milestone {
  id: string
  projectId: string
  name: string
  sequenceOrder: number
  state: MilestoneState
  validationCritical: boolean
  certifiedAt: string | null
  certifiedById: string | null
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  slug: string
  address: string | null
  city: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  totalUnits: number
  estimatedDelivery: string | null
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  milestones: Milestone[]
}

export interface ProjectMemberUser {
  id: string
  email: string
  fullName: string
  role: UserRole
}

export interface ProjectDetail extends Project {
  members: Array<{
    id: string
    userId: string
    projectId: string
    membershipRole: 'developer' | 'buyer' | 'verifier'
    user: ProjectMemberUser
  }>
}

export interface Evidence {
  id: string
  projectId: string
  milestoneId: string | null
  uploadedById: string
  evidenceType: EvidenceType
  category: string
  authoritative: boolean
  originalFilename: string
  mimeType: string
  sizeBytes: number
  sha256Hash: string
  uploadedAt: string
  createdAt: string
  updatedAt: string
  milestone?: Milestone | null
  uploadedBy?: { id: string; email: string; fullName: string }
}
