import { describe, expect, it } from "vitest";
import {
  acceptInvitationResultSchema,
  contractReleaseSchema,
  contractSchema,
  developerContractSchema,
  investorContractSchema,
  paymentAttestationSchema,
  paymentReleaseResultSchema,
  releasePaymentSchema
} from "./contract";

const anchor = {
  id: "e1",
  projectId: "p1",
  stageId: "s1",
  evidenceId: null,
  referenceId: null,
  eventIndex: 0,
  eventType: "PAYMENT_RELEASE" as const,
  fromState: null,
  toState: null,
  commitment: null,
  status: "Confirmed" as const,
  txid: "a".repeat(64),
  network: "Preprod",
  outputRef: "abc#0",
  blockTimestamp: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

describe("releasePaymentSchema", () => {
  it("rechaza un monto no positivo", () => {
    expect(releasePaymentSchema.safeParse({ amountMinorUnits: 0 }).success).toBe(false);
    expect(releasePaymentSchema.safeParse({ amountMinorUnits: 100 }).success).toBe(true);
  });
});

describe("developerContractSchema", () => {
  it("signedAt es epoch ms crudo, no un Date coercionado", () => {
    const fila = {
      id: "c1",
      totalMinorUnits: 100_000,
      currency: "USD",
      signedAt: 1_700_000_000_000,
      unitId: "u1",
      unitReference: "A-101",
      unitStatus: "sold" as const,
      investorName: "Inversor Uno",
      txid: null,
      commitment: null
    };
    expect(developerContractSchema.safeParse(fila).success).toBe(true);
    expect(
      developerContractSchema.safeParse({ ...fila, signedAt: new Date().toISOString() }).success
    ).toBe(false);
  });
});

describe("paymentAttestationSchema y paymentReleaseResultSchema", () => {
  const attestation = {
    id: "pa1",
    contractId: "c1",
    stageNumber: 1,
    amountMinorUnits: 100,
    releasedById: "dev1",
    releasedAt: 1_700_000_000_000
  };

  it("acepta la atestación y su resultado extendido con el anchor", () => {
    expect(paymentAttestationSchema.safeParse(attestation).success).toBe(true);
    expect(paymentReleaseResultSchema.safeParse({ ...attestation, anchor }).success).toBe(true);
  });

  it("rechaza un stageNumber no positivo", () => {
    expect(paymentAttestationSchema.safeParse({ ...attestation, stageNumber: 0 }).success).toBe(
      false
    );
  });
});

describe("contractSchema y acceptInvitationResultSchema", () => {
  const contrato = {
    id: "c1",
    unitId: "u1",
    investorId: "inv1",
    totalMinorUnits: 100_000,
    currency: "USD",
    signedAt: null,
    createdAt: new Date().toISOString()
  };

  it("signedAt es null antes de firmar", () => {
    expect(contractSchema.safeParse(contrato).success).toBe(true);
  });

  it("el resultado de aceptar trae el contrato y su anchor", () => {
    expect(acceptInvitationResultSchema.safeParse({ contract: contrato, anchor }).success).toBe(
      true
    );
  });
});

describe("investorContractSchema", () => {
  it("acepta la forma recortada del investor", () => {
    expect(
      investorContractSchema.safeParse({
        id: "c1",
        totalMinorUnits: 100_000,
        currency: "USD",
        signedAt: null,
        investorId: "inv1",
        unitReference: "A-101"
      }).success
    ).toBe(true);
  });
});

describe("contractReleaseSchema", () => {
  it("anchorStatus es null cuando el leftJoin no encuentra el evento", () => {
    expect(
      contractReleaseSchema.safeParse({
        id: "r1",
        stageNumber: 1,
        amountMinorUnits: 100,
        releasedAt: 1_700_000_000_000,
        commitment: null,
        txid: null,
        anchorStatus: null
      }).success
    ).toBe(true);
  });

  it("rechaza un anchorStatus fuera de los tres reales", () => {
    expect(
      contractReleaseSchema.safeParse({
        id: "r1",
        stageNumber: 1,
        amountMinorUnits: 100,
        releasedAt: 1_700_000_000_000,
        commitment: null,
        txid: null,
        anchorStatus: "Broadcasting"
      }).success
    ).toBe(false);
  });
});
