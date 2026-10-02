import type {
  AcceptInvitationResult,
  AuditAction,
  AuditEntityType,
  BuildingSchematicFloor as BuildingSchematicFloorShared,
  BundleFiles as BundleFilesShared,
  CertifierInvitation as CertifierInvitationShared,
  ContractRelease as ContractReleaseShared,
  DeveloperContract as DeveloperContractShared,
  DeveloperProfile as DeveloperProfileShared,
  DeveloperProgressItem,
  DeveloperProjectCreateResult,
  DeveloperProjectDetail as DeveloperProjectDetailShared,
  DeveloperProjectListItem,
  DeveloperUnitDirectoryEntry,
  EvidenceBundleSummary,
  EvidenceProof,
  EvidenceResponse,
  EvidenceType as EvidenceTypeShared,
  InvestorContract as InvestorContractShared,
  InvestorInvitationDetail,
  InvestorUnitDetail as InvestorUnitDetailShared,
  InvestorUnitListItem,
  InvestorUnitStage as InvestorUnitStageShared,
  InvitationResponse,
  ProjectCoverResult,
  ProjectDetail as ProjectDetailShared,
  ProjectDocument as ProjectDocumentShared,
  ProjectListItem,
  ProjectMemberWithUser,
  ProjectStatus as ProjectStatusShared,
  PublicDossier as PublicDossierShared,
  Serialized,
  StageEventSummary,
  StageEvidenceSummary,
  StageEvidenceUploadResult,
  StageResponse,
  StageState,
  UnitNewsEvent,
  UnitResponse,
  UserRole,
  UserSummary as UserSummaryShared
} from '@plataforma/shared'

export type { LoginResponse, MeResponse, SessionUser, UserRole } from '@plataforma/shared'

export type { StageState }
export type ProjectStatus = ProjectStatusShared
export type EvidenceType = EvidenceTypeShared

export type Stage = Serialized<StageResponse>

export type Project = Serialized<ProjectListItem>

export type ProjectCreated = Serialized<DeveloperProjectCreateResult>

export type ProjectCover = Serialized<ProjectCoverResult>

export type ProjectMemberUser = Serialized<ProjectMemberWithUser>['user']

export type ProjectDetail = Serialized<ProjectDetailShared>

export type UserSummary = Serialized<UserSummaryShared>

export type CertifierInvitation = Serialized<CertifierInvitationShared>

export type Evidence = Serialized<EvidenceResponse> & {
  stage?: Stage | null
  uploadedBy?: { id: string; email: string; fullName: string }
}

export type DeveloperProject = Serialized<DeveloperProjectListItem>

export type DeveloperProjectDetail = Serialized<DeveloperProjectDetailShared>

export type DeveloperProfile = Serialized<DeveloperProfileShared>

export type StageEvidenceAnchor = Serialized<StageEvidenceUploadResult>

export interface AuditEvent {
  id: string
  action: AuditAction
  entityType: AuditEntityType
  entityId: string
  metadataJson: string | null
  createdAt: string
  actorName: string | null
  actorRole: UserRole | null
}

export type DeveloperUnit = Serialized<DeveloperUnitDirectoryEntry>

export type DeveloperProjectUnit = Serialized<UnitResponse>

export type Invitation = Serialized<InvitationResponse>

export type DeveloperContract = Serialized<DeveloperContractShared>

export type InvestorUnit = Serialized<InvestorUnitListItem>

export type ProjectDocument = Serialized<ProjectDocumentShared>

export type ProjectStageDetail = Serialized<StageResponse> & {
  evidences: Serialized<StageEvidenceSummary>[]
  bundle: Serialized<EvidenceBundleSummary> | null
  events: Serialized<StageEventSummary>[]
}

export type BuildingSchematicFloor = Serialized<BuildingSchematicFloorShared>

export type InvestorUnitStage = Serialized<InvestorUnitStageShared>

export type InvestorUnitDetail = Serialized<InvestorUnitDetailShared>

export type InvestorUnitNews = Serialized<UnitNewsEvent>

export type InvestorContract = Serialized<InvestorContractShared>

export type ContractRelease = Serialized<ContractReleaseShared>

export type BundleFiles = Serialized<BundleFilesShared>

export type MerkleProof = Serialized<EvidenceProof>

export type InvestorInvitation = Serialized<InvestorInvitationDetail>

export type InvitationAcceptResult = Serialized<AcceptInvitationResult>

export type PublicDossier = Serialized<PublicDossierShared>

export type ProgressRow = Serialized<DeveloperProgressItem>
