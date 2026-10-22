import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { correrSiEsPuntoDeEntrada, esPuntoDeEntrada } from "../src/lib/punto-de-entrada.js";

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

describe("correrSiEsPuntoDeEntrada", () => {
  const url = pathToFileURL(import.meta.filename).href;
  const comoScript = ["node", import.meta.filename];
  afterEach(() => vi.restoreAllMocks());

  it("importado, no corre la tarea", () => {
    const tarea = vi.fn(async () => undefined);
    correrSiEsPuntoDeEntrada(url, tarea);
    expect(tarea).not.toHaveBeenCalled();
  });

  it("como script corre la tarea y después cierra", async () => {
    const orden: string[] = [];
    const cerrar = vi.fn(() => orden.push("cerrar"));

    correrSiEsPuntoDeEntrada(url, async () => orden.push("tarea"), cerrar, comoScript);

    await vi.waitFor(() => expect(cerrar).toHaveBeenCalled());
    expect(orden).toEqual(["tarea", "cerrar"]);
  });

  it("sin nada que cerrar, alcanza con la tarea", async () => {
    const tarea = vi.fn(async () => undefined);
    correrSiEsPuntoDeEntrada(url, tarea, undefined, comoScript);
    await vi.waitFor(() => expect(tarea).toHaveBeenCalled());
  });

  it("si la tarea falla, lo dice y sale con 1, y cierra igual", async () => {
    const salir = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const decir = vi.spyOn(console, "error").mockImplementation(() => {});
    const cerrar = vi.fn();
    const falla = new Error("no hay base");

    correrSiEsPuntoDeEntrada(url, () => Promise.reject(falla), cerrar, comoScript);

    await vi.waitFor(() => expect(cerrar).toHaveBeenCalled());
    expect(decir).toHaveBeenCalledWith(falla);
    expect(salir).toHaveBeenCalledWith(1);
  });
});
