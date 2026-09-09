import { z } from "zod";

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
