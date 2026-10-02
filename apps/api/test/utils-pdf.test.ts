import { describe, expect, it } from "vitest";
import { renderTextPdf } from "../src/utils/pdf";

describe("renderTextPdf — envolver", () => {
  it("una línea corta no se corta", () => {
    const pdf = renderTextPdf([`hash: ${"a".repeat(10)}`]);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("una línea más larga que el ancho se corta en varias, en vez de salirse de la página", () => {
    const lineaLarga = `commitment: ${"f".repeat(120)}`;
    const pdf = renderTextPdf([lineaLarga]);

    const cuerpo = pdf.toString("latin1");
    expect(cuerpo).not.toContain(`(${lineaLarga})`);
    expect(cuerpo).toContain("Tj T*");
  });
});
