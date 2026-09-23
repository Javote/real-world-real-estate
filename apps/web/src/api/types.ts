// Tipos de las respuestas de apps/api.
//
// Lo de auth ya NO se declara acá: viene de @plataforma/shared, que es donde el
// contrato existe una sola vez (regla 6). Si la API cambia la forma de una
// respuesta de auth sin actualizar el schema, el typecheck de este package falla
// — que es exactamente el punto de tener el package.
//
// Son `export type`: el front no carga Zod en runtime, solo usa los tipos, y
// `verbatimModuleSyntax` los borra al compilar.
//
// SPEC-109 (F-13) — 20 de los 31 tipos de este archivo YA tienen schema Zod en
// `packages/shared`, y hasta hoy se escribían a mano igual: 414 líneas de
// espejo manual para un contrato que en 2/3 de los casos ya existía del otro
// lado. Ahora se DERIVAN con `Serialized<T>` (`packages/shared/src/
// serialize.ts`): los schemas usan `z.coerce.date()`, así que el tipo
// inferido crudo dice `Date` mientras el cable manda `string` — `Serialized`
// hace ese único cambio de forma y deja todo lo demás igual. Un tipo derivado
// no puede divergir del schema: si el schema gana un campo, el tipo lo gana;
// si lo pierde, esto no compila. Es la misma economía que el package entero
// (D-012): volver el drift imposible, no prohibido.
//
// **Verificado campo por campo contra el schema Y contra el handler real**
// antes de derivar cada uno (invariante 3: ante una diferencia, gana el
// schema, y se investiga antes de asumir). Encontró dos cosas reales:
//
// 1. **Un bug en producción.** `DeveloperProjectDetail` (antes) heredaba
//    `stageCount`/`progress`/`priceFromMinorUnits`/`priceCurrency` de
//    `DeveloperProject`, pero `GET /developer/projects/:id`
//    (`developer.routes.ts`) nunca los manda — solo `{...proyecto, stages,
//    evidenceCount}`. `developer.project.$projectId.index.tsx` leía
//    `proyecto?.progress` para el StatCard de avance: **siempre mostraba 0%**,
//    tapado por el `?? 0`. Se corrigió calculando el avance de `proyecto.
//    stages` con `avanceDeStages`, igual que el resto de la app — el dato
//    completo ya viaja, solo que en la forma de la lista de stages, no de un
//    campo agregado que este endpoint nunca calculó.
// 2. **Varios campos que el backend manda y el front nunca supo que podía
//    leer** — el mismo síntoma que ya había dejado ver `SPEC-107` del otro
//    lado del contrato: `MerkleProof` (`GET /evidence/:id/proof/:hash`)
//    llegaba sin `signerUserId`/`anchorStatus`/`txid`/`timestamp`, que la
//    respuesta real sí trae (`evidenceProofSchema`); `ProjectStageDetail.
//    events[]` llegaba sin `outputRef`; `anchor` en `ProjectCreated`/
//    `StageEvidenceAnchor`/`InvitationAcceptResult` se declaraba como
//    `{txid, status}` cuando el evento real es el `OnChainEvent` completo.
//    Ninguno se usa todavía — quedan disponibles para quien los necesite,
//    en vez de invisibles.
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

// La FSM del stage vive en @plataforma/shared (D-059), que es el espejo del
// validador Aiken. El front solo necesita el tipo — `canTransition` es del
// lado que decide.
export type { StageState }
export type ProjectStatus = ProjectStatusShared
export type EvidenceType = EvidenceTypeShared

export type Stage = Serialized<StageResponse>

export type Project = Serialized<ProjectListItem>

/**
 * Respuesta de `POST /developer/projects` — el Stage template (M2-D1 §5.2,
 * captura 34C) se aplica siempre, así que cada etapa viaja con el resultado
 * de su propio intento de anclaje: minteos independientes, uno puede quedar
 * `Failed` sin bloquear a los demás (D-059).
 */
export type ProjectCreated = Serialized<DeveloperProjectCreateResult>

export type ProjectMemberUser = Serialized<ProjectMemberWithUser>['user']

export type ProjectDetail = Serialized<ProjectDetailShared>

// ── Admin (SPEC-221, D-095) ──────────────────────────────────────────────────

/** Un usuario de `GET /users` (admin-only): el admin elige al certifier de acá. */
export type UserSummary = Serialized<UserSummaryShared>

/** Una invitación a certificar un proyecto, como la ven el admin y el certifier. */
export type CertifierInvitation = Serialized<CertifierInvitationShared>

export type Evidence = Serialized<EvidenceResponse> & {
  stage?: Stage | null
  uploadedBy?: { id: string; email: string; fullName: string }
}

// ── Superficie del developer (M2-D5 filas 35-36, 37, 38, 49) ────────────────

export type DeveloperProject = Serialized<DeveloperProjectListItem>

export type DeveloperProjectDetail = Serialized<DeveloperProjectDetailShared>

/**
 * Capturas 59-60 · el perfil de la organización desarrolladora (SPEC-220).
 * Sin `rating`: D-094 — la plataforma no sostiene afirmaciones sobre la
 * calidad de un desarrollador, solo sobre documentos y atestaciones (D-026).
 */
export type DeveloperProfile = Serialized<DeveloperProfileShared>

/** Lo que devuelve la subida anclada: la prueba llega con la respuesta. */
export type StageEvidenceAnchor = Serialized<StageEvidenceUploadResult>

/** Una fila del audit log (M2-D4 P6). Append-only: nunca se edita ni se borra. */
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

/** Fila 44 — inventario de unidades del developer, cruzando proyectos. */
export type DeveloperUnit = Serialized<DeveloperUnitDirectoryEntry>

/**
 * Fila 44b — la unidad tal cual la guarda el proyecto, del lado del developer.
 *
 * Es la fila cruda de `Unit`: el endpoint por proyecto hace `selectAll()` y no
 * cruza con el investor, así que acá hay `investorId` y nunca un nombre. Por
 * eso la pantalla rotula "asignada / sin asignar" y no una persona (regla 17).
 */
export type DeveloperProjectUnit = Serialized<UnitResponse>

/**
 * Fila 39 — la invitación que el developer emite sobre una unidad.
 *
 * **No trae anclaje y no debería.** M2-D5 anota la fila con "→ anchor TXID",
 * pero el POST no ancla: el commitment del ciclo se emite cuando el investor
 * ACEPTA, porque hasta entonces no hay contrato del que hacer commitment.
 * Emitir una invitación no es un hecho que la cadena tenga que sostener.
 */
export type Invitation = Serialized<InvitationResponse>

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
export type DeveloperContract = Serialized<DeveloperContractShared>

/** Fila 14 — las unidades del investor, con el avance de SU proyecto (D-029). */
export type InvestorUnit = Serialized<InvestorUnitListItem>

/** Fila 06-07 — documentos del proyecto con su estado de prueba derivado del TXID. */
export type ProjectDocument = Serialized<ProjectDocumentShared>

/**
 * Fila 09-12 — el stage con su evidencia y el bundle que lo compromete.
 *
 * Compuesto, no un solo schema: `GET /projects/:id/stages/:stageId` arma la
 * respuesta a partir de tres piezas que sí tienen schema cada una
 * (`stageSchema` + los tres resúmenes embebidos), sin que exista un cuarto
 * schema que las una — eso sería inventar un contrato que el backend no
 * valida como una sola unidad.
 */
export type ProjectStageDetail = Serialized<StageResponse> & {
  evidences: Serialized<StageEvidenceSummary>[]
  bundle: Serialized<EvidenceBundleSummary> | null
  events: Serialized<StageEventSummary>[]
}

/** Fila 21 — unidades agrupadas por piso. `floor` null no se inventa. */
export type BuildingSchematicFloor = Serialized<BuildingSchematicFloorShared>

/** Fila 15-18 — detalle de la unidad, con los stages del PROYECTO (D-029, P9). */
export type InvestorUnitStage = Serialized<InvestorUnitStageShared>

export type InvestorUnitDetail = Serialized<InvestorUnitDetailShared>

/** Fila 15-18 — novedades: eventos de los stages del proyecto. */
export type InvestorUnitNews = Serialized<UnitNewsEvent>

/** Fila 23-24 — el contrato como registro. Sin TXID propio en este GET. */
export type InvestorContract = Serialized<InvestorContractShared>

/** Fila 23-24 — cada release con su TXID (P10). Sin moneda: sale del contrato. */
export type ContractRelease = Serialized<ContractReleaseShared>

/** Fila 25m — archivos del bundle y su Merkle root. */
export type BundleFiles = Serialized<BundleFilesShared>

/**
 * El proof object de `GET /evidence/:bundleId/proof/:fileHash` — mismo
 * endpoint que describe `evidenceProofSchema`. El espejo manual anterior solo
 * declaraba `merkleRoot`/`leaf`/`proof`; la respuesta real también trae
 * `signerUserId`/`anchorStatus`/`txid`/`timestamp`, sin usar todavía.
 */
export type MerkleProof = Serialized<EvidenceProof>

/** Fila 63 — la invitación que el investor ve. */
export type InvestorInvitation = Serialized<InvestorInvitationDetail>

export type InvitationAcceptResult = Serialized<AcceptInvitationResult>

/** Fila 28s — vista pública, recortada: hashes y TXID, sin PII. */
export type PublicDossier = Serialized<PublicDossierShared>

/** Fila 45 — el avance por etapa, cruzando todos los proyectos del developer. */
export type ProgressRow = Serialized<DeveloperProgressItem>
