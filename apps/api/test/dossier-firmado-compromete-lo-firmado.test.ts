import { describe, expect, it } from "vitest";
import {
  artefactosDe,
  type Insumos,
  insumosAlFirmar,
  masterHashDe
} from "../src/modules/dossier/rules.js";

const FIRMA = Date.UTC(2026, 9, 31, 20, 22, 11);
const hash = (c: string) => c.repeat(64);

const insumos: Insumos = {
  stages: [{ id: "s1", name: "Proyecto y Registro", commitmentHash: hash("a"), txid: hash("b") }],
  evidencia: [
    {
      id: "e1",
      filename: "plano.pdf",
      sha256Hash: hash("c"),
      txid: hash("d"),
      uploadedAt: new Date(FIRMA - 1)
    },
    {
      id: "e2",
      filename: "foto.png",
      sha256Hash: hash("e"),
      txid: hash("f"),
      uploadedAt: new Date(FIRMA)
    },
    {
      id: "e3",
      filename: "tarde.pdf",
      sha256Hash: hash("1"),
      txid: null,
      uploadedAt: new Date(FIRMA + 1)
    }
  ],
  releases: [
    { id: "r1", stageNumber: 1, commitment: hash("2"), txid: hash("3"), releasedAt: FIRMA - 1 },
    { id: "r2", stageNumber: 10, commitment: hash("4"), txid: hash("5"), releasedAt: FIRMA + 1 }
  ]
};

describe("insumosAlFirmar: un dossier firmado compromete lo que existía al firmarse", () => {
  it("deja la evidencia y las liberaciones hasta el instante de la firma, incluido", () => {
    const alFirmar = insumosAlFirmar(insumos, FIRMA);

    expect(alFirmar.stages).toEqual(insumos.stages);
    expect(alFirmar.evidencia.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(alFirmar.releases.map((r) => r.id)).toEqual(["r1"]);
  });

  it("lo que llega después no cambia el hash maestro de lo firmado", () => {
    const firmado = masterHashDe(artefactosDe(insumosAlFirmar(insumos, FIRMA)));
    const sinLoPosterior = masterHashDe(
      artefactosDe({
        stages: insumos.stages,
        evidencia: insumos.evidencia.slice(0, 2),
        releases: insumos.releases.slice(0, 1)
      })
    );

    expect(firmado).toBe(sinLoPosterior);
    expect(firmado).not.toBe(masterHashDe(artefactosDe(insumos)));
  });
});
