import { describe, expect, it } from "vitest";
import {
  capitalByProjectSchema,
  capitalMonthlyPointSchema,
  capitalSummarySchema,
  investorDirectoryEntrySchema
} from "./capital";

describe("capitalSummarySchema", () => {
  it("acepta un resumen con moneda única", () => {
    expect(
      capitalSummarySchema.safeParse({
        raisedMinorUnits: 500_000,
        releasedMinorUnits: 100_000,
        pendingMinorUnits: 400_000,
        contracts: 3,
        currency: "USD"
      }).success
    ).toBe(true);
  });

  it("currency es null cuando conviven varias monedas — no se convierte nada", () => {
    expect(
      capitalSummarySchema.safeParse({
        raisedMinorUnits: 0,
        releasedMinorUnits: 0,
        pendingMinorUnits: 0,
        contracts: 0,
        currency: null
      }).success
    ).toBe(true);
  });

  it("rechaza montos negativos", () => {
    expect(
      capitalSummarySchema.safeParse({
        raisedMinorUnits: -1,
        releasedMinorUnits: 0,
        pendingMinorUnits: 0,
        contracts: 0,
        currency: null
      }).success
    ).toBe(false);
  });
});

describe("capitalMonthlyPointSchema", () => {
  it("acepta el mes en formato YYYY-MM", () => {
    expect(
      capitalMonthlyPointSchema.safeParse({
        month: "2026-09",
        raisedMinorUnits: 100,
        releasedMinorUnits: 0
      }).success
    ).toBe(true);
  });

  it("rechaza un mes con otro formato", () => {
    expect(
      capitalMonthlyPointSchema.safeParse({
        month: "09-2026",
        raisedMinorUnits: 100,
        releasedMinorUnits: 0
      }).success
    ).toBe(false);
  });
});

describe("capitalByProjectSchema", () => {
  it("acepta la fila completa, con investors distinto de unitsSold", () => {
    expect(
      capitalByProjectSchema.safeParse({
        projectId: "p1",
        projectName: "Torre Norte",
        raisedMinorUnits: 500,
        releasedMinorUnits: 100,
        unitsSold: 2,
        totalUnits: 10,
        investors: 1,
        currency: "USD"
      }).success
    ).toBe(true);
  });

  it("rechaza unitsSold no entero", () => {
    expect(
      capitalByProjectSchema.safeParse({
        projectId: "p1",
        projectName: "Torre Norte",
        raisedMinorUnits: 500,
        releasedMinorUnits: 100,
        unitsSold: 2.5,
        totalUnits: 10,
        investors: 1,
        currency: "USD"
      }).success
    ).toBe(false);
  });
});

describe("investorDirectoryEntrySchema", () => {
  it("acepta un investor con varios proyectos", () => {
    expect(
      investorDirectoryEntrySchema.safeParse({
        id: "u1",
        fullName: "Inversor Uno",
        email: "inv@example.com",
        units: 2,
        investedMinorUnits: 500,
        currency: "USD",
        projects: ["p1", "p2"]
      }).success
    ).toBe(true);
  });

  it("rechaza projects que no sea un array de strings", () => {
    expect(
      investorDirectoryEntrySchema.safeParse({
        id: "u1",
        fullName: "Inversor Uno",
        email: "inv@example.com",
        units: 2,
        investedMinorUnits: 500,
        currency: "USD",
        projects: "p1"
      }).success
    ).toBe(false);
  });
});
