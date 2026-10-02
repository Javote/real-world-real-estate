import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { esPuntoDeEntrada } from "../src/lib/punto-de-entrada.js";

describe("esPuntoDeEntrada", () => {
  const url = pathToFileURL(import.meta.filename).href;

  it("es verdadero cuando el módulo es el script que arrancó el proceso", () => {
    expect(esPuntoDeEntrada(url, ["node", import.meta.filename])).toBe(true);
  });

  it("es falso cuando el proceso arrancó con otro script", () => {
    expect(esPuntoDeEntrada(url, ["node", import.meta.dirname])).toBe(false);
  });

  it("es falso sin script, como en un REPL", () => {
    expect(esPuntoDeEntrada(url, ["node"])).toBe(false);
  });

  it("por defecto mira el proceso, que bajo Vitest no arrancó con este archivo", () => {
    expect(esPuntoDeEntrada(url)).toBe(false);
  });
});
