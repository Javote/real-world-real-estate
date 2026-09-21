#!/usr/bin/env node
// Cada `expect` del validador, contra el test que aborta exactamente ahí
// (SPEC-017, paso 6). Es la otra mitad de `rechazos-mutantes.mjs`.
//
// Un `expect` que desarma un constructor o castea (`Some(x) = …`,
// `InlineDatum(x) = …`, `x: StageDatum = …`) no se puede sacar sin romper los
// tipos, así que no se puede mutar. Pero cuando un test de rechazo
// (`test … fail`) hace abortar al validador, `aiken check` devuelve en la traza
// **el texto del `expect` que falló**. Este script junta esas trazas y verifica
// que cada `expect` de `validators/stage.ak` y `lib/propnexus/fsm.ak` tenga al
// menos un test que aborte en él. Mide todos los `expect`, no solo los
// estructurales: para los booleanos es evidencia de más, no de menos.
//
// Uso (desde la raíz del repo o desde contracts/):
//   node contracts/scripts/rechazos-trazas.mjs
//   node contracts/scripts/rechazos-trazas.mjs --salida reporte.md
//
// Sale con código 0 solo si todos los `expect` tienen su test.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CONTRATOS = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARCHIVOS = ["validators/stage.ak", "lib/propnexus/fsm.ak"];

const args = process.argv.slice(2);
const salida = args.includes("--salida") ? args[args.indexOf("--salida") + 1] : null;

/** Colapsa espacios y saltos de línea: la traza trae el `expect` con su formato original. */
const normalizar = (s) => s.replace(/\s+/g, " ").trim();

function balance(texto, abre, cierra) {
  let n = 0;
  for (const c of texto) {
    if (c === abre) n++;
    else if (c === cierra) n--;
  }
  return n;
}

/** Todos los `expect` del código (antes de los tests), con su texto completo. */
function expectsDe(archivo) {
  const lineas = readFileSync(join(CONTRATOS, archivo), "utf8").split("\n");
  let fin = lineas.findIndex((l) => /^\/\/ ── Tests/.test(l) || /^test /.test(l));
  if (fin === -1) fin = lineas.length;
  const hallados = [];
  for (let i = 0; i < fin; i++) {
    const t = lineas[i].replace(/\/\/.*$/, "").trim();
    if (!/^expect(\s|$)/.test(t)) continue;
    let j = i;
    let texto = t;
    while (balance(texto, "(", ")") > 0 || balance(texto, "[", "]") > 0 || texto === "expect" || /[=(,]$/.test(texto)) {
      j++;
      texto += ` ${lineas[j].replace(/\/\/.*$/, "").trim()}`;
    }
    hallados.push({ archivo, linea: i + 1, texto: normalizar(texto) });
    i = j;
  }
  return hallados;
}

let stdout;
try {
  stdout = execFileSync("aiken", ["check"], { cwd: CONTRATOS, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (e) {
  stdout = e.stdout ?? "";
}
const resultado = JSON.parse(stdout);
if (resultado.summary.failed > 0) {
  console.error("La suite no está verde: arreglar eso primero.");
  process.exit(1);
}

// Traza normalizada → tests que abortaron con ella.
const abortos = new Map();
for (const m of resultado.modules) {
  for (const t of m.tests) {
    for (const traza of t.traces ?? []) {
      const clave = normalizar(traza);
      if (!abortos.has(clave)) abortos.set(clave, []);
      abortos.get(clave).push(t.title);
    }
  }
}

const expects = ARCHIVOS.flatMap(expectsDe).map((e) => ({ ...e, tests: abortos.get(e.texto) ?? [] }));
const sinTest = expects.filter((e) => e.tests.length === 0);
const esc = (s) => s.replaceAll("|", "\\|");

const reporte = [
  "# Cada `expect` del validador contra el test que aborta en él",
  "",
  `Corrida: ${new Date().toISOString()} · aiken ${execFileSync("aiken", ["--version"], { encoding: "utf8" }).trim()} · ${resultado.summary.total} tests, ${resultado.summary.passed} en verde`,
  "",
  `**${expects.length} \`expect\`: ${expects.length - sinTest.length} con test, ${sinTest.length} sin test.**`,
  "",
  "| Archivo:línea | `expect` | Tests que abortan ahí |",
  "|---|---|---|",
  ...expects.map(
    (e) =>
      `| \`${e.archivo}:${e.linea}\` | \`${esc(e.texto)}\` | ${
        e.tests.length ? e.tests.map((t) => `\`${t}\``).join(", ") : "**ninguno**"
      } |`
  ),
  ""
].join("\n");

if (salida) writeFileSync(salida, reporte);
console.log(reporte);
process.exit(sinTest.length === 0 ? 0 : 1);
