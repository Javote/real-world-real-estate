import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// Violaciones de restricción de la base — `middlewares/errorHandler.ts`.
//
// **Antes esto era 500 en todos los casos.** Crear un proyecto con un slug que
// ya existe, o un stage con un orden repetido, hacía que el servicio se
// reportara roto a sí mismo: el monitoreo veía un 5xx donde el servidor estaba
// perfectamente sano y el cliente había mandado un duplicado. Y la ventana de
// carrera hace que un `select` previo por ruta no alcance: dos requests
// simultáneos lo pasan los dos.
//
// Lo segundo que se fija acá: que el mensaje del cliente **no traiga el nombre
// de la tabla ni de la columna**. El error crudo de libSQL dice
// `UNIQUE constraint failed: Project.slug` y eso no puede salir (regla 2).

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

let tokenDev: string;
let tokenAdmin: string;
let projectId: string;

// Base propia por archivo (SPEC-015 §1): este número no se coordina con nadie.
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
      .send({ name: "Torre Duplicada", slug: FIXTURES.proyecto.slug, totalUnits: 3 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("RESOURCE_ALREADY_EXISTS");
    // Ni la tabla ni la columna salen al cliente.
    expect(JSON.stringify(res.body)).not.toContain("Project");
    expect(JSON.stringify(res.body)).not.toContain("slug");
  });

  it("dos stages con el mismo orden en el mismo proyecto", async () => {
    const primero = await request(app)
      .post(`/api/v1/projects/${projectId}/stages`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ name: "Losa", sequenceOrder: ETAPA });
    expect(primero.status).toBe(201);

    const segundo = await request(app)
      .post(`/api/v1/projects/${projectId}/stages`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ name: "Losa otra vez", sequenceOrder: ETAPA });

    expect(segundo.status).toBe(409);
    expect(segundo.body.code).toBe("RESOURCE_ALREADY_EXISTS");
    expect(JSON.stringify(segundo.body)).not.toContain("Stage");
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
