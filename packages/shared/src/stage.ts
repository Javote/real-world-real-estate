import { z } from "zod";
import { outputRefSchema, sha256HexSchema, txidSchema } from "./hashes";

export const STAGE_STATES = ["Pending", "InProgress", "Observed", "Completed"] as const;

export const stageStateSchema = z.enum(STAGE_STATES);
export type StageState = z.infer<typeof stageStateSchema>;

export const STAGE_TRANSITIONS: Readonly<Record<StageState, readonly StageState[]>> = {
  Pending: ["InProgress"],
  InProgress: ["Observed", "Completed"],
  Observed: ["InProgress"],
  Completed: []
};

export const INITIAL_STAGE_STATE: StageState = "Pending";

export function canTransition(from: StageState, to: StageState): boolean {
  return STAGE_TRANSITIONS[from].includes(to);
}

export const STAGE_TRANSITION_ERRORS = {
  invalid: "STAGE_TRANSITION_INVALID",
  evidenceRequired: "STAGE_EVIDENCE_REQUIRED",
  evidenceUnattributed: "STAGE_EVIDENCE_UNATTRIBUTED",
  forbidden: "STAGE_TRANSITION_FORBIDDEN"
} as const;

export const stageTransitionSchema = z.strictObject({
  state: stageStateSchema
});

export type StageTransitionInput = z.infer<typeof stageTransitionSchema>;

export const updateStageSchema = z.object({
  name: z.string().min(1).optional(),
  sequenceOrder: z.number().int().positive().optional(),
  validationCritical: z.boolean().optional()
});
export type UpdateStageInput = z.infer<typeof updateStageSchema>;

export const observeStageSchema = z.strictObject({ note: z.string().min(1).max(2000) });
export type ObserveStageInput = z.infer<typeof observeStageSchema>;

export interface StageCatalogEntry {
  name: string;
  sequenceOrder: number;
}

export const DEFAULT_STAGE_CATALOG: readonly StageCatalogEntry[] = [
  { name: "Adquisición del terreno", sequenceOrder: 1 },
  { name: "Proyecto ejecutivo", sequenceOrder: 2 },
  { name: "Movimiento de suelos y excavación", sequenceOrder: 3 },
  { name: "Cimentación", sequenceOrder: 4 },
  { name: "Estructura planta baja", sequenceOrder: 5 },
  { name: "Estructura niveles superiores", sequenceOrder: 6 },
  { name: "Cerramientos y mampostería", sequenceOrder: 7 },
  { name: "Instalaciones", sequenceOrder: 8 },
  { name: "Terminaciones", sequenceOrder: 9 },
  { name: "Final de obra y subdivisión", sequenceOrder: 10 }
] as const;

export const stageSchema = z.strictObject({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  sequenceOrder: z.number().int().positive(),
  state: stageStateSchema,
  validationCritical: z.boolean(),
  certifiedAt: z.coerce.date().nullable(),
  certifiedById: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type StageResponse = z.infer<typeof stageSchema>;

export const ONCHAIN_EVENT_STATUSES = ["Pending", "Confirmed", "Failed"] as const;
export const onChainEventStatusSchema = z.enum(ONCHAIN_EVENT_STATUSES);
export type OnChainEventStatus = z.infer<typeof onChainEventStatusSchema>;

export const ONCHAIN_EVENT_TYPES = [
  "STAGE_CREATED",
  "STAGE_TRANSITION",
  "EVIDENCE_ANCHOR",
  "INVITATION_ACCEPTED",
  "PAYMENT_RELEASE",
  "DOSSIER_SIGNATURE",
  "DOCUMENT_ANCHOR"
] as const;
export const onChainEventTypeSchema = z.enum(ONCHAIN_EVENT_TYPES);
export type OnChainEventType = z.infer<typeof onChainEventTypeSchema>;

export const onChainEventSchema = z.strictObject({
  id: z.string(),
  projectId: z.string(),
  stageId: z.string().nullable(),
  evidenceId: z.string().nullable(),
  referenceId: z.string().nullable(),
  eventIndex: z.number().int().nonnegative(),
  eventType: onChainEventTypeSchema,
  fromState: stageStateSchema.nullable(),
  toState: stageStateSchema.nullable(),
  commitment: sha256HexSchema.nullable(),
  status: onChainEventStatusSchema,
  txid: txidSchema.nullable(),
  network: z.string().nullable(),
  outputRef: outputRefSchema.nullable(),
  blockTimestamp: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type OnChainEventResponse = z.infer<typeof onChainEventSchema>;

export const hiloSospechosoSchema = z.strictObject({
  eventId: z.string(),
  projectId: z.string(),
  stageId: z.string().nullable(),
  eventIndex: z.number().int().nonnegative(),
  fromState: stageStateSchema.nullable(),
  toState: stageStateSchema.nullable(),
  status: onChainEventStatusSchema,
  createdAt: z.coerce.date()
});
export type HiloSospechosoResponse = z.infer<typeof hiloSospechosoSchema>;

export const hiloReparadoSchema = z.strictObject({
  eventId: z.string(),
  txid: txidSchema,
  outputRef: outputRefSchema
});
export type HiloReparadoResponse = z.infer<typeof hiloReparadoSchema>;

export const reconciliationResultSchema = z.strictObject({
  revisados: z.number().int().nonnegative(),
  confirmados: z.number().int().nonnegative(),
  sospechosos: z.array(hiloSospechosoSchema),
  reparados: z.array(hiloReparadoSchema)
});
export type ReconciliationResult = z.infer<typeof reconciliationResultSchema>;

export const developerProgressItemSchema = z.strictObject({
  stageId: z.string(),
  stageName: z.string(),
  sequenceOrder: z.number().int().positive(),
  state: stageStateSchema,
  certifiedAt: z.coerce.date().nullable(),
  projectId: z.string(),
  projectName: z.string(),
  estimatedDelivery: z.coerce.date().nullable()
});
export type DeveloperProgressItem = z.infer<typeof developerProgressItemSchema>;

export const unitNewsEventSchema = z.strictObject({
  id: z.string(),
  eventType: onChainEventTypeSchema,
  toState: stageStateSchema.nullable(),
  txid: txidSchema.nullable(),
  status: onChainEventStatusSchema,
  createdAt: z.coerce.date(),
  stageName: z.string().nullable()
});
export type UnitNewsEvent = z.infer<typeof unitNewsEventSchema>;

export const stageWithThreadSchema = stageSchema.extend({ hasOnChainThread: z.boolean() });
export type StageWithThread = z.infer<typeof stageWithThreadSchema>;

export const evidenceBundleSummarySchema = z.strictObject({
  id: z.string(),
  commitmentHash: sha256HexSchema,
  createdAt: z.coerce.date()
});
export type EvidenceBundleSummary = z.infer<typeof evidenceBundleSummarySchema>;

export const stageEventSummarySchema = z.strictObject({
  eventType: onChainEventTypeSchema,
  toState: stageStateSchema.nullable(),
  commitment: sha256HexSchema.nullable(),
  txid: txidSchema.nullable(),
  status: onChainEventStatusSchema,
  outputRef: outputRefSchema.nullable(),
  createdAt: z.coerce.date()
});
export type StageEventSummary = z.infer<typeof stageEventSummarySchema>;
