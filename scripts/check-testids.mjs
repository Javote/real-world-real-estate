#!/usr/bin/env node
// Trazabilidad de los test IDs del backlog (M2-D5 §4-6) — SPEC-015 §3.
//
// M2-D5 §8 declara: *"Every test ID in §4–§6 is registered with the M3 test
// plan. Coverage target (≥95% per M3 acceptance) is computed against this
// backlog. **Test IDs are the unit of measurement**."* O sea que este número no
// es una métrica de vanidad: es la vara de aceptación de M3. Hasta ahora no se
// podía calcular.
//
// Falla en dos casos, y son distintos a propósito:
//
//   1. **Un ID reclamado que el entregable no declara.** Es un typo, y es el
//      peor caso posible: un `data-testid` con una letra cambiada se ve
//      implementado y no cuenta para nada.
//   2. **La cobertura baja del piso.** Trinquete: el piso sube cuando sube la
//      cobertura y no baja nunca. Poner 95% hoy dejaría el CI rojo por deuda
//      conocida, que es la forma más rápida de enseñarle a un equipo a ignorar
//      el rojo.
//
// **No falla** por un ID todavía sin implementar: eso es backlog pendiente, no
// una regresión. Los lista para que se vea qué falta.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Anclada a ESTE archivo, no al cwd: un path relativo al cwd es una dependencia
// oculta de desde dónde se invoca el comando (misma lección que vitest.config).
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ENTREGABLE = "docs/milestone-3-implementacion/UI-implementation-plan.md";

// Dónde se puede reclamar un ID: el `data-testid` de una superficie, un spec de
// Playwright o un test de la API que lo nombre.
const DONDE_SE_RECLAMA = ["apps/web/src", "apps/web/e2e", "apps/api/test"];

/**
 * Los comentarios NO reclaman.
 *
 * El primer intento matcheaba el archivo entero, y entonces un comentario que
 * EXPLICA por qué un ID no se implementa lo daba por implementado. Pasó con
 * `DEV-RELEASE-EXECUTE-002`: la pantalla de las filas 40-41 documenta que no lo
 * construye (D-070), y esa misma explicación lo hacía contar. Tres IDs
 * fantasma de un saque, y el número que M2-D5 §8 declara *"la unidad de
 * medida"* pasó a medir prosa.
 *
 * Un `data-testid` en un comentario no es un `data-testid`. Se borran antes de
 * buscar y el conteo vuelve a ser de código.
 *
 * No es un parser: es un barrido de línea y de bloque, que es todo lo que hace
 * falta cuando lo único que se busca después son IDs. Los strings que contengan
 * `//` —una URL— pierden su cola, y eso no cambia ningún ID.
 */
function sinComentarios(fuente) {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

// **El piso, no la meta.** Sube con cada rebanada; no baja nunca.
const COBERTURA_MINIMA = 74;

// El patrón del entregable: ROLE-AREA...-NNN, con UNO O MÁS segmentos entre el
// rol y el número.
//
// Exigir exactamente tres segmentos —`ROLE-AREA-ACTION-NNN`, que es como M2-D5
// §2.3 describe el esquema— descarta en silencio 13 IDs reales
// (`CER-CERTIFY-001`, `INV-MENU-001`, `NOT-PANEL-001`…) y da 62 donde hay 75.
// Ya pasó. El esquema que el entregable USA gana sobre el que DESCRIBE.
const PATRON = /\b(?:INV|DEV|NOT|CER|AUTH)(?:-[A-Z0-9]+)+-\d{3}\b/g;

function archivosDe(dir) {
  const base = path.join(RAIZ, dir);
  const salida = [];
  const recorrer = (d) => {
    for (const entrada of readdirSync(d)) {
      if (entrada === "node_modules" || entrada === "dist") continue;
      const completo = path.join(d, entrada);
      if (statSync(completo).isDirectory()) recorrer(completo);
      else if (/\.(ts|tsx|mts)$/.test(entrada)) salida.push(completo);
    }
  };
  try {
    recorrer(base);
  } catch {
    // Un directorio que todavía no existe no es un error: es cobertura cero.
  }
  return salida;
}

const declarados = new Set(readFileSync(path.join(RAIZ, ENTREGABLE), "utf8").match(PATRON) ?? []);

const reclamados = new Map();
for (const dir of DONDE_SE_RECLAMA) {
  for (const archivo of archivosDe(dir)) {
    const codigo = sinComentarios(readFileSync(archivo, "utf8"));
    for (const id of codigo.match(PATRON) ?? []) {
      if (!reclamados.has(id)) reclamados.set(id, path.relative(RAIZ, archivo));
    }
  }
}

const desconocidos = [...reclamados.keys()].filter((id) => !declarados.has(id));
const cubiertos = [...declarados].filter((id) => reclamados.has(id));
const faltantes = [...declarados].filter((id) => !reclamados.has(id)).sort();

const porcentaje = ((cubiertos.length / declarados.size) * 100).toFixed(1);

console.log(`Test IDs del backlog (${ENTREGABLE})`);
console.log(`  declarados: ${declarados.size}`);
console.log(`  cubiertos:  ${cubiertos.length}  (${porcentaje}%)`);
console.log(`  piso:       ${COBERTURA_MINIMA}`);

let falla = false;

if (desconocidos.length > 0) {
  falla = true;
  console.error("\nERROR · IDs reclamados que el entregable NO declara (¿typo?):");
  for (const id of desconocidos.sort()) console.error(`  ${id}  ← ${reclamados.get(id)}`);
}

if (cubiertos.length < COBERTURA_MINIMA) {
  falla = true;
  console.error(
    `\nERROR · la cobertura bajó del piso: ${cubiertos.length} < ${COBERTURA_MINIMA}.` +
      "\n  El piso es un trinquete: si un ID dejó de estar, se repone."
  );
}

if (faltantes.length > 0) {
  const porRol = new Map();
  for (const id of faltantes) {
    const rol = id.split("-")[0];
    porRol.set(rol, [...(porRol.get(rol) ?? []), id]);
  }
  console.log(`\nPendientes (${faltantes.length}) — backlog, no regresión:`);
  for (const [rol, ids] of [...porRol.entries()].sort()) {
    console.log(`  ${rol} (${ids.length}): ${ids.join(", ")}`);
  }
}

if (falla) process.exit(1);
console.log("\nOK");
