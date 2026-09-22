import { describe, expect, it } from "vitest";
import {
  buildingSchematicFloorSchema,
  createUnitSchema,
  developerUnitDirectoryEntrySchema,
  investorUnitDetailSchema,
  investorUnitListItemSchema,
  investorUnitStageSchema,
  UNIT_STATUSES,
  unitSchema,
  updateUnitSchema
} from "./unit";

describe("createUnitSchema", () => {
  it("acepta el mínimo — solo unitReference es obligatorio", () => {
    expect(createUnitSchema.safeParse({ unitReference: "A-101" }).success).toBe(true);
  });

  it("rechaza claves desconocidas y un unitReference vacío o demasiado largo", () => {
    expect(createUnitSchema.safeParse({ unitReference: "" }).success).toBe(false);
    expect(createUnitSchema.safeParse({ unitReference: "x".repeat(21) }).success).toBe(false);
    expect(createUnitSchema.safeParse({ unitReference: "A-101", extra: "no" }).success).toBe(false);
  });
});

describe("updateUnitSchema", () => {
  it("no acepta unitReference — no se renombra una unidad", () => {
    expect(updateUnitSchema.safeParse({ status: "sold", unitReference: "B-202" }).success).toBe(
      false
    );
    expect(updateUnitSchema.safeParse({ status: "sold" }).success).toBe(true);
  });
});

describe("buildingSchematicFloorSchema", () => {
  it("floor null agrupa las unidades sin piso asignado", () => {
    expect(
      buildingSchematicFloorSchema.safeParse({
        floor: null,
        units: [{ id: "u1", unitReference: "A-101", floor: null, status: "available" }]
      }).success
    ).toBe(true);
  });
});

describe("unitSchema", () => {
  it("acepta las cuatro estados reales de Unit.status", () => {
    for (const status of UNIT_STATUSES) {
      expect(
        unitSchema.safeParse({
          id: "u1",
          projectId: "p1",
          unitReference: "A-101",
          status,
          floor: 1,
          sizeM2: 60,
          priceMinorUnits: 100_000,
          currency: "USD",
          investorId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).success
      ).toBe(true);
    }
  });
});

describe("developerUnitDirectoryEntrySchema", () => {
  it("acepta el inventario cross-proyecto", () => {
    expect(
      developerUnitDirectoryEntrySchema.safeParse({
        id: "u1",
        unitReference: "A-101",
        status: "available",
        priceMinorUnits: null,
        currency: null,
        investorId: null,
        projectId: "p1",
        projectName: "Torre Norte"
      }).success
    ).toBe(true);
  });
});

describe("investorUnitListItemSchema", () => {
  it("progress está acotado a 0-100", () => {
    expect(
      investorUnitListItemSchema.safeParse({
        id: "u1",
        unitReference: "A-101",
        status: "sold",
        sizeM2: 60,
        priceMinorUnits: 100_000,
        currency: "USD",
        projectId: "p1",
        projectName: "Torre Norte",
        city: "CABA",
        progress: 101
      }).success
    ).toBe(false);
  });
});

describe("investorUnitStageSchema y investorUnitDetailSchema", () => {
  it("una unidad con sus stages y el anclaje de cada uno", () => {
    const stage = {
      stageId: "s1",
      name: "Cimentación",
      sequenceOrder: 1,
      state: "Pending" as const,
      bundleId: null,
      txid: null
    };
    expect(investorUnitStageSchema.safeParse(stage).success).toBe(true);
    expect(
      investorUnitDetailSchema.safeParse({
        id: "u1",
        unitReference: "A-101",
        status: "sold",
        sizeM2: 60,
        floor: 1,
        priceMinorUnits: 100_000,
        currency: "USD",
        investorId: "inv1",
        projectId: "p1",
        projectName: "Torre Norte",
        city: "CABA",
        country: "AR",
        stages: [stage]
      }).success
    ).toBe(true);
  });
});
