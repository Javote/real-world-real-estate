import { MulterError } from "multer";
import { describe, expect, it } from "vitest";
import { statusDeError } from "../src/lib/error-status";
import { HttpError } from "../src/lib/http-error";

// La razón de ser de este archivo: `Sentry.setupExpressErrorHandler` ve el
// error ANTES que `errorHandler` (app.ts lo explica), así que sin esta
// clasificación Sentry reportaba como "Unhandled" cosas que `errorHandler`
// iba a devolver como un 409/400 perfectamente sano — encontrado leyendo el
// screenshot de monitoring de la evidencia de entrega (un SQLITE_CONSTRAINT_
// UNIQUE real, generado mandando un formulario duplicado, aparecía en Sentry
// mezclado con los fallos de verdad).
//
// Reusa el MISMO mapeo que `errorHandler` (`CONSTRAINT_ERRORS`,
// `codigoDeRestriccion`, importados de ahí) en vez de copiarlo: si estos
// tests y `constraint-errors.test.ts`/`error-handling.test.ts` alguna vez
// dijeran cosas distintas sobre el mismo error, sería porque alguien editó
// uno de los dos sin el otro — y con una sola tabla, eso no puede pasar.

describe("statusDeError — la misma clasificación que errorHandler, un paso antes", () => {
  it("un HttpError devuelve su propio status", () => {
    expect(statusDeError(new HttpError(422, "mensaje para el cliente"))).toBe(422);
    expect(statusDeError(new HttpError(400, "otro"))).toBe(400);
  });

  it("un MulterError es 400", () => {
    expect(statusDeError(new MulterError("LIMIT_FILE_SIZE"))).toBe(400);
  });

  it("SQLITE_CONSTRAINT_UNIQUE es 409, no 500 — el caso que Sentry marcaba mal", () => {
    const err = Object.assign(new Error("UNIQUE constraint failed: Unit.unitReference"), {
      code: "SQLITE_CONSTRAINT_UNIQUE"
    });
    expect(statusDeError(err)).toBe(409);
  });

  it("SQLITE_CONSTRAINT_PRIMARYKEY es 409", () => {
    const err = Object.assign(new Error("x"), { code: "SQLITE_CONSTRAINT_PRIMARYKEY" });
    expect(statusDeError(err)).toBe(409);
  });

  it("SQLITE_CONSTRAINT_FOREIGNKEY es 400", () => {
    const err = Object.assign(new Error("x"), { code: "SQLITE_CONSTRAINT_FOREIGNKEY" });
    expect(statusDeError(err)).toBe(400);
  });

  it("mira el código en `cause`, no solo en el error directo", () => {
    const err = new Error("wrapper", {
      cause: { code: "SQLITE_CONSTRAINT_UNIQUE" }
    });
    expect(statusDeError(err)).toBe(409);
  });

  it("un error sin clasificar es 500 — el único caso que Sentry SÍ tiene que ver", () => {
    expect(statusDeError(new Error("lo que sea, un null, la base caída"))).toBe(500);
  });

  it("un código de restricción desconocido no clasifica: sigue siendo 500", () => {
    const err = Object.assign(new Error("x"), { code: "SQLITE_ERROR" });
    expect(statusDeError(err)).toBe(500);
  });

  it("valores que no son Error en absoluto también caen a 500", () => {
    expect(statusDeError("un string cualquiera")).toBe(500);
    expect(statusDeError(null)).toBe(500);
    expect(statusDeError(undefined)).toBe(500);
  });
});
