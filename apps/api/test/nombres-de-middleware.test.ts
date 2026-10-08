import { afterAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { db } from "../src/lib/db.js";

afterAll(async () => {
  await db.destroy();
});

// El span de cada middleware en Tempo lleva el nombre de su función: uno anónimo sale `<anonymous>`.
describe("nombres de middleware", () => {
  it("ningún middleware montado en la app es anónimo", () => {
    const nombres = (app.router as unknown as { stack: { name: string }[] }).stack.map(
      (capa) => capa.name
    );

    expect(nombres).toContain("cors");
    expect(nombres).toContain("rutaInexistente");
    expect(nombres.filter((nombre) => nombre === "<anonymous>" || nombre === "")).toEqual([]);
  });
});
