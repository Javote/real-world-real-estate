import { describe, expect, it } from "vitest";
import {
  createInvitationSchema,
  INVITATION_STATUSES,
  investorInvitationDetailSchema,
  invitationSchema
} from "./invitation";

describe("createInvitationSchema", () => {
  it("acepta una invitación válida", () => {
    expect(
      createInvitationSchema.safeParse({
        unitId: "u1",
        investorEmail: "inv@example.com",
        amountMinorUnits: 100_000,
        currency: "USD"
      }).success
    ).toBe(true);
  });

  it("rechaza un monto no positivo y una moneda que no sea de 3 letras", () => {
    expect(
      createInvitationSchema.safeParse({
        unitId: "u1",
        investorEmail: "inv@example.com",
        amountMinorUnits: 0,
        currency: "USD"
      }).success
    ).toBe(false);
    expect(
      createInvitationSchema.safeParse({
        unitId: "u1",
        investorEmail: "inv@example.com",
        amountMinorUnits: 100,
        currency: "US"
      }).success
    ).toBe(false);
  });
});

const invitacionBase = {
  id: "i1",
  projectId: "p1",
  unitId: "u1",
  investorEmail: "inv@example.com",
  amountMinorUnits: 100,
  currency: "USD",
  status: "pending" as const,
  createdById: "dev1",
  createdAt: new Date().toISOString(),
  respondedAt: null
};

describe("invitationSchema", () => {
  it("acepta los tres estados reales", () => {
    for (const status of INVITATION_STATUSES) {
      expect(invitationSchema.safeParse({ ...invitacionBase, status }).success).toBe(true);
    }
  });

  it("respondedAt viaja como epoch ms crudo, no como Date coercionado", () => {
    expect(
      invitationSchema.safeParse({ ...invitacionBase, respondedAt: 1700000000000 }).success
    ).toBe(true);
    expect(
      invitationSchema.safeParse({ ...invitacionBase, respondedAt: new Date().toISOString() })
        .success
    ).toBe(false);
  });

  it("createdById puede ser null", () => {
    expect(invitationSchema.safeParse({ ...invitacionBase, createdById: null }).success).toBe(true);
  });
});

describe("investorInvitationDetailSchema", () => {
  it("acepta la forma recortada que ve el investor", () => {
    expect(
      investorInvitationDetailSchema.safeParse({
        id: "i1",
        investorEmail: "inv@example.com",
        amountMinorUnits: 100,
        currency: "USD",
        status: "pending",
        createdAt: new Date().toISOString(),
        unitReference: "A-101",
        projectName: "Torre Norte"
      }).success
    ).toBe(true);
  });

  it("rechaza un status fuera del dominio", () => {
    expect(
      investorInvitationDetailSchema.safeParse({
        id: "i1",
        investorEmail: "inv@example.com",
        amountMinorUnits: 100,
        currency: "USD",
        status: "expired",
        createdAt: new Date().toISOString(),
        unitReference: "A-101",
        projectName: "Torre Norte"
      }).success
    ).toBe(false);
  });
});
