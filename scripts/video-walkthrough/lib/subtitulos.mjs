// Los subtítulos de la versión sin voz (subtitular.sh). A diferencia de los
// del video con voz (srt() de tomas.mjs, que dura lo que se tarda en leer la
// frase), acá no hay voz que acompañe: cada frase queda en pantalla hasta que
// entra la siguiente, y la última de la toma hasta que la toma termina.
//
//   node lib/subtitulos.mjs <toma> <duración en s> <carpeta>
//
// Escribe <carpeta>/cues.json (lo dibuja subtitulos.py) y <carpeta>/filtro.txt
// (el -filter_complex de ffmpeg que superpone cada imagen en su tramo).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { leerTomas } from "./tomas.mjs";

/** Las frases de una toma con su tramo: desde su segundo hasta 0,2 s antes de la siguiente. */
export function tramos(toma, duracion) {
  return toma.frases.map((f, i) => ({
    ini: f.t,
    fin: i + 1 < toma.frases.length ? toma.frases[i + 1].t - 0.2 : duracion,
    texto: f.texto
  }));
}

/** El filtro de ffmpeg: escala la toma a 1920×1200 y superpone la imagen i entre ini y fin. */
export function filtro(tramosDeLaToma) {
  let f =
    "[0:v]scale=1920:1200:force_original_aspect_ratio=decrease,pad=1920:1200:(ow-iw)/2:(oh-ih)/2:color=white,fps=30,format=yuv420p[v0]";
  tramosDeLaToma.forEach((c, i) => {
    f += `;[v${i}][${i + 1}:v]overlay=x=(W-w)/2:y=H-h-70:enable='between(t,${c.ini},${c.fin})'[v${i + 1}]`;
  });
  return { filtro: f, salida: `[v${tramosDeLaToma.length}]` };
}

/** El .srt del video entero, con los mismos tramos que se ven dibujados. */
export function srtContinuo(tomas, inicioDe, duracionDe) {
  const hms = (s) => {
    const ms = Math.round(s * 1000);
    const p = (n, l = 2) => String(n).padStart(l, "0");
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
  };
  const bloques = [];
  for (const t of tomas) {
    const base = inicioDe(t.toma);
    if (base == null) continue;
    for (const c of tramos(t, duracionDe(t.toma))) {
      bloques.push(
        `${bloques.length + 1}\n${hms(base + c.ini)} --> ${hms(base + c.fin)}\n${c.texto}\n`
      );
    }
  }
  return bloques.join("\n");
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const [nombre, duracion, carpeta] = process.argv.slice(2);
  const toma = leerTomas().find((t) => t.toma === nombre);
  if (!toma) throw new Error(`${nombre} no está en el runbook`);
  const cues = tramos(toma, Number(duracion));
  writeFileSync(join(carpeta, "cues.json"), JSON.stringify(cues));
  const { filtro: f, salida } = filtro(cues);
  writeFileSync(join(carpeta, "filtro.txt"), f);
  process.stdout.write(`${cues.length} ${salida}\n`);
}
