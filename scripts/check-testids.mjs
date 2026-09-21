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
//
// Un tercer caso es un ID que el entregable declara pero que la plataforma
// **decidió no construir nunca**: `DEV-RELEASE-EXECUTE-002`, el botón de
// liberar pagos que D-070 descartó porque este producto no administra fondos.
// **Cuenta como no cubierto, a propósito**, y por eso el número es 74/75 y no
// 74/74.
//
// Hasta el 2026-09-21 se excluía del denominador, con el argumento de no dejar
// flotando un 74/75 que nunca cierra. Se revirtió: un 100% redondo invita a
// dejar de mirar, y mirando se encontró que **las capturas 59 y 60 de M2-D2
// —el perfil de reputación del developer— están diseñadas, no tienen fila en
// este entregable y no están construidas**. Esta métrica no podía verlo,
// porque mide contra el backlog y no contra el catálogo de capturas. Un 98.7%
// con una excepción nombrada es más difícil de confundir con "no falta nada".
//
// El ID no se borra del entregable: `docs/` es inmutable (D-022).

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

/**
 * **Superficies diseñadas en M2-D2 que M2-D5 nunca recogió.**
 *
 * Un ID reclamado que el entregable no declara es, casi siempre, un typo — y
 * por eso este script falla ante uno. Pero hay un caso que no lo es y que
 * apareció el 2026-09-21: el **catálogo de capturas** (M2-D2) tiene pantallas
 * que el **backlog de implementación** (M2-D5) no lista. Las capturas 59 y 60,
 * `DEVELOPER-REPUTATION-A/B`, son el perfil de la organización desarrolladora:
 * diseñadas, sin fila, sin test IDs que transcribir.
 *
 * Construirlas es cumplir `docs/`, no desviarse de él. Pero sus IDs no pueden
 * salir de un entregable que no las menciona, así que son nuestros y se
 * declaran acá — con su captura al lado, que es lo que los hace auditables.
 *
 * **No entran al denominador**: la cobertura mide el backlog de M3 contra sí
 * mismo, y meter IDs que el backlog no pidió la inflaría hasta volverla
 * incomparable con la vara del ≥95% que fija M2-D5 §8.
 */
const FUERA_DEL_BACKLOG = new Map([
  ["INV-DEVELOPER-PROFILE-001", "M2-D2 capturas 59-60 · SPEC-220"],
  ["INV-DEVELOPER-PREVIOUS-002", "M2-D2 captura 59 · SPEC-220"],
  ["INV-DEVELOPER-ACTIVE-003", "M2-D2 captura 60 · SPEC-220"],
  ["INV-DEVELOPER-LINK-004", "M2-D1:109 · la entrada desde el detalle de obra"],
  // No sale de una captura sino de una decisión del dueño (D-095): el admin
  // invita a un certifier y el certifier responde desde su panel. Mismo trato
  // que los de arriba — declarado, fuera del denominador. Los `ADMIN-*` de la
  // pantalla del admin no hace falta listarlos: el patrón no los reclama.
  ["CER-INVITATIONS-003", "D-095 · SPEC-221 · invitaciones a certificar en el panel"]
]);

const reclamados = new Map();
for (const dir of DONDE_SE_RECLAMA) {
  for (const archivo of archivosDe(dir)) {
    const codigo = sinComentarios(readFileSync(archivo, "utf8"));
    for (const id of codigo.match(PATRON) ?? []) {
      if (!reclamados.has(id)) reclamados.set(id, path.relative(RAIZ, archivo));
    }
  }
}

const desconocidos = [...reclamados.keys()].filter(
  (id) => !declarados.has(id) && !FUERA_DEL_BACKLOG.has(id)
);

// Un ID declarado acá que nadie reclama es basura acumulándose: la lista
// describe lo que SÍ se construyó fuera del backlog, no una lista de deseos.
const fueraSinUsar = [...FUERA_DEL_BACKLOG.keys()].filter((id) => !reclamados.has(id));
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

if (fueraSinUsar.length > 0) {
  falla = true;
  console.error("\nERROR · declarados fuera del backlog pero que nadie reclama:");
  for (const id of fueraSinUsar.sort()) console.error(`  ${id}  (${FUERA_DEL_BACKLOG.get(id)})`);
}

if (FUERA_DEL_BACKLOG.size > 0) {
  console.log(
    `\nFuera del backlog (${FUERA_DEL_BACKLOG.size}) — M2-D2 las diseña, M2-D5 no las lista:`
  );
  for (const [id, origen] of [...FUERA_DEL_BACKLOG.entries()].sort()) {
    console.log(`  ${id}  ← ${origen}`);
  }
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
