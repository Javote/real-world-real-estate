import { z } from "zod";
import { sha256HexSchema } from "./hashes";
import { type StageState, stageStateSchema } from "./stage";

export const MAX_REF_BYTES = 32;

export const COMMITMENT_HEX_LENGTH = 64;

export const refSchema = z
  .string()
  .regex(/^[\x21-\x7e]+$/, "una ref solo puede ser ASCII imprimible sin espacios")
  .max(MAX_REF_BYTES);

export const commitmentSchema = z.union([z.literal(""), sha256HexSchema]);

export const stageDatumSchema = z.strictObject({
  projectRef: z.string().regex(/^([0-9a-f]{2})+$/),
  stageRef: z.string().regex(/^([0-9a-f]{2})+$/),
  sequenceOrder: z.number().int().positive(),
  validationCritical: z.boolean(),
  state: stageStateSchema,
  evidenceRoot: commitmentSchema,
  completedAt: z.number().int().nonnegative()
});

export type StageDatum = z.infer<typeof stageDatumSchema>;

export function refToHex(id: string): string {
  const ref = refSchema.parse(id);
  let hex = "";
  for (let i = 0; i < ref.length; i += 1) {
    hex += ref.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return hex;
}

export function hexToRef(hex: string): string {
  if (!/^([0-9a-f]{2})+$/.test(hex) || hex.length > MAX_REF_BYTES * 2) {
    throw new Error(
      `hexToRef espera pares hex minúscula, de a lo sumo ${MAX_REF_BYTES} bytes, y llegó: ${hex}`
    );
  }
  let ref = "";
  for (let i = 0; i < hex.length; i += 2) {
    ref += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16));
  }
  return refSchema.parse(ref);
}

export interface StageDatumSource {
  id: string;
  projectId: string;
  sequenceOrder: number;
  validationCritical: boolean;
  state: StageState;
  evidenceRoot?: string | null;
  completedAt?: number | null;
}

export function buildStageDatum(source: StageDatumSource): StageDatum {
  return stageDatumSchema.parse({
    projectRef: refToHex(source.projectId),
    stageRef: refToHex(source.id),
    sequenceOrder: source.sequenceOrder,
    validationCritical: source.validationCritical,
    state: source.state,
    evidenceRoot: source.evidenceRoot ?? "",
    completedAt: source.completedAt ?? 0
  });
}

export function isValidInitialDatum(datum: StageDatum): boolean {
  return (
    datum.state === "Pending" &&
    datum.evidenceRoot === "" &&
    datum.completedAt === 0 &&
    datum.sequenceOrder > 0 &&
    datum.projectRef.length > 0 &&
    datum.stageRef.length > 0
  );
}

export function canCompleteWithEvidence(
  validationCritical: boolean,
  evidenceRoot: string
): boolean {
  return !validationCritical || evidenceRoot.length === COMMITMENT_HEX_LENGTH;
}
