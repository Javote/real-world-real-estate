import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ERROR_CODES,
  type ErrorCode,
  EVIDENCE_REJECTION_CODES,
  STAGE_TRANSITION_ERRORS
} from "@plataforma/shared";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "..", "src");

const fuentes = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? fuentes(join(dir, e.name))
      : e.name.endsWith(".ts")
        ? [readFileSync(join(dir, e.name), "utf8")]
        : []
  );

const codigo = fuentes(SRC).join("\n");
const todos = (re: RegExp) => [...codigo.matchAll(re)];

// `X: { status: N` en `.errors()`, y `status: N, code: "X"` en el dominio y en `errorHandler`. Las
// claves `SQLITE_*` de `CONSTRAINT_ERRORS` son lo que entra, no lo que sale: se traducen a otro código.
const conStatus = [
  ...todos(/\b([A-Z][A-Z_]{3,}): \{\s*status: (\d{3})/g),
  ...todos(/status: (\d{3}),\s*code: "([A-Z][A-Z_]{3,})"/g).map((m) => [m[0], m[2], m[1]])
]
  .map(([, c, s]) => [c as string, Number(s)] as const)
  .filter(([c]) => !c.startsWith("SQLITE_"));

const enElCodigo = new Set([
  ...conStatus.map(([c]) => c),
  ...todos(/new ORPCError\("([A-Z_]+)"/g).map((m) => m[1] as string),
  ...todos(/code: "([A-Z][A-Z_]{3,})"/g).map((m) => m[1] as string),
  ...Object.values(STAGE_TRANSITION_ERRORS)
]);

// Lo pone Multer y `errorHandler` lo pasa tal cual: no está escrito en `src/`.
const DE_AFUERA = new Set<string>(["LIMIT_FILE_SIZE"]);

// Viajan como rechazo de un archivo adentro de una respuesta, no como el error de la request.
const SOLO_RECHAZO_POR_ARCHIVO = new Set<string>(
  EVIDENCE_REJECTION_CODES.filter((c) => !(c in ERROR_CODES))
);

describe("ERROR_CODES es el inventario de lo que la API manda hoy (SPEC-613)", () => {
  it("ningún código del inventario es inventado", () => {
    const inventados = Object.keys(ERROR_CODES).filter(
      (c) => !enElCodigo.has(c) && !DE_AFUERA.has(c)
    );
    expect(inventados).toEqual([]);
  });

  it("ningún código que la API manda falta en el inventario", () => {
    const faltan = [...enElCodigo].filter(
      (c) => !(c in ERROR_CODES) && !SOLO_RECHAZO_POR_ARCHIVO.has(c)
    );
    expect(faltan).toEqual([]);
  });

  it("el status de cada código es el que declara la API", () => {
    const distintos = conStatus.filter(([c, s]) => ERROR_CODES[c as ErrorCode]?.status !== s);
    expect(distintos).toEqual([]);
  });

  it("encuentra lo que busca: el cruce no pasa en vacío", () => {
    expect(conStatus.length).toBeGreaterThan(20);
    expect(enElCodigo.size).toBeGreaterThan(25);
  });
});
