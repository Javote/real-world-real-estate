import { describe, expect, it } from "vitest";
import {
  certifierCertificateSchema,
  certifierEvidenceSchema,
  certifierInvitationSchema,
  certifierStageViewSchema,
  inviteCertifierSchema
} from "./certifier";

describe("certifierEvidenceSchema", () => {
  it("sha256Hash es null mientras no se termina de hashear", () => {
    expect(
      certifierEvidenceSchema.safeParse({
        id: "e1",
        originalFilename: "plano.pdf",
        category: "planos",
        authoritative: true,
        sha256Hash: null,
        uploadedAt: new Date().toISOString()
      }).success
    ).toBe(true);
  });
});

describe("certifierStageViewSchema", () => {
  it("acepta un stage sin evidencia — el empty-state es diseño, no error", () => {
    expect(
      certifierStageViewSchema.safeParse({
        id: "s1",
        name: "Cimentación",
        sequenceOrder: 1,
        state: "Pending",
        validationCritical: true,
        projectId: "p1",
        projectName: "Torre Norte",
        evidence: []
      }).success
    ).toBe(true);
  });

  it("rechaza un state fuera de la FSM", () => {
    expect(
      certifierStageViewSchema.safeParse({
        id: "s1",
        name: "Cimentación",
        sequenceOrder: 1,
        state: "Cancelled",
        validationCritical: true,
        projectId: "p1",
        projectName: "Torre Norte",
        evidence: []
      }).success
    ).toBe(false);
  });
});

describe("certifierCertificateSchema", () => {
  it("txid null implica estado Pendiente — nunca se afirma Certificado sin TXID (regla 17)", () => {
    expect(
      certifierCertificateSchema.safeParse({
        stageId: "s1",
        stageName: "Cimentación",
        projectName: "Torre Norte",
        certifiedAt: null,
        commitmentHash: null,
        txid: null,
        anchorStatus: null
      }).success
    ).toBe(true);
  });

  it("rechaza un anchorStatus que no sea uno de los tres reales", () => {
    expect(
      certifierCertificateSchema.safeParse({
        stageId: "s1",
        stageName: "Cimentación",
        projectName: "Torre Norte",
        certifiedAt: null,
        commitmentHash: null,
        txid: null,
        anchorStatus: "Broadcasting"
      }).success
    ).toBe(false);
  });
});

describe("inviteCertifierSchema", () => {
  it("rechaza un certifierId vacío", () => {
    expect(inviteCertifierSchema.safeParse({ certifierId: "" }).success).toBe(false);
    expect(inviteCertifierSchema.safeParse({ certifierId: "u1" }).success).toBe(true);
  });
});

describe("certifierInvitationSchema", () => {
  it("respondedAt es null mientras la invitación sigue pendiente", () => {
    expect(
      certifierInvitationSchema.safeParse({
        id: "ci1",
        projectId: "p1",
        projectName: "Torre Norte",
        certifierId: "u1",
        certifierName: "Cert Uno",
        status: "pending",
        createdAt: new Date().toISOString(),
        respondedAt: null
      }).success
    ).toBe(true);
  });

  it("rechaza un status que no sea de los tres de la invitación", () => {
    expect(
      certifierInvitationSchema.safeParse({
        id: "ci1",
        projectId: "p1",
        projectName: "Torre Norte",
        certifierId: "u1",
        certifierName: "Cert Uno",
        status: "expired",
        createdAt: new Date().toISOString(),
        respondedAt: null
      }).success
    ).toBe(false);
  });
});
