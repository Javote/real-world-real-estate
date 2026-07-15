// Tipos espejo de las respuestas de packages/api (SPEC-006/007).
// Migración pendiente a schemas Zod en packages/shared (SPEC-005 §1, tarea T0).

export type UserRole = 'admin' | 'developer' | 'buyer' | 'verifier'
export type MilestoneState = 'Pending' | 'InProgress' | 'Completed' | 'Observed'
export type ProjectStatus = 'planning' | 'in_progress' | 'delayed' | 'completed'
export type EvidenceType = 'document' | 'photo' | 'certificate'

export interface SessionUser {
  id: string
  email: string
  role: UserRole
  fullName: string
}

export interface LoginResponse {
  token: string
  user: SessionUser
}

export interface Milestone {
  id: string
  projectId: string
  name: string
  sequenceOrder: number
  state: MilestoneState
  validationCritical: boolean
  certifiedAt: string | null
  certifiedById: string | null
  scopeType: string
  scopeUnitCount: number
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
