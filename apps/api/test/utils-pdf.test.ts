import { describe, expect, it } from "vitest";
import { renderTextPdf } from "../src/utils/pdf.js";

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

describe("renderTextPdf — caracteres fuera de ASCII", () => {
  const cuerpoDe = (linea: string) => renderTextPdf([linea]).toString("latin1");

  it("la fuente declara WinAnsi, para que los códigos de 0x80 a 0xFF se lean como tales", () => {
    expect(cuerpoDe("x")).toContain("/BaseFont /Courier /Encoding /WinAnsiEncoding");
  });

  it("la referencia de una unidad sale entera: `·` y `°` en octal, no `?`", () => {
    expect(cuerpoDe("UF 12 · 5°A")).toContain("(UF 12 \\267 5\\260A) Tj");
  });

  it("los acentos y la eñe se conservan", () => {
    expect(cuerpoDe("Ejecución y División, año")).toContain(
      "(Ejecuci\\363n y Divisi\\363n, a\\361o) Tj"
    );
  });

  it("lo de WinAnsi que no es Latin-1 usa su código propio", () => {
    expect(cuerpoDe("a — b … €")).toContain("(a \\227 b \\205 \\200) Tj");
  });

  it("una letra con tilde que WinAnsi no tiene cae a su letra base", () => {
    expect(cuerpoDe("Erdős")).toContain("(Erdos) Tj");
  });

  it("lo que no tiene forma en WinAnsi es `?`, sin partir un emoji en dos", () => {
    expect(cuerpoDe("ok ✓ 🏠")).toContain("(ok ? ?) Tj");
  });

  it("los delimitadores de un string de PDF se escapan", () => {
    expect(cuerpoDe("(a\\b)")).toContain("(\\(a\\\\b\\)) Tj");
  });
});
