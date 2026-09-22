import { describe, expect, it } from "vitest";
import {
  DOSSIER_STATUSES,
  dossierArtifactSchema,
  dossierRejectResultSchema,
  dossierSchema,
  dossierShareSchema,
  dossierSignResultSchema,
  notarySignatureSchema,
  publicDossierSchema,
  rejectDossierSchema
} from "./dossier";

const artifact = {
  kind: "evidence" as const,
  referenceId: "ev1",
  label: "Permiso de obra",
  sha256: "a".repeat(64),
  txid: null
};

describe("dossierArtifactSchema", () => {
  it("acepta las tres clases y sha256/txid null antes de anclar", () => {
    for (const kind of ["stage", "evidence", "release"] as const) {
      expect(dossierArtifactSchema.safeParse({ ...artifact, kind }).success).toBe(true);
    }
    expect(dossierArtifactSchema.safeParse({ ...artifact, sha256: null, txid: null }).success).toBe(
      true
    );
  });

  it("rechaza un kind que no sea de las tres clases", () => {
    expect(dossierArtifactSchema.safeParse({ ...artifact, kind: "signature" }).success).toBe(false);
  });
});

describe("dossierSchema", () => {
  it("acepta los tres estados y completeness acotado a 0-100", () => {
    for (const status of DOSSIER_STATUSES) {
      expect(
        dossierSchema.safeParse({
          id: "d1",
          unitId: "u1",
          unitReference: "A-101",
          projectId: "p1",
          projectName: "Torre Norte",
          masterHash: "a".repeat(64),
          compiledAt: new Date().toISOString(),
          status,
          artifacts: [artifact],
          completeness: 80,
          signatureTxid: null,
          signedAt: null,
          rejectionNote: null
        }).success
      ).toBe(true);
    }
  });
});

describe("dossierShareSchema", () => {
  it("acepta la respuesta de compartir con el path público", () => {
    expect(
      dossierShareSchema.safeParse({
        shareToken: "a".repeat(64),
        path: "/public/dossier/abc",
        masterHash: "a".repeat(64)
      }).success
    ).toBe(true);
  });
});

describe("notarySignatureSchema", () => {
  it("signedAt/signatureTxid son null mientras no está firmado", () => {
    expect(
      notarySignatureSchema.safeParse({
        dossierId: "d1",
        unitReference: "A-101",
        projectName: "Torre Norte",
        masterHash: "a".repeat(64),
        signatureTxid: null,
        signedAt: null,
        status: "compiled"
      }).success
    ).toBe(true);
  });
});

describe("rejectDossierSchema", () => {
  it("exige una nota no vacía y no más de 2000 caracteres", () => {
    expect(rejectDossierSchema.safeParse({ note: "" }).success).toBe(false);
    expect(rejectDossierSchema.safeParse({ note: "x".repeat(2001) }).success).toBe(false);
    expect(rejectDossierSchema.safeParse({ note: "falta la firma del escribano" }).success).toBe(
      true
    );
  });
});

describe("dossierSignResultSchema", () => {
  it("el camino idempotente no manda signedAt ni anchor", () => {
    expect(
      dossierSignResultSchema.safeParse({ dossierId: "d1", masterHash: "a".repeat(64) }).success
    ).toBe(true);
  });
});

describe("dossierRejectResultSchema", () => {
  it("status es siempre el literal 'rejected'", () => {
    expect(
      dossierRejectResultSchema.safeParse({ dossierId: "d1", status: "rejected" }).success
    ).toBe(true);
    expect(dossierRejectResultSchema.safeParse({ dossierId: "d1", status: "signed" }).success).toBe(
      false
    );
  });
});

describe("publicDossierSchema", () => {
  it("no trae id/unitId/projectId/rejectionNote — sin sesión, recortado a propósito", () => {
    const fila = {
      unitReference: "A-101",
      projectName: "Torre Norte",
      masterHash: "a".repeat(64),
      compiledAt: new Date().toISOString(),
      status: "compiled" as const,
      completeness: 50,
      signatureTxid: null,
      signedAt: null,
      artifacts: [artifact]
    };
    expect(publicDossierSchema.safeParse(fila).success).toBe(true);
    expect(publicDossierSchema.safeParse({ ...fila, id: "d1" }).success).toBe(false);
  });
});
