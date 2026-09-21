#!/usr/bin/env node
// Mutation testing de los puntos de rechazo del validador (SPEC-017, paso 6).
//
// Aiken no mide cobertura de líneas, así que "cada punto de rechazo tiene su
// test" se mide al revés: se saca **un** chequeo por vez (se reemplaza por
// `True`, o se relaja su patrón) y se corre la suite. Si algún test se pone
// rojo, el chequeo está cubierto (mutante muerto). Si todos siguen verdes, ese
// chequeo no tiene ningún test que lo defienda (mutante vivo).
//
// Qué se muta, en el código de `validators/stage.ak` y `lib/propnexus/fsm.ak`
// (solo la parte anterior a los tests):
//   · cada conjunción de un bloque `and { … }`            → `True`
//   · cada `expect <condición booleana>`                   → `expect True`
//   · cada `expect [ … ] = …` con patrón de lista          → acepta elementos de más (`, ..`)
//     y, si el patrón fija un entero, cualquier entero (`_`)
//   · cada `expect Finite(x) = …`                          → acepta una punta infinita
//   · cada rama de un `when` que decide un booleano        → `True`
//   · el cuerpo de un `if` que decide un booleano          → `True`
//   · la condición de un filtro `fn(x) { … }` en una línea → `True`
//   · cada `fail`                                          → `True`
//
// Los `expect` que desarman un constructor o castean (`Some(x) = …`,
// `InlineDatum(x) = …`, `x: StageDatum = …`) no se pueden sacar sin romper los
// tipos. Esos los mide el otro script, `rechazos-trazas.mjs`, con la traza del
// test que aborta exactamente ahí.
//
// Uso (desde la raíz del repo o desde contracts/):
//   node contracts/scripts/rechazos-mutantes.mjs            # corre todo (~4 s por mutante)
//   node contracts/scripts/rechazos-mutantes.mjs --listar   # solo lista los mutantes, sin correr aiken
//   node contracts/scripts/rechazos-mutantes.mjs --salida reporte.md
//
// Sale con código 0 solo si todos los mutantes mueren y ninguno es inválido.

import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CONTRATOS = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARCHIVOS = ["validators/stage.ak", "lib/propnexus/fsm.ak"];

// Para relajar `expect Finite(x) = …` hace falta un valor de reemplazo que haga
// pasar la comparación siguiente: 0 para una punta inferior, un número enorme
// para una superior. Se elige por el nombre de la variable, a propósito
// explícito: si aparece un `Finite` con otro nombre, el script lo avisa.
const RELLENO_FINITE = { lower: "0", upper: "1_000_000_000_000_000_000" };

const args = process.argv.slice(2);
const soloListar = args.includes("--listar");
const salida = args.includes("--salida") ? args[args.indexOf("--salida") + 1] : null;

// ── Lectura del código ────────────────────────────────────────────────────

/** Índice (0-based) de la primera línea de tests: lo de ahí en adelante no se muta. */
function finDelCodigo(lineas) {
  const i = lineas.findIndex((l) => /^\/\/ ── Tests/.test(l) || /^test /.test(l));
  return i === -1 ? lineas.length : i;
}

/** Saca comentarios y strings para contar llaves y paréntesis sin falsos positivos. */
function limpiar(linea) {
  return linea.replace(/\/\/.*$/, "").replace(/@?"(?:[^"\\]|\\.)*"/g, '""');
}

function balance(texto, abre, cierra) {
  let n = 0;
  for (const c of texto) {
    if (c === abre) n++;
    else if (c === cierra) n--;
  }
  return n;
}

/** Busca un `=` de asignación (no `==`, `>=`, `<=`, `!=`, `->`) a profundidad 0. */
function igualDeAsignacion(texto) {
  let prof = 0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if ("([{".includes(c)) prof++;
    else if (")]}".includes(c)) prof--;
    else if (c === "=" && prof === 0) {
      const antes = texto[i - 1];
      const despues = texto[i + 1];
      if (despues === "=" || "=<>!".includes(antes) || despues === ">") continue;
      return i;
    }
  }
  return -1;
}

/**
 * Recorre un archivo y devuelve los mutantes. Cada mutante es
 * `{ archivo, linea, tipo, original, aplicar(lineas) → lineas }`.
 */
function mutantesDe(archivo) {
  const lineas = readFileSync(join(CONTRATOS, archivo), "utf8").split("\n");
  const fin = finDelCodigo(lineas);
  const mutantes = [];
  const estructurales = [];
  const pila = []; // tipo de cada bloque abierto: "and" | "if" | "otro"

  const agregar = (linea, tipo, original, aplicar) =>
    mutantes.push({ archivo, linea: linea + 1, tipo, original: original.trim(), aplicar });

  for (let i = 0; i < fin; i++) {
    const cruda = lineas[i];
    const linea = limpiar(cruda);
    const t = linea.trim();
    const sangria = cruda.match(/^\s*/)[0];
    const arriba = pila[pila.length - 1];

    // `expect …`, posiblemente en varias líneas.
    if (/^expect(\s|$)/.test(t)) {
      let j = i;
      let texto = t;
      while (
        balance(texto, "(", ")") > 0 ||
        balance(texto, "[", "]") > 0 ||
        texto === "expect" ||
        /[=(,]$/.test(texto)
      ) {
        j++;
        texto += ` ${limpiar(lineas[j]).trim()}`;
      }
      const cuerpo = texto.replace(/^expect\s*/, "");
      const eq = igualDeAsignacion(cuerpo);
      const desde = i;
      const hasta = j;
      const reemplazar = (nuevo) => (ls) => [...ls.slice(0, desde), nuevo, ...ls.slice(hasta + 1)];

      if (eq === -1) {
        agregar(i, "expect booleano", texto, reemplazar(`${sangria}expect True`));
      } else {
        const patron = cuerpo.slice(0, eq).trim();
        const expr = cuerpo.slice(eq + 1).trim();
        if (/^\[.*\]$/.test(patron) && !patron.includes("..")) {
          const conResto = `${patron.slice(0, -1)}, ..]`;
          agregar(i, "patrón de lista: elementos de más", texto, reemplazar(`${sangria}expect ${conResto} = ${expr}`));
          if (/\b\d+\b/.test(patron)) {
            const sinEntero = patron.replace(/\b\d+\b/g, "_");
            agregar(i, "patrón de lista: cualquier cantidad", texto, reemplazar(`${sangria}expect ${sinEntero} = ${expr}`));
          }
        } else if (/^Finite\((\w+)\)$/.test(patron)) {
          const v = patron.match(/^Finite\((\w+)\)$/)[1];
          const relleno = RELLENO_FINITE[v];
          if (!relleno) {
            estructurales.push({ archivo, linea: i + 1, original: texto, motivo: `Finite(${v}) sin relleno definido` });
          } else {
            agregar(
              i,
              "punta infinita aceptada",
              texto,
              reemplazar(`${sangria}let ${v} = when ${expr} is { Finite(x) -> x  _ -> ${relleno} }`)
            );
          }
        } else {
          estructurales.push({ archivo, linea: i + 1, original: texto, motivo: "desarma o castea: lo mide rechazos-trazas.mjs" });
        }
      }
      i = j;
      continue;
    }

    // Conjunción de un `and { … }`, en una sola línea.
    if (arriba === "and" && t.endsWith(",") && !t.includes("{") && !t.includes("}") && t !== ",") {
      const expr = t.slice(0, -1);
      if (expr !== "True") agregar(i, "conjunción de and", cruda, (ls) => ls.with(i, `${sangria}True,`));
    }

    // Rama de un `when` que decide un booleano: `Constructor -> expr`.
    const rama = t.match(/^([A-Z]\w*(?:\([^)]*\))?)\s*->\s*(.+)$/);
    if (rama && !/^(and|or|when|if)\b|\{$/.test(rama[2]) && rama[2] !== "True") {
      agregar(i, "rama de when", cruda, (ls) => ls.with(i, `${sangria}${rama[1]} -> True`));
    }

    // Cuerpo de un `if` en una línea.
    if (arriba === "if" && t && !t.includes("{") && !t.includes("}") && t !== "True") {
      agregar(i, "cuerpo de if", cruda, (ls) => ls.with(i, `${sangria}True`));
    }

    // Condición de un filtro en una línea: `fn(x) { cond }`.
    const filtro = cruda.match(/^(.*fn\(\w+\) \{ )(.+?)( \}.*)$/);
    if (filtro && filtro[2] !== "True") {
      agregar(i, "condición de filtro", cruda, (ls) => ls.with(i, `${filtro[1]}True${filtro[3]}`));
    }

    if (t === "fail") agregar(i, "fail", cruda, (ls) => ls.with(i, `${sangria}True`));

    // Actualizar la pila de bloques.
    const abre = balance(linea, "{", "}");
    if (abre > 0) {
      const tipo = /\band \{\s*$/.test(t) ? "and" : /^if\b.*\{\s*$/.test(t) ? "if" : "otro";
      for (let k = 0; k < abre; k++) pila.push(k === abre - 1 ? tipo : "otro");
    } else if (abre < 0) {
      for (let k = 0; k < -abre; k++) pila.pop();
    }
  }

  return { mutantes, estructurales };
}

// ── Correr aiken ──────────────────────────────────────────────────────────

/** `aiken check` en `dir`: devuelve el JSON de resultados, o `null` si no compila. */
function aikenCheck(dir) {
  let stdout;
  try {
    stdout = execFileSync("aiken", ["check"], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    stdout = e.stdout ?? "";
  }
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function rojos(resultado) {
  return resultado.modules.flatMap((m) => m.tests.filter((t) => t.status !== "pass").map((t) => t.title));
}

// ── Principal ─────────────────────────────────────────────────────────────

const todos = ARCHIVOS.map(mutantesDe);
const mutantes = todos.flatMap((r) => r.mutantes);
const estructurales = todos.flatMap((r) => r.estructurales);

if (soloListar) {
  for (const m of mutantes) console.log(`${m.archivo}:${m.linea}  [${m.tipo}]  ${m.original}`);
  console.log(`\n${mutantes.length} mutantes · ${estructurales.length} expect estructurales (→ rechazos-trazas.mjs)`);
  for (const e of estructurales) console.log(`  ${e.archivo}:${e.linea}  ${e.original}  — ${e.motivo}`);
  process.exit(0);
}

// Una copia del proyecto Aiken por corrida: nunca se toca el árbol real.
const copia = mkdtempSync(join(tmpdir(), "aiken-mutantes-"));
for (const p of ["aiken.toml", "aiken.lock", "lib", "validators", "build/packages"]) {
  cpSync(join(CONTRATOS, p), join(copia, p), { recursive: true });
}

try {
  const base = aikenCheck(copia);
  if (!base || base.summary.failed > 0) {
    console.error("La suite no está verde sin mutar: arreglar eso primero.");
    process.exit(1);
  }

  const resultados = [];
  for (const [n, m] of mutantes.entries()) {
    const ruta = join(copia, m.archivo);
    const original = readFileSync(join(CONTRATOS, m.archivo), "utf8");
    writeFileSync(ruta, m.aplicar(original.split("\n")).join("\n"));
    const r = aikenCheck(copia);
    writeFileSync(ruta, original);
    const estado = r === null ? "inválido" : r.summary.failed > 0 ? "muerto" : "VIVO";
    const asesinos = r === null ? [] : rojos(r);
    resultados.push({ ...m, estado, asesinos });
    process.stderr.write(`[${n + 1}/${mutantes.length}] ${estado.padEnd(8)} ${m.archivo}:${m.linea} ${m.tipo}\n`);
  }

  const vivos = resultados.filter((r) => r.estado === "VIVO");
  const invalidos = resultados.filter((r) => r.estado === "inválido");
  const esc = (s) => s.replaceAll("|", "\\|");
  const reporte = [
    "# Mutantes de los puntos de rechazo del validador",
    "",
    `Corrida: ${new Date().toISOString()} · aiken ${execFileSync("aiken", ["--version"], { encoding: "utf8" }).trim()}`,
    "",
    `**${resultados.length} mutantes: ${resultados.length - vivos.length - invalidos.length} muertos, ${vivos.length} vivos, ${invalidos.length} inválidos.**`,
    "",
    "| Archivo:línea | Qué se sacó | Chequeo original | Resultado | Tests que lo detectaron |",
    "|---|---|---|---|---|",
    ...resultados.map(
      (r) =>
        `| \`${r.archivo}:${r.linea}\` | ${r.tipo} | \`${esc(r.original)}\` | ${r.estado} | ${r.asesinos
          .slice(0, 3)
          .map((a) => `\`${a}\``)
          .join(", ")}${r.asesinos.length > 3 ? ` y ${r.asesinos.length - 3} más` : ""} |`
    ),
    "",
    `Los ${estructurales.length} \`expect\` que desarman o castean no se mutan: los cubre \`rechazos-trazas.mjs\`.`,
    ""
  ].join("\n");

  if (salida) writeFileSync(salida, reporte);
  console.log(reporte);
  process.exit(vivos.length === 0 && invalidos.length === 0 ? 0 : 1);
} finally {
  rmSync(copia, { recursive: true, force: true });
}
