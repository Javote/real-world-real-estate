const ANCHO_LINEA = 92;
const LINEAS_POR_PAGINA = 56;

function escaparTexto(linea: string): string {
  return linea
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
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
  objetos.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");

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
