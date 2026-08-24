import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";

// D-065: el web pasó a SPA estática en otro origen, así que la API necesita
// CORS. La lista es blanca y explícita — un `*` con `Authorization` es
// exactamente lo que no se hace.

afterAll(async () => {
  await db.destroy();
});

describe("CORS", () => {
  it("responde el preflight de un origen permitido", async () => {
    const res = await request(app)
      .options("/api/v1/auth/me")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "GET");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["access-control-allow-headers"]).toContain("Authorization");
  });

  it("NO devuelve cabecera para un origen desconocido", async () => {
    // Sin cabecera, el browser corta. Es el comportamiento correcto: la API
    // contesta igual, pero el navegador no le entrega la respuesta a la página.
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Origin", "https://sitio-que-no-es-nuestro.example");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("nunca usa comodín", async () => {
    const res = await request(app)
      .options("/api/v1/auth/me")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST");

    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });
});
