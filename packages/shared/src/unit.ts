import { z } from "zod";
import { stageStateSchema } from "./stage";

// La unidad comercial de un proyecto (M2-D5 filas 39, 40-41, 44, 44b).

/** Espeja `Unit.status` en la migración. */
export const UNIT_STATUSES = ["available", "reserved", "sold", "delivered"] as const;
export const unitStatusSchema = z.enum(UNIT_STATUSES);
export type UnitStatus = z.infer<typeof unitStatusSchema>;

/** Body de `POST /developer/projects/:id/units`. */
export const createUnitSchema = z.strictObject({
  unitReference: z.string().min(1).max(20),
  floor: z.number().int().optional(),
  sizeM2: z.number().int().positive().optional(),
  // Entero en unidades mínimas: nunca un decimal para dinero (regla 1).
  priceMinorUnits: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional()
});
export type CreateUnitInput = z.infer<typeof createUnitSchema>;

/** Body de `PATCH /developer/units/:id`. Sin `unitReference`: no se renombra. */
export const updateUnitSchema = z.strictObject({
  status: unitStatusSchema.optional(),
  floor: z.number().int().optional(),
  sizeM2: z.number().int().positive().optional(),
  priceMinorUnits: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional()
});
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;

/** Fila 21 — `GET /projects/:id/building-schematic`, agrupado por piso. */
export const buildingSchematicFloorSchema = z.strictObject({
  /** `null` agrupa las unidades sin piso asignado, al final. */
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

/** La fila de `Unit` completa (`selectAll()`/`returningAll()`). */
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

/** Fila 44 — `GET /developer/units`: el inventario cross-proyecto. */
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

/** Fila 14 — `GET /investor/units`: las unidades del investor autenticado. */
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
  progress: z.number().int().min(0).max(100)
});
export type InvestorUnitListItem = z.infer<typeof investorUnitListItemSchema>;

/** Un stage del proyecto, con su anclaje — lo que alimenta los `StageChip` (P9). */
export const investorUnitStageSchema = z.strictObject({
  stageId: z.string(),
  name: z.string(),
  sequenceOrder: z.number().int().positive(),
  state: stageStateSchema,
  bundleId: z.string().nullable(),
  txid: z.string().nullable()
});
export type InvestorUnitStage = z.infer<typeof investorUnitStageSchema>;

/** Filas 15-18 — `GET /investor/units/:id`: la unidad con los stages de su proyecto. */
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
