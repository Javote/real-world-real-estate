import { z } from "zod";
import { txidSchema } from "./hashes";
import { stageStateSchema } from "./stage";

export const UNIT_STATUSES = ["available", "reserved", "sold", "delivered"] as const;
export const unitStatusSchema = z.enum(UNIT_STATUSES);
export type UnitStatus = z.infer<typeof unitStatusSchema>;

export const createUnitSchema = z.strictObject({
  unitReference: z.string().min(1).max(20),
  floor: z.number().int().optional(),
  sizeM2: z.number().int().positive().optional(),
  priceMinorUnits: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional()
});
export type CreateUnitInput = z.infer<typeof createUnitSchema>;

export const updateUnitSchema = z.strictObject({
  floor: z.number().int().optional(),
  sizeM2: z.number().int().positive().optional(),
  priceMinorUnits: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional()
});
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;

export const buildingSchematicFloorSchema = z.strictObject({
  floor: z.number().int().nullable(),
  units: z.array(
    z.strictObject({
      id: z.string(),
      unitReference: z.string(),
      floor: z.number().int().nullable(),
      status: unitStatusSchema
    })
  )
});
export type BuildingSchematicFloor = z.infer<typeof buildingSchematicFloorSchema>;

export const unitSchema = z.strictObject({
  id: z.string(),
  projectId: z.string(),
  unitReference: z.string(),
  status: unitStatusSchema,
  floor: z.number().int().nullable(),
  sizeM2: z.number().int().positive().nullable(),
  priceMinorUnits: z.number().int().nonnegative().nullable(),
  currency: z.string().nullable(),
  investorId: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type UnitResponse = z.infer<typeof unitSchema>;

export const developerUnitDirectoryEntrySchema = z.strictObject({
  id: z.string(),
  unitReference: z.string(),
  status: unitStatusSchema,
  priceMinorUnits: z.number().int().nonnegative().nullable(),
  currency: z.string().nullable(),
  investorId: z.string().nullable(),
  projectId: z.string(),
  projectName: z.string()
});
export type DeveloperUnitDirectoryEntry = z.infer<typeof developerUnitDirectoryEntrySchema>;

export const investorUnitListItemSchema = z.strictObject({
  id: z.string(),
  unitReference: z.string(),
  status: unitStatusSchema,
  sizeM2: z.number().int().positive().nullable(),
  priceMinorUnits: z.number().int().nonnegative().nullable(),
  currency: z.string().nullable(),
  projectId: z.string(),
  projectName: z.string(),
  city: z.string().nullable(),
  coverUpdatedAt: z.coerce.date().nullable(),
  progress: z.number().int().min(0).max(100)
});
export type InvestorUnitListItem = z.infer<typeof investorUnitListItemSchema>;

export const investorUnitStageSchema = z.strictObject({
  stageId: z.string(),
  name: z.string(),
  sequenceOrder: z.number().int().positive(),
  state: stageStateSchema,
  bundleId: z.string().nullable(),
  txid: txidSchema.nullable()
});
export type InvestorUnitStage = z.infer<typeof investorUnitStageSchema>;

export const investorUnitDetailSchema = z.strictObject({
  id: z.string(),
  unitReference: z.string(),
  status: unitStatusSchema,
  sizeM2: z.number().int().positive().nullable(),
  floor: z.number().int().nullable(),
  priceMinorUnits: z.number().int().nonnegative().nullable(),
  currency: z.string().nullable(),
  investorId: z.string().nullable(),
  projectId: z.string(),
  projectName: z.string(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  stages: z.array(investorUnitStageSchema)
});
export type InvestorUnitDetail = z.infer<typeof investorUnitDetailSchema>;
