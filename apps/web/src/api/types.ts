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

/** Fila 44 — inventario de unidades del developer, cruzando proyectos. */
export interface DeveloperUnit {
  id: string
  unitReference: string
  status: string
  priceMinorUnits: number | null
  currency: string | null
  investorId: string | null
  projectId: string
  projectName: string
}

/**
 * Fila 44b — la unidad tal cual la guarda el proyecto, del lado del developer.
 *
 * Es la fila cruda de `Unit`: el endpoint por proyecto hace `selectAll()` y no
 * cruza con el investor, así que acá hay `investorId` y nunca un nombre. Por
 * eso la pantalla rotula "asignada / sin asignar" y no una persona (regla 17).
 */
export interface DeveloperProjectUnit {
  id: string
  projectId: string
  unitReference: string
  status: string
  floor: number | null
  sizeM2: number | null
  priceMinorUnits: number | null
  currency: string | null
  investorId: string | null
}

/**
 * Fila 39 — la invitación que el developer emite sobre una unidad.
 *
 * **No trae anclaje y no debería.** M2-D5 anota la fila con "→ anchor TXID",
 * pero el POST no ancla: el commitment del ciclo se emite cuando el investor
 * ACEPTA, porque hasta entonces no hay contrato del que hacer commitment.
 * Emitir una invitación no es un hecho que la cadena tenga que sostener.
 */
export interface Invitation {
  id: string
  projectId: string
  unitId: string
  investorEmail: string
  amountMinorUnits: number
  currency: string
  status: string
  createdAt: string
}

/**
 * Filas 40-41 — el contrato como REGISTRO (D-070).
 *
 * No hay etapas liberadas ni montos por etapa: la plataforma no administra
 * fondos. Lo que hay es quién acordó qué sobre qué unidad, en qué estado quedó
 * la unidad y con qué anclaje se registró el acuerdo.
 *
 * `txid` es `null` mientras el anclaje no confirmó, y eso ES el estado
 * pendiente: `VerificationBadge` recibe el TXID, no un booleano (regla 17).
 */
export interface DeveloperContract {
  id: string
  unitId: string
  unitReference: string
  unitStatus: string
  investorName: string
  totalMinorUnits: number
  currency: string
  signedAt: string | null
  txid: string | null
  commitment: string | null
}

/** Fila 14 — las unidades del investor, con el avance de SU proyecto (D-029). */
export interface InvestorUnit {
  id: string
  unitReference: string
  status: string
  sizeM2: number | null
  priceMinorUnits: number | null
  currency: string | null
  projectId: string
  projectName: string
  city: string | null
  progress: number
}

/** Fila 45 — el avance por etapa, cruzando todos los proyectos del developer. */
export interface ProgressRow {
  stageId: string
  stageName: string
  sequenceOrder: number
  state: StageState
  projectId: string
  projectName: string
}
