import { describe, expect, it } from "vitest";
import {
  certifierAssignmentSchema,
  certifierKpisSchema,
  developerKpisSchema,
  notaryKpisSchema,
  pendingDossierSchema
} from "./panels";

describe("developerKpisSchema", () => {
  it("acepta KPIs pendientes como null, no cero — cero mentiría con precisión decimal", () => {
    expect(
      developerKpisSchema.safeParse({
        activeProjects: 2,
        totalUnits: null,
        capitalRaisedMinorUnits: null,
        averageProgress: 40,
        verifiedDocuments: 5
      }).success
    ).toBe(true);
  });

  it("averageProgress está acotado a 0-100", () => {
    expect(
      developerKpisSchema.safeParse({
        activeProjects: 0,
        totalUnits: null,
        capitalRaisedMinorUnits: null,
        averageProgress: 101,
        verifiedDocuments: 0
      }).success
    ).toBe(false);
  });
});

describe("certifierKpisSchema", () => {
  it("acepta los cuatro contadores", () => {
    expect(
      certifierKpisSchema.safeParse({
        assigned: 3,
        certified: 1,
        observed: 1,
        totalStages: 5
      }).success
    ).toBe(true);
  });

  it("rechaza un contador negativo", () => {
    expect(
      certifierKpisSchema.safeParse({
        assigned: -1,
        certified: 1,
        observed: 1,
        totalStages: 5
      }).success
    ).toBe(false);
  });
});

describe("certifierAssignmentSchema", () => {
  it("sequenceOrder es positivo, nunca cero", () => {
    expect(
      certifierAssignmentSchema.safeParse({
        stageId: "s1",
        projectName: "Torre Norte",
        stageName: "Cimentación",
        sequenceOrder: 1
      }).success
    ).toBe(true);
    expect(
      certifierAssignmentSchema.safeParse({
        stageId: "s1",
        projectName: "Torre Norte",
        stageName: "Cimentación",
        sequenceOrder: 0
      }).success
    ).toBe(false);
  });
});

describe("notaryKpisSchema", () => {
  it("los cuatro campos son nullable", () => {
    expect(
      notaryKpisSchema.safeParse({
        pendingDossiers: null,
        verified: null,
        signed: null,
        unitsUnderReview: null
      }).success
    ).toBe(true);
  });
});

describe("pendingDossierSchema", () => {
  it("completeness está acotado a 0-100", () => {
    expect(
      pendingDossierSchema.safeParse({
        dossierId: "d1",
        unitLabel: "A-101",
        investorName: "Inversor Uno",
        completeness: 60
      }).success
    ).toBe(true);
    expect(
      pendingDossierSchema.safeParse({
        dossierId: "d1",
        unitLabel: "A-101",
        investorName: "Inversor Uno",
        completeness: -1
      }).success
    ).toBe(false);
  });
});
