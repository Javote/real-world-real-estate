// Lee las 23 tomas del runbook del video (T01, la sesión A entera, y T07–T28): la fila del mapa (Paso 2) y las
// frases de la narración con sus tiempos (Paso 4.3). El runbook es la única
// fuente: el estudio de voz y los subtítulos salen de acá, así que editar una
// frase en el .md alcanza.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RAIZ } from "./api.mjs";

export const RUNBOOK = join(RAIZ, "specs", "GUION-2026-09-21-video-walkthrough.md");

// La sesión A es una sola toma (T01) desde el 2026-10-01: T02–T06 no existen.
export const TOMAS = 23;

const segundos = (mmss) => {
  const [m, s] = mmss.split(":").map(Number);
  return m * 60 + s;
};
const celdas = (fila) =>
  fila
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

export function leerTomas(texto = readFileSync(RUNBOOK, "utf8")) {
  const tomas = new Map();
  for (const fila of texto.split("\n")) {
    const m = fila.match(/^\| (T\d\d) \| (\d+:\d\d) \|/);
    if (!m) continue;
    const c = celdas(fila);
    tomas.set(m[1], {
      toma: m[1],
      rol: c[2],
      titulo: c[3],
      pantalla: c[4],
      video: Number.parseInt(c[5], 10),
      frases: []
    });
  }
  const voz = texto.slice(texto.indexOf("### 4.3"));
  for (const bloque of voz.split(/^##### /m).slice(1)) {
    const toma = bloque.slice(0, 3);
    const t = tomas.get(toma);
    if (!t) continue;
    for (const fila of bloque.split("\n")) {
      if (!/^\| \d+:\d\d \|/.test(fila)) continue;
      const [tiempo, ver, frase] = celdas(fila);
      t.frases.push({ t: segundos(tiempo), ver, texto: frase });
    }
  }
  const lista = [...tomas.values()];
  if (lista.length !== TOMAS || lista.some((t) => !t.frases.length || !t.video))
    throw new Error(
      `El runbook no tiene las ${TOMAS} tomas completas (${lista.length}). ¿Cambió el formato de las tablas?`
    );
  return lista;
}

/** Subtítulos .srt: cada frase dura hasta la siguiente, o lo que se tarda en leerla (2,3 palabras/s). */
export function srt(tomas, inicioDe) {
  const hms = (s) => {
    const ms = Math.round(s * 1000);
    const p = (n, l = 2) => String(n).padStart(l, "0");
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
  };
  const bloques = [];
  for (const t of tomas) {
    const base = inicioDe(t.toma);
    if (base == null) continue;
    t.frases.forEach((f, i) => {
      const lectura = f.texto.split(/\s+/).length / 2.3 + 0.8;
      const siguiente = t.frases[i + 1]?.t ?? Number.POSITIVE_INFINITY;
      const fin = Math.min(f.t + lectura, siguiente - 0.2);
      bloques.push(
        `${bloques.length + 1}\n${hms(base + f.t)} --> ${hms(base + fin)}\n${f.texto}\n`
      );
    });
  }
  return bloques.join("\n");
}
