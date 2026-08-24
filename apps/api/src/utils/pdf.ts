// Generador de PDF mínimo, sin dependencias.
//
// Existe por una sola superficie: `GET /investor/units/:id/dossier/export.pdf`
// (M2-D5 fila 26-29, INV-DOSSIER-EXPORT-002). El export del dossier tiene que
// devolver un `application/pdf` de verdad — un `.txt` con otro Content-Type es
// un archivo que el visor del sistema no abre.
//
// **No es una librería de layout y no debe convertirse en una.** Escribe líneas
// de texto monoespaciado en páginas Letter con Courier, que es lo que el
// artefacto necesita: hashes, TXIDs y etiquetas, en una grilla legible. Si
// alguna vez hace falta un PDF con tablas, imágenes o tipografías, eso es una
// dependencia, no más código acá.
//
// Courier y no Helvetica a propósito: un hash SHA-256 en tipografía
// proporcional es ilegible para compararlo a ojo, que es justo para lo que
// alguien imprime este PDF.

const ANCHO_LINEA = 92;
const LINEAS_POR_PAGINA = 56;

/** El texto que entra a un `Tj`: escapado y sin nada fuera de ASCII imprimible. */
function escaparTexto(linea: string): string {
  return (
    linea
      .normalize("NFD")
      // Se sacan los diacríticos en vez de mapearlos a WinAnsi: la fuente base
      // no lleva encoding declarado y un byte >127 saldría como basura.
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\x20-\x7e]/g, "?")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
  );
}

/** Corta una línea larga en varias, para que nada se salga de la página. */
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

  // Objetos: 1 catálogo, 2 páginas, 3 fuente, y después dos por página.
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

  // El xref necesita el offset en BYTES de cada objeto, así que el documento se
  // arma midiendo a medida que se escribe y no concatenando al final.
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
