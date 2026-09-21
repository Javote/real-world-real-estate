import { describe, expect, it } from "vitest";
import { evidenceRejectionSchema } from "./evidence-files";
import {
  detectarTipoDeEvidencia,
  EVIDENCE_ALLOWED_MIME,
  EVIDENCE_MAX_FILE_BYTES,
  EVIDENCE_MAX_FILE_MB,
  EVIDENCE_MAX_FILES,
  EVIDENCE_REJECTION_CODES,
  EVIDENCE_SIGNATURE_BYTES
} from "./evidence-rules";

const bytes = (...b: number[]) => Uint8Array.from(b);

describe("detectarTipoDeEvidencia (SPEC-218)", () => {
  it("reconoce un PDF por `%PDF-`", () => {
    expect(detectarTipoDeEvidencia(Buffer.from("%PDF-1.4\n..."))).toBe("application/pdf");
  });

  it("reconoce un JPEG por FF D8 FF", () => {
    expect(detectarTipoDeEvidencia(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe("image/jpeg");
  });

  it("reconoce un PNG por su firma de 8 bytes", () => {
    expect(detectarTipoDeEvidencia(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe(
      "image/png"
    );
  });

  it("un ejecutable de Windows (`MZ`) no es ninguno de los tres", () => {
    expect(detectarTipoDeEvidencia(Buffer.from("MZ\x90\x00 ejecutable"))).toBeNull();
  });

  it("un archivo vacío no es nada", () => {
    expect(detectarTipoDeEvidencia(new Uint8Array(0))).toBeNull();
  });

  it("menos bytes de los que pide la firma no alcanza (un PNG cortado a 4 bytes)", () => {
    expect(detectarTipoDeEvidencia(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
  });

  it("un texto que dice ser PDF pero no empieza con `%PDF-` no lo es", () => {
    expect(detectarTipoDeEvidencia(Buffer.from(" %PDF-1.4"))).toBeNull();
  });

  it("EVIDENCE_SIGNATURE_BYTES alcanza para la firma más larga", () => {
    expect(EVIDENCE_SIGNATURE_BYTES).toBe(8);
  });
});

describe("las constantes de la subida (SPEC-218)", () => {
  it("los tres tipos de la regla 10, el tope de 10 archivos y los 50 MB", () => {
    expect([...EVIDENCE_ALLOWED_MIME]).toEqual(["application/pdf", "image/jpeg", "image/png"]);
    expect(EVIDENCE_MAX_FILES).toBe(10);
    expect(EVIDENCE_MAX_FILE_MB).toBe(50);
    expect(EVIDENCE_MAX_FILE_BYTES).toBe(50 * 1024 * 1024);
  });

  it("un rechazo lleva la posición y un código de la lista, y nada más", () => {
    for (const code of EVIDENCE_REJECTION_CODES) {
      expect(evidenceRejectionSchema.safeParse({ index: 0, code }).success).toBe(true);
    }
    expect(evidenceRejectionSchema.safeParse({ index: 0, code: "OTRO" }).success).toBe(false);
    expect(
      evidenceRejectionSchema.safeParse({ index: -1, code: "UNSUPPORTED_FILE_TYPE" }).success
    ).toBe(false);
    // Sin nombre de archivo: la regla 2 aplica a lo que sale, no solo a lo que se guarda.
    expect(
      evidenceRejectionSchema.safeParse({ index: 0, code: "UNSUPPORTED_FILE_TYPE", filename: "x" })
        .success
    ).toBe(false);
  });
});

describe("evidence-rules no depende de nada (SPEC-218)", () => {
  it("no importa Zod ni ningún otro módulo: el front lo carga sin arrastrar el contrato entero", async () => {
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync(new URL("./evidence-rules.ts", import.meta.url), "utf8");
    // Ninguna línea de código empieza con `import`/`require`: solo comentarios pueden nombrarlos.
    expect(
      fuente.split("\n").filter((l) => /^\s*(import|export .* from|.*require\()/.test(l))
    ).toEqual([]);
  });
});
