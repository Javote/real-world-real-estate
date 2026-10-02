import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";

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

  it("permite PUT: la portada del proyecto se sube con PUT desde la web", async () => {
    const res = await request(app)
      .options("/api/v1/developer/projects/x/cover")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "PUT");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-methods"]?.split(",")).toContain("PUT");
  });

  it("NO devuelve cabecera para un origen desconocido", async () => {
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
