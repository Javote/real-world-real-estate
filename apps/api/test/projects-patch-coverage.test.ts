import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

let tokenAdmin: string;
let proyectoAjeno: string;

beforeAll(async () => {
  tokenAdmin = (
    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: FIXTURES.admin.email, password: FIXTURES.admin.password })
  ).body.token;

  proyectoAjeno = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.otroProyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
});

afterAll(async () => {
  await db.destroy();
});

describe("PATCH /api/v1/projects/:id", () => {
  it("404 sobre un id inexistente, no el 500 genérico de antes", async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${createId()}`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ name: "no importa" });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Project not found");
  });

  it("409 si el slug ya lo tiene otro proyecto", async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${proyectoAjeno}`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ slug: FIXTURES.proyecto.slug });

    expect(res.status).toBe(409);
  });

  it("200 en el camino feliz", async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${proyectoAjeno}`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ city: "Rosario" });

    expect(res.status).toBe(200);
    expect(res.body.city).toBe("Rosario");
  });
});
