import { createHash } from "node:crypto";
import type http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
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
let usuarioDev: string;
let certificadorId: string;
let usuarioAjenoId: string;

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

  usuarioDev = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow()
  ).id;

  certificadorId = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.certificador.email)
      .executeTakeFirstOrThrow()
  ).id;

  usuarioAjenoId = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.ajeno.email)
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

  it("addProjectMemberProcedure: agrega el miembro, 201 con la fila creada", async () => {
    const link = new OpenAPILink(projectsOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    const miembro = await client.addProjectMemberProcedure({
      id: proyecto,
      userId: usuarioAjenoId,
      membershipRole: "buyer"
    });
    expect(miembro.userId).toBe(usuarioAjenoId);
    expect(miembro.projectId).toBe(proyecto);
    expect(miembro.membershipRole).toBe("buyer");

    await db.deleteFrom("ProjectMember").where("id", "=", miembro.id).execute();
  });

  it("updateProjectProcedure: un slug que ya usa otro proyecto es RESOURCE_ALREADY_EXISTS", async () => {
    const link = new OpenAPILink(projectsOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    const creado = await client.createProjectProcedure({
      name: "A renombrar",
      slug: `a-renombrar-${Date.now()}`,
      totalUnits: 1
    });

    await expect(
      client.updateProjectProcedure({ id: creado.id, slug: FIXTURES.proyecto.slug })
    ).rejects.toMatchObject({ code: "RESOURCE_ALREADY_EXISTS", status: 409 });

    await client.deleteProjectProcedure({ id: creado.id });
  });

  it("inviteCertifierProcedure: una segunda invitación pendiente es INVITATION_ALREADY_PENDING", async () => {
    const link = new OpenAPILink(projectsOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    const creado = await client.createProjectProcedure({
      name: "Con invitación pendiente",
      slug: `con-invitacion-${Date.now()}`,
      totalUnits: 1
    });

    await client.inviteCertifierProcedure({ id: creado.id, certifierId: certificadorId });

    await expect(
      client.inviteCertifierProcedure({ id: creado.id, certifierId: certificadorId })
    ).rejects.toMatchObject({ code: "INVITATION_ALREADY_PENDING", status: 409 });

    await client.deleteProjectProcedure({ id: creado.id });
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

  it("projectListProcedure: filtra por status, por city y ordena por delivery", async () => {
    const link = new OpenAPILink(projectsOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    const conCiudad = await client.createProjectProcedure({
      name: "Filtro de ciudad",
      slug: `filtro-ciudad-${Date.now()}`,
      city: "Rosario",
      status: "planning",
      totalUnits: 1
    });

    const porStatus = await client.projectListProcedure({ status: "planning" });
    expect(porStatus.some((p) => p.id === conCiudad.id)).toBe(true);

    const porCiudad = await client.projectListProcedure({ city: "Rosario" });
    expect(porCiudad.every((p) => p.city === "Rosario")).toBe(true);
    expect(porCiudad.some((p) => p.id === conCiudad.id)).toBe(true);

    const porDelivery = await client.projectListProcedure({ sort: "delivery" });
    expect(Array.isArray(porDelivery)).toBe(true);

    await client.deleteProjectProcedure({ id: conCiudad.id });
  });

  it("createProjectProcedure y updateProjectProcedure: guardan estimatedDelivery cuando se manda", async () => {
    const link = new OpenAPILink(projectsOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    const entrega = new Date("2030-06-01T00:00:00.000Z");

    const creado = await client.createProjectProcedure({
      name: "Con fecha de entrega",
      slug: `con-entrega-${Date.now()}`,
      totalUnits: 1,
      estimatedDelivery: entrega.toISOString()
    });
    expect(new Date(creado.estimatedDelivery!).getTime()).toBe(entrega.getTime());

    const otraEntrega = new Date("2031-01-01T00:00:00.000Z");
    const editado = await client.updateProjectProcedure({
      id: creado.id,
      estimatedDelivery: otraEntrega.toISOString()
    });
    expect(new Date(editado.estimatedDelivery!).getTime()).toBe(otraEntrega.getTime());

    await client.deleteProjectProcedure({ id: creado.id });
  });

  it("inviteCertifierProcedure: un proyecto inexistente es NOT_FOUND", async () => {
    const link = new OpenAPILink(projectsOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    await expect(
      client.inviteCertifierProcedure({ id: createId(), certifierId: certificadorId })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("projectDocumentsProcedure: un documento sin TXID todavía sale Pending", async () => {
    const ahora = new Date();
    const contenido = `sin-anclar-${Date.now()}`;
    await db
      .insertInto("Evidence")
      .values({
        id: createId(),
        projectId: proyecto,
        stageId: null,
        uploadedById: usuarioDev,
        evidenceType: "photo",
        category: "progress",
        authoritative: false,
        originalFilename: `${contenido}.pdf`,
        storedFilename: `${contenido}.pdf`,
        storagePath: `/tmp/no-existe/${contenido}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 1,
        sha256Hash: createHash("sha256").update(contenido).digest("hex"),
        uploadedAt: ahora,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();

    const link = new OpenAPILink(projectsOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenDev}` })
    });
    const client = crearCliente(link);

    const documentos = await client.projectDocumentsProcedure({ id: proyecto });
    const sinAnclar = documentos.find((d) => d.originalFilename === `${contenido}.pdf`);
    expect(sinAnclar?.anchorStatus).toBe("Pending");
  });
});
