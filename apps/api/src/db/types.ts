import type {
  EvidenceType,
  MembershipRole,
  OnChainEventStatus,
  OnChainEventType,
  ProjectStatus,
  StageState
} from "@plataforma/shared";
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "../lib/kysely";

export const USER_ROLES = ["admin", "developer", "buyer", "verifier", "notary"] as const;
export {
  EVIDENCE_TYPES,
  MEMBERSHIP_ROLES,
  ONCHAIN_EVENT_STATUSES,
  ONCHAIN_EVENT_TYPES,
  PROJECT_STATUSES,
  STAGE_STATES
} from "@plataforma/shared";

export type UserRole = (typeof USER_ROLES)[number];
export type {
  EvidenceType,
  MembershipRole,
  OnChainEventStatus,
  OnChainEventType,
  ProjectStatus,
  StageState
};

type SqliteBoolean = ColumnType<boolean, boolean | number, boolean | number>;
type SqliteTimestamp = ColumnType<Date, Date | number, Date | number>;
type SqliteTimestampSinCoercion = ColumnType<number, Date | number, Date | number>;
type GeneratedId = Generated<string>;

export interface UserTable {
  id: GeneratedId;
  email: string;
  passwordHash: string;
  role: UserRole;
  fullName: string;
  isActive: SqliteBoolean;
  notificationPrefsJson: string | null;
  createdAt: SqliteTimestamp;
  updatedAt: SqliteTimestamp;
}

export interface OrganizationTable {
  id: GeneratedId;
  name: string;
  slug: string;
  bio: string | null;
  foundedYear: number | null;
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
  organizationId: string | null;
  coverUpdatedAt: SqliteTimestamp | null;
  createdAt: SqliteTimestamp;
  updatedAt: SqliteTimestamp;
}

export interface ProjectCoverTable {
  projectId: string;
  storageRef: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string | null;
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
  issuingAuthority: string | null;
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

export interface OnChainEventTable {
  id: GeneratedId;
  projectId: string;
  stageId: string | null;
  evidenceId: string | null;
  referenceId: string | null;
  eventIndex: number;
  eventType: OnChainEventType;
  fromState: StageState | null;
  toState: StageState | null;
  commitment: string | null;
  status: OnChainEventStatus;
  txid: string | null;
  network: string | null;
  outputRef: string | null;
  blockTimestamp: SqliteTimestamp | null;
  createdAt: SqliteTimestamp;
  updatedAt: SqliteTimestamp;
}

export interface SimulatedLedgerUtxoTable {
  outputRef: string;
  assetName: string;
  datumJson: string;
  spentByTxid: string | null;
  createdAt: SqliteTimestamp;
}

export interface SimulatedLedgerBlockTable {
  txid: string;
  blockAt: number;
}

export interface EvidenceBundleTable {
  id: GeneratedId;
  projectId: string;
  stageId: string;
  commitmentHash: string;
  createdById: string | null;
  createdAt: SqliteTimestamp;
}

export interface EvidenceBundleItemTable {
  bundleId: string;
  evidenceId: string;
  sha256Hash: string;
}

export interface FavoriteTable {
  userId: string;
  projectId: string;
  createdAt: SqliteTimestamp;
}

export interface UnitTable {
  id: GeneratedId;
  projectId: string;
  unitReference: string;
  status: string;
  floor: number | null;
  sizeM2: number | null;
  priceMinorUnits: number | null;
  currency: string | null;
  investorId: string | null;
  createdAt: SqliteTimestamp;
  updatedAt: SqliteTimestamp;
}

export interface InvitationTable {
  id: GeneratedId;
  projectId: string;
  unitId: string;
  investorEmail: string;
  amountMinorUnits: number;
  currency: string;
  status: string;
  createdById: string | null;
  createdAt: SqliteTimestamp;
  respondedAt: SqliteTimestampSinCoercion | null;
}

export interface CertifierInvitationTable {
  id: GeneratedId;
  projectId: string;
  certifierId: string;
  status: string;
  createdById: string | null;
  createdAt: SqliteTimestamp;
  respondedAt: SqliteTimestampSinCoercion | null;
}

export interface ContractTable {
  id: GeneratedId;
  unitId: string;
  investorId: string;
  totalMinorUnits: number;
  currency: string;
  signedAt: SqliteTimestampSinCoercion | null;
  createdAt: SqliteTimestamp;
}

export interface PaymentAttestationTable {
  id: GeneratedId;
  contractId: string;
  stageNumber: number;
  amountMinorUnits: number;
  releasedById: string | null;
  releasedAt: SqliteTimestampSinCoercion;
}

export interface DossierTable {
  id: GeneratedId;
  unitId: string;
  masterHash: string;
  compiledAt: SqliteTimestampSinCoercion;
  shareToken: string | null;
  status: string;
  signedById: string | null;
  signedAt: SqliteTimestampSinCoercion | null;
  rejectionNote: string | null;
}

export interface NotificationTable {
  id: GeneratedId;
  userId: string;
  category: string;
  titleKey: string;
  paramsJson: string | null;
  unitId: string | null;
  readAt: SqliteTimestampSinCoercion | null;
  createdAt: SqliteTimestamp;
}

export interface Database {
  User: UserTable;
  Organization: OrganizationTable;
  Project: ProjectTable;
  ProjectCover: ProjectCoverTable;
  ProjectMember: ProjectMemberTable;
  Stage: StageTable;
  Evidence: EvidenceTable;
  AuditLog: AuditLogTable;
  OnChainEvent: OnChainEventTable;
  SimulatedLedgerUtxo: SimulatedLedgerUtxoTable;
  SimulatedLedgerBlock: SimulatedLedgerBlockTable;
  Favorite: FavoriteTable;
  Unit: UnitTable;
  Invitation: InvitationTable;
  CertifierInvitation: CertifierInvitationTable;
  Contract: ContractTable;
  PaymentAttestation: PaymentAttestationTable;
  Dossier: DossierTable;
  Notification: NotificationTable;
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
