const ANCHO_LINEA = 92;
const LINEAS_POR_PAGINA = 56;

// Los de WinAnsi que no están en Latin-1 (0x80–0x9F); el resto de 0xA0–0xFF coincide con Unicode.
const WIN_ANSI_FUERA_DE_LATIN1: Readonly<Record<string, number>> = {
  "€": 0x80,
  "‚": 0x82,
  "„": 0x84,
  "…": 0x85,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97
};

function codigoWinAnsi(caracter: string): number | undefined {
  const cp = caracter.codePointAt(0)!;
  if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff)) return cp;
  return WIN_ANSI_FUERA_DE_LATIN1[caracter];
}

/** Courier con WinAnsi: acentos, `°` y `·` salen como son; lo que no existe ahí, sin tilde o `?`. */
function escaparTexto(linea: string): string {
  return [...linea.normalize("NFC")]
    .map((caracter) => {
      const codigo =
        codigoWinAnsi(caracter) ?? codigoWinAnsi(caracter.normalize("NFD").charAt(0)) ?? 0x3f;
      if (codigo === 0x5c || codigo === 0x28 || codigo === 0x29) {
        return `\\${String.fromCharCode(codigo)}`;
      }
      return codigo > 0x7e ? `\\${codigo.toString(8)}` : String.fromCharCode(codigo);
    })
    .join("");
}

function envolver(linea: string): string[] {
  if (linea.length <= ANCHO_LINEA) return [linea];
  const partes: string[] = [];
  for (let i = 0; i < linea.length; i += ANCHO_LINEA) {
    partes.push(linea.slice(i, i + ANCHO_LINEA));
  }
  return partes;
}

export function renderTextPdf(lineas: string[]): Buffer {
  const envueltas = lineas.flatMap(envolver);

  const paginas: string[][] = [];
  for (let i = 0; i < Math.max(envueltas.length, 1); i += LINEAS_POR_PAGINA) {
    paginas.push(envueltas.slice(i, i + LINEAS_POR_PAGINA));
  }

  const objetos: string[] = [];
  const idPagina = (i: number) => 4 + i * 2;
  const idContenido = (i: number) => 5 + i * 2;

  objetos.push("<< /Type /Catalog /Pages 2 0 R >>");
  objetos.push(
    `<< /Type /Pages /Count ${paginas.length} /Kids [${paginas
      .map((_, i) => `${idPagina(i)} 0 R`)
      .join(" ")}] >>`
  );
  objetos.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");

  for (const [i, pagina] of paginas.entries()) {
    objetos.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${idContenido(i)} 0 R >>`
    );

    const cuerpo =
      "BT\n/F1 9 Tf\n11 TL\n40 750 Td\n" +
      pagina.map((l) => `(${escaparTexto(l)}) Tj T*`).join("\n") +
      "\nET";
    objetos.push(
      `<< /Length ${Buffer.byteLength(cuerpo, "latin1")} >>\nstream\n${cuerpo}\nendstream`
    );
  }

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  for (const [i, objeto] of objetos.entries()) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${objeto}\nendobj\n`;
  }

  const inicioXref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${inicioXref}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}
