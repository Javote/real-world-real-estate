import { createHash } from "node:crypto";
import type { DossierArtifact, DossierStatus } from "@plataforma/shared";
import { commitmentOf } from "../../domain/anchoring.js";

/** Lo que el dossier de una unidad compromete, en el orden en que lo compromete. */
export type Insumos = {
  stages: { id: string; name: string; commitmentHash: string | null; txid: string | null }[];
  evidencia: { id: string; filename: string; sha256Hash: string; txid: string | null }[];
  releases: { id: string; stageNumber: number; commitment: string | null; txid: string | null }[];
};

export function artefactosDe(insumos: Insumos): DossierArtifact[] {
  return [
    ...insumos.stages.map((s) => ({
      kind: "stage" as const,
      referenceId: s.id,
      label: s.name,
      sha256: s.commitmentHash,
      txid: s.txid
    })),
    ...insumos.evidencia.map((e) => ({
      kind: "evidence" as const,
      referenceId: e.id,
      label: e.filename,
      sha256: e.sha256Hash,
      txid: e.txid
    })),
    ...insumos.releases.map((r) => ({
      kind: "release" as const,
      referenceId: r.id,
      label: `#${r.stageNumber}`,
      sha256: r.commitment,
      txid: r.txid
    }))
  ];
}

/** Qué parte de los artefactos tiene un TXID, de 0 a 100. */
export function completitud(artefactos: DossierArtifact[]): number {
  if (artefactos.length === 0) return 0;
  const conPrueba = artefactos.filter((a) => a.txid !== null).length;
  return Math.round((conPrueba / artefactos.length) * 100);
}

// El orden de los artefactos es parte del compromiso.
export function masterHashDe(artefactos: DossierArtifact[]): string {
  const canonico = JSON.stringify(
    artefactos.map((a) => [a.kind, a.referenceId, a.sha256 ?? "", a.txid ?? ""])
  );
  return createHash("sha256").update(canonico).digest("hex");
}

/** Lo guardado: el estado y el hash de la última decisión del notary (vacío si todavía no hubo). */
export type Guardado = { status: DossierStatus; masterHash: string };

/**
 * Un rechazado vuelve a `compiled` cuando lo que compromete ya no es lo que se rechazó
 * (`DOSSIER_TRANSITIONS`). Se calcula al leer: ninguna lectura escribe.
 */
export function estadoVigente(guardado: Guardado, hashActual: string): DossierStatus {
  if (guardado.status === "rejected" && guardado.masterHash !== hashActual) return "compiled";
  return guardado.status;
}

/** Firmar y rechazar parten solo de `compiled`, el vigente. */
export function esperaAlNotary(guardado: Guardado, hashActual: string): boolean {
  return estadoVigente(guardado, hashActual) === "compiled";
}

export function commitmentDeFirma(firma: {
  dossierId: string;
  masterHash: string;
  signedAt: Date;
}): string {
  return commitmentOf({
    dossierId: firma.dossierId,
    masterHash: firma.masterHash,
    signedAt: firma.signedAt.toISOString()
  });
}
