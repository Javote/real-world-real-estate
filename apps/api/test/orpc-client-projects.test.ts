import type http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { projectsOrpcRouter } from "../src/routes/projects.routes";
import { FIXTURES } from "./global-setup";
import { createORPCClient, OpenAPILink, type RouterClient } from "./helpers/orpc";

function crearCliente(link: InstanceType<typeof OpenAPILink>) {
  return createORPCClient<RouterClient<typeof projectsOrpcRouter>>(link);
}

// SPEC-216 §E6 — mismo patrón que `orpc-client-profile.test.ts`. Cubre el
// CRUD de proyecto + miembros; `projects-obra.routes.ts` (mismo prefijo,
// stages/retry-anchor) tiene su propio archivo.
let servidor: http.Server;
let baseUrl: string;
let tokenAdmin: string;
let tokenDev: string;
let proyecto: string;

beforeAll(async () => {
  servidor = app.listen(0);
  const { port } = servidor.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1/projects`;

  proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;

  const loginAdmin = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: FIXTURES.admin.email, password: FIXTURES.admin.password });
  tokenAdmin = loginAdmin.body.token;

  const loginDev = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: FIXTURES.activo.email, password: FIXTURES.activo.password });
  tokenDev = loginDev.body.token;
});

afterAll(async () => {
  servidor.close();
  await db.destroy();
});

describe("cliente oRPC tipado de projects, contra el servidor real (SPEC-216 §E6)", () => {
  it("projectListProcedure: el cliente tipado recibe la lista scopeada por membresía", async () => {
    const link = new OpenAPILink(projectsOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenDev}` })
    });
    const client = crearCliente(link);

    const lista = await client.projectListProcedure({});
    expect(lista.some((p) => p.id === proyecto)).toBe(true);
  });

  it("createProjectProcedure + updateProjectProcedure: crea y edita, 201 y 200", async () => {
    const link = new OpenAPILink(projectsOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    const creado = await client.createProjectProcedure({
      name: "Cliente oRPC Test",
      slug: `orpc-client-test-${Date.now()}`,
      totalUnits: 1
    });
    expect(creado.name).toBe("Cliente oRPC Test");

    const editado = await client.updateProjectProcedure({ id: creado.id, name: "Renombrado" });
    expect(editado.name).toBe("Renombrado");

    await client.deleteProjectProcedure({ id: creado.id });
  });

  it("createProjectProcedure: un slug repetido es RESOURCE_ALREADY_EXISTS, no un 500", async () => {
    const link = new OpenAPILink(projectsOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    await expect(
      client.createProjectProcedure({
        name: "Duplicado",
        slug: FIXTURES.proyecto.slug,
        totalUnits: 1
      })
    ).rejects.toMatchObject({
      code: "RESOURCE_ALREADY_EXISTS",
      status: 409
    });
  });

  it("projectByIdProcedure: el detalle trae stages y miembros", async () => {
    const link = new OpenAPILink(projectsOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenDev}` })
    });
    const client = crearCliente(link);

    const detalle = await client.projectByIdProcedure({ id: proyecto });
    expect(detalle.id).toBe(proyecto);
    expect(Array.isArray(detalle.stages)).toBe(true);
    expect(Array.isArray(detalle.members)).toBe(true);
  });

  it("projectMembersProcedure: lista los miembros del proyecto", async () => {
    const link = new OpenAPILink(projectsOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenDev}` })
    });
    const client = crearCliente(link);

    const miembros = await client.projectMembersProcedure({ id: proyecto });
    expect(Array.isArray(miembros)).toBe(true);
  });

  it("addProjectMemberProcedure: un userId inventado es RELATED_RESOURCE_NOT_FOUND", async () => {
    const link = new OpenAPILink(projectsOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    await expect(
      client.addProjectMemberProcedure({
        id: proyecto,
        userId: "no-existe-este-id",
        membershipRole: "buyer"
      })
    ).rejects.toMatchObject({
      code: "RELATED_RESOURCE_NOT_FOUND",
      status: 400
    });
  });

  it("projectDocumentsProcedure y buildingSchematicProcedure: el cliente tipado recibe listas", async () => {
    const link = new OpenAPILink(projectsOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenDev}` })
    });
    const client = crearCliente(link);

    const documentos = await client.projectDocumentsProcedure({ id: proyecto });
    expect(Array.isArray(documentos)).toBe(true);

    const esquema = await client.buildingSchematicProcedure({ id: proyecto });
    expect(Array.isArray(esquema)).toBe(true);
  });
});
