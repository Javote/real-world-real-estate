import type http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { projectsObraOrpcRouter } from "../src/routes/projects-obra.routes";
import { FIXTURES } from "./global-setup";
import { createORPCClient, OpenAPILink, type RouterClient } from "./helpers/orpc";

function crearCliente(link: InstanceType<typeof OpenAPILink>) {
  return createORPCClient<RouterClient<typeof projectsObraOrpcRouter>>(link);
}

// SPEC-216 §E6 — mismo patrón que `orpc-client-profile.test.ts`.
let servidor: http.Server;
let baseUrl: string;
let tokenAdmin: string;
let tokenDev: string;
let proyecto: string;

async function crearStage(estado: "Pending" | "InProgress" = "Pending") {
  const ahora = new Date();
  const id = createId();
  await db
    .insertInto("Stage")
    .values({
      id,
      projectId: proyecto,
      name: "Stage cliente oRPC obra",
      sequenceOrder: Math.floor(Math.random() * 1_000_000) + 600_000,
      state: estado,
      validationCritical: false,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

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

describe("cliente oRPC tipado de projects-obra, contra el servidor real (SPEC-216 §E6)", () => {
  it("stagesOfProjectProcedure: el cliente tipado recibe la lista con hasOnChainThread", async () => {
    const id = await crearStage();
    const link = new OpenAPILink(projectsObraOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenDev}` })
    });
    const client = crearCliente(link);

    const stages = await client.stagesOfProjectProcedure({ id: proyecto });
    const propio = stages.find((s) => s.id === id);
    expect(propio?.hasOnChainThread).toBe(false);
  });

  it("nestedStageDetailProcedure: el detalle anidado trae evidencia, bundle y eventos", async () => {
    const id = await crearStage();
    const link = new OpenAPILink(projectsObraOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenDev}` })
    });
    const client = crearCliente(link);

    const detalle = await client.nestedStageDetailProcedure({ id: proyecto, stageId: id });
    expect(detalle.id).toBe(id);
    expect(Array.isArray(detalle.evidences)).toBe(true);
    expect(Array.isArray(detalle.events)).toBe(true);
  });

  it("nestedStageDetailProcedure: un stage de otro proyecto es NOT_FOUND (404, no 403)", async () => {
    const otroProyecto = createId();
    const ahora = new Date();
    await db
      .insertInto("Project")
      .values({
        id: otroProyecto,
        name: "Otro proyecto",
        slug: `otro-${Date.now()}`,
        totalUnits: 0,
        status: "planning",
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();
    const stageAjeno = createId();
    await db
      .insertInto("Stage")
      .values({
        id: stageAjeno,
        projectId: otroProyecto,
        name: "Stage ajeno",
        sequenceOrder: 1,
        state: "Pending",
        validationCritical: false,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();

    const link = new OpenAPILink(projectsObraOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    await expect(
      client.nestedStageDetailProcedure({ id: proyecto, stageId: stageAjeno })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404
    });
  });

  it("retryStageAnchorProcedure: un stage que ya avanzó sin hilo es STAGE_ALREADY_ADVANCED", async () => {
    const id = await crearStage("InProgress");
    const link = new OpenAPILink(projectsObraOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    await expect(
      client.retryStageAnchorProcedure({ id: proyecto, stageId: id })
    ).rejects.toMatchObject({
      code: "STAGE_ALREADY_ADVANCED",
      status: 409
    });
  });

  it("retryStageAnchorProcedure: un stage sin evento de creación es STAGE_CREATED_EVENT_NOT_FOUND", async () => {
    const id = await crearStage("Pending");
    const link = new OpenAPILink(projectsObraOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    await expect(
      client.retryStageAnchorProcedure({ id: proyecto, stageId: id })
    ).rejects.toMatchObject({
      code: "STAGE_CREATED_EVENT_NOT_FOUND",
      status: 404
    });
  });
});
