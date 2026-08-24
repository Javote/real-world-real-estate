import type { StageState } from "@plataforma/shared";
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "../lib/kysely";

// Los valores son los que declara la migración (`migrations/0000_init.sql`)
// (D-016). SQLite no tiene enum nativo: se modelan como `text`, y la
// restricción real la sigue haciendo Zod en `packages/shared` (regla 6).
export const USER_ROLES = ["admin", "developer", "buyer", "verifier", "notary"] as const;
export const PROJECT_STATUSES = ["planning", "in_progress", "delayed", "completed"] as const;
export const MEMBERSHIP_ROLES = ["developer", "buyer", "verifier"] as const;
// La FSM del stage NO se declara acá: vive en `packages/shared`, que es el
// espejo del validador Aiken (D-059). Se re-exporta para que quien trabaje con
// la base la tenga a mano sin importar de dos lugares distintos.
export { STAGE_STATES } from "@plataforma/shared";

/** Estado de un evento on-chain. `Pending` mientras no haya TXID confirmado
 * — la regla 17 prohíbe mostrar prueba sin anclaje real. */
export const ONCHAIN_EVENT_STATUSES = ["Pending", "Confirmed", "Failed"] as const;

/** `event_type` de M1-D2 §2. Hoy solo se escriben los dos del hilo de stages. */
export const ONCHAIN_EVENT_TYPES = [
  "STAGE_CREATED",
  "STAGE_TRANSITION",
  "EVIDENCE_ANCHOR"
] as const;
export const EVIDENCE_TYPES = ["document", "photo", "certificate"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];
export type { StageState };
export type OnChainEventStatus = (typeof ONCHAIN_EVENT_STATUSES)[number];
export type OnChainEventType = (typeof ONCHAIN_EVENT_TYPES)[number];
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

export interface StageTable {
  id: GeneratedId;
  projectId: string;
  name: string;
  sequenceOrder: number;
  state: StageState;
  validationCritical: SqliteBoolean;
  certifiedAt: SqliteTimestamp | null;
  certifiedById: string | null;
  createdAt: SqliteTimestamp;
  updatedAt: SqliteTimestamp;
}

export interface EvidenceTable {
  id: GeneratedId;
  projectId: string;
  stageId: string | null;
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

/**
 * El aterrizaje del anclaje (M1-D2 §2 `OnChainEvent`). Una fila por evento del
 * hilo on-chain de un stage: `eventIndex` 0 es el `mint` del thread token,
 * 1..n las transiciones.
 *
 * Se escribe **en el mismo momento que la declaración**, con `status:
 * "Pending"` y sin `txid`: el registro avanza y la prueba queda pendiente. Al
 * revés no puede pasar (D-059).
 */
export interface OnChainEventTable {
  id: GeneratedId;
  projectId: string;
  stageId: string | null;
  /** Solo en `EVIDENCE_ANCHOR`: qué archivo ancló esta transacción. */
  evidenceId: string | null;
  eventIndex: number;
  eventType: OnChainEventType;
  fromState: StageState | null;
  toState: StageState | null;
  /** Commitment anclado (evidence root / SHA-256), hex. */
  commitment: string | null;
  status: OnChainEventStatus;
  txid: string | null;
  /** UTxO del thread token: `txid#index`. Estado crítico — sin esto el hilo se pierde. */
  outputRef: string | null;
  blockTimestamp: SqliteTimestamp | null;
  createdAt: SqliteTimestamp;
  updatedAt: SqliteTimestamp;
}

/**
 * Ledger del adaptador simulado del `AnchorPort` (SPEC-013 §A). Solo se escribe
 * con `ANCHOR_MODE=simulated`; con el adaptador real, el ledger es Cardano.
 */
export interface SimulatedLedgerUtxoTable {
  outputRef: string;
  /** `stageRef` del datum = asset name del thread token. */
  assetName: string;
  datumJson: string;
  spentByTxid: string | null;
  createdAt: SqliteTimestamp;
}

/**
 * `EvidenceBundle` de M1-D2 §2: el conjunto de evidencia que sostiene el cierre
 * de un stage, con su Merkle root. Es lo que hace anclable un stage
 * `validation_critical` (D-061).
 */
export interface EvidenceBundleTable {
  id: GeneratedId;
  projectId: string;
  stageId: string;
  /** Merkle root del bundle, hex de 64. Es el `evidenceRoot` del datum. */
  commitmentHash: string;
  createdById: string | null;
  createdAt: SqliteTimestamp;
}

/** Un acta, no un índice: el hash se copia para que el root siga siendo
 * reconstruible aunque la evidencia se borre. */
export interface EvidenceBundleItemTable {
  bundleId: string;
  evidenceId: string;
  sha256Hash: string;
}

export interface Database {
  User: UserTable;
  Project: ProjectTable;
  ProjectMember: ProjectMemberTable;
  Stage: StageTable;
  Evidence: EvidenceTable;
  AuditLog: AuditLogTable;
  OnChainEvent: OnChainEventTable;
  SimulatedLedgerUtxo: SimulatedLedgerUtxoTable;
  EvidenceBundle: EvidenceBundleTable;
  EvidenceBundleItem: EvidenceBundleItemTable;
}

export type UserRow = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export type ProjectRow = Selectable<ProjectTable>;
export type NewProject = Insertable<ProjectTable>;
export type ProjectUpdate = Updateable<ProjectTable>;

export type ProjectMemberRow = Selectable<ProjectMemberTable>;
export type NewProjectMember = Insertable<ProjectMemberTable>;

export type StageRow = Selectable<StageTable>;
export type NewStage = Insertable<StageTable>;
export type StageUpdate = Updateable<StageTable>;

export type EvidenceRow = Selectable<EvidenceTable>;
export type NewEvidence = Insertable<EvidenceTable>;
export type EvidenceUpdate = Updateable<EvidenceTable>;

export type AuditLogRow = Selectable<AuditLogTable>;
export type NewAuditLog = Insertable<AuditLogTable>;

export type OnChainEventRow = Selectable<OnChainEventTable>;
export type NewOnChainEvent = Insertable<OnChainEventTable>;
export type OnChainEventUpdate = Updateable<OnChainEventTable>;

export type EvidenceBundleRow = Selectable<EvidenceBundleTable>;
export type NewEvidenceBundle = Insertable<EvidenceBundleTable>;
