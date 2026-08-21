import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "../lib/kysely";

// Mismos valores que antes con Drizzle (D-048) y que `prisma/schema.prisma`
// (D-016). SQLite no tiene enum nativo: se modelan como `text`, y la
// restricción real la sigue haciendo Zod en `packages/shared` (regla 6).
export const USER_ROLES = ["admin", "developer", "buyer", "verifier"] as const;
export const PROJECT_STATUSES = ["planning", "in_progress", "delayed", "completed"] as const;
export const MEMBERSHIP_ROLES = ["developer", "buyer", "verifier"] as const;
export const MILESTONE_STATES = ["Pending", "InProgress", "Completed", "Observed"] as const;
export const EVIDENCE_TYPES = ["document", "photo", "certificate"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];
export type MilestoneState = (typeof MILESTONE_STATES)[number];
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

// Kysely no tiene columnas booleanas/timestamp: SQLite las guarda como
// `integer` (0/1, epoch ms) y el driver de libSQL las devuelve como
// `number`. `ColumnType<Select, Insert, Update>` documenta esa asimetría
// donde aplica (booleans e IDs con default de servidor); donde no hace falta
// (columnas nullable comunes) alcanza con el tipo de SELECT.
type SqliteBoolean = ColumnType<boolean, boolean | number, boolean | number>;
type SqliteTimestamp = ColumnType<Date, Date | number, Date | number>;
type GeneratedId = Generated<string>;

export interface UserTable {
  id: GeneratedId;
  email: string;
  passwordHash: string;
  role: UserRole;
  fullName: string;
  isActive: SqliteBoolean;
  createdAt: SqliteTimestamp;
  updatedAt: SqliteTimestamp;
}

export interface ProjectTable {
  id: GeneratedId;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  totalUnits: number;
  estimatedDelivery: SqliteTimestamp | null;
  status: ProjectStatus;
  createdAt: SqliteTimestamp;
  updatedAt: SqliteTimestamp;
}

export interface ProjectMemberTable {
  id: GeneratedId;
  userId: string;
  projectId: string;
  membershipRole: MembershipRole;
  createdAt: SqliteTimestamp;
}

export interface MilestoneTable {
  id: GeneratedId;
  projectId: string;
  name: string;
  sequenceOrder: number;
  state: MilestoneState;
  validationCritical: SqliteBoolean;
  certifiedAt: SqliteTimestamp | null;
  certifiedById: string | null;
  scopeType: string;
  scopeUnitCount: number;
  createdAt: SqliteTimestamp;
  updatedAt: SqliteTimestamp;
}

export interface EvidenceTable {
  id: GeneratedId;
  projectId: string;
  milestoneId: string | null;
  uploadedById: string;
  evidenceType: EvidenceType;
  category: string;
  authoritative: SqliteBoolean;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  sha256Hash: string;
  uploadedAt: SqliteTimestamp;
  createdAt: SqliteTimestamp;
  updatedAt: SqliteTimestamp;
}

export interface AuditLogTable {
  id: GeneratedId;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadataJson: string | null;
  createdAt: SqliteTimestamp;
}

export interface Database {
  User: UserTable;
  Project: ProjectTable;
  ProjectMember: ProjectMemberTable;
  Milestone: MilestoneTable;
  Evidence: EvidenceTable;
  AuditLog: AuditLogTable;
}

export type UserRow = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export type ProjectRow = Selectable<ProjectTable>;
export type NewProject = Insertable<ProjectTable>;
export type ProjectUpdate = Updateable<ProjectTable>;

export type ProjectMemberRow = Selectable<ProjectMemberTable>;
export type NewProjectMember = Insertable<ProjectMemberTable>;

export type MilestoneRow = Selectable<MilestoneTable>;
export type NewMilestone = Insertable<MilestoneTable>;
export type MilestoneUpdate = Updateable<MilestoneTable>;

export type EvidenceRow = Selectable<EvidenceTable>;
export type NewEvidence = Insertable<EvidenceTable>;
export type EvidenceUpdate = Updateable<EvidenceTable>;

export type AuditLogRow = Selectable<AuditLogTable>;
export type NewAuditLog = Insertable<AuditLogTable>;
