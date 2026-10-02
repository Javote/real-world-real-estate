import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

let tokenDev: string;
let tokenAdmin: string;
let projectId: string;

const ETAPA = 1;

beforeAll(async () => {
  tokenDev = (await login(FIXTURES.activo)).body.token;
  tokenAdmin = (await login(FIXTURES.admin)).body.token;

  const proyecto = await db
    .selectFrom("Project")
    .select("id")
    .where("slug", "=", FIXTURES.proyecto.slug)
    .executeTakeFirstOrThrow();
  projectId = proyecto.id;
});

afterAll(async () => {
  await db.destroy();
});

describe("un duplicado es 409, no 500", () => {
  it("un slug de proyecto repetido", async () => {
    const res = await request(app)
      .post("/api/v1/developer/projects")
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({
        latitude: -34.6,
        longitude: -58.4,
        name: "Torre Duplicada",
        slug: FIXTURES.proyecto.slug,
        totalUnits: 3
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("RESOURCE_ALREADY_EXISTS");
    expect(JSON.stringify(res.body)).not.toContain("Project");
    expect(JSON.stringify(res.body)).not.toContain("slug");
  });

  it("dos unidades con la misma referencia en el mismo proyecto", async () => {
    const referencia = `9${ETAPA}Z`;

    const primera = await request(app)
      .post(`/api/v1/developer/projects/${projectId}/units`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ unitReference: referencia });
    expect(primera.status).toBe(201);

    const segunda = await request(app)
      .post(`/api/v1/developer/projects/${projectId}/units`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ unitReference: referencia });

    expect(segunda.status).toBe(409);
    expect(segunda.body.code).toBe("RESOURCE_ALREADY_EXISTS");
  });

  it("un email de usuario repetido", async () => {
    const res = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({
        email: FIXTURES.admin.email,
        password: "otra-password-123",
        fullName: "Admin Duplicado",
        role: "buyer"
      });

    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).not.toContain("User");
    expect(JSON.stringify(res.body)).not.toContain("email");
  });
});

describe("una referencia que no existe es 400, no 500", () => {
  it("agregar como miembro un userId inventado", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/members`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ userId: "no-existe-este-id", membershipRole: "buyer" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("RELATED_RESOURCE_NOT_FOUND");
  });
});
