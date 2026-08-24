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
// La FSM del stage vive en @plataforma/shared (D-059), que es el espejo del
// validador Aiken. El front solo necesita el tipo — `canTransition` es del lado
// que decide.
export type { StageState }
export type ProjectStatus = 'planning' | 'in_progress' | 'delayed' | 'completed'
export type EvidenceType = 'document' | 'photo' | 'certificate'

export interface Stage {
  id: string
  projectId: string
  name: string
  sequenceOrder: number
  state: StageState
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
  stages: Stage[]
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
  stageId: string | null
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
  stage?: Stage | null
  uploadedBy?: { id: string; email: string; fullName: string }
}

// ── Superficie del developer (M2-D5 filas 35-36, 37, 38, 49) ────────────────
//
// Estos shapes son de la API y no del contrato de `packages/shared` todavía:
// son composiciones de lectura (un proyecto con su avance calculado, un evento
// del log con su actor) y no entidades del dominio. Cuando el cliente salga del
// contrato oRPC (D-066) se generan solos y esto se borra.

export interface DeveloperProject extends Project {
  stageCount: number
  /** 0-100, del proyecto (D-029). */
  progress: number
}

export interface DeveloperProjectDetail extends DeveloperProject {
  stages: Stage[]
  evidenceCount: number
}

/** Lo que devuelve la subida anclada: la prueba llega con la respuesta. */
export interface StageEvidenceAnchor {
  evidence: Evidence
  bundleId: string
  /** Merkle root del bundle. Completo (regla 16). */
  merkleRoot: string
  anchor: { txid: string | null; status: string; eventType: string }
}

/** Una fila del audit log (M2-D4 P6). Append-only: nunca se edita ni se borra. */
export interface AuditEvent {
  id: string
  action: string
  entityType: string
  entityId: string
  metadataJson: string | null
  createdAt: string
  actorName: string | null
  actorRole: UserRole | null
}
