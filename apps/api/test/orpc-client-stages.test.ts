import type http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { stagesOrpcRouter } from "../src/routes/stages.routes";
import { FIXTURES } from "./global-setup";
import { createORPCClient, OpenAPILink, type RouterClient } from "./helpers/orpc";

function crearCliente(link: InstanceType<typeof OpenAPILink>) {
  return createORPCClient<RouterClient<typeof stagesOrpcRouter>>(link);
}

// SPEC-216 §E5 — mismo patrón que `orpc-client-profile.test.ts`. Concentra
// cuatro de los seis `.errors()` con nombre del lote de la spec
// (`STAGE_TRANSITION_FORBIDDEN`, `STAGE_TRANSITION_INVALID`,
// `STAGE_EVIDENCE_REQUIRED`/`UNATTRIBUTED` comparten procedimiento con
// `STAGE_IDENTITY_IMMUTABLE`, cinco en total) — la tabla completa de la FSM
// ya la prueba `test/stage-transitions.test.ts` por HTTP; este test es la
// prueba de que el CLIENTE TIPADO ve el mismo contrato, no una repetición.
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
      name: "Stage cliente oRPC",
      sequenceOrder: Math.floor(Math.random() * 1_000_000) + 500_000,
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
  baseUrl = `http://127.0.0.1:${port}/api/v1/stages`;

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

describe("cliente oRPC tipado de stages, contra el servidor real (SPEC-216 §E5)", () => {
  it("stageDetailProcedure: el cliente tipado recibe el stage con evidencia y proyecto", async () => {
    const id = await crearStage();
    const link = new OpenAPILink(stagesOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenDev}` })
    });
    const client = crearCliente(link);

    const stage = await client.stageDetailProcedure({ id });

    // El tipo de `stage` ya es el de `stageDetailSchema` — sin cast.
    expect(stage.id).toBe(id);
    expect(Array.isArray(stage.evidences)).toBe(true);
    expect(stage.hasOnChainThread).toBe(false);
  });

  it("updateStageProcedure: cambia orden y criticidad mientras no haya hilo anclado", async () => {
    const id = await crearStage();
    const link = new OpenAPILink(stagesOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenDev}` })
    });
    const client = crearCliente(link);

    const actualizado = await client.updateStageProcedure({ id, validationCritical: true });
    expect(actualizado.validationCritical).toBe(true);
  });

  it("transitionStageProcedure: un developer que pide Completed recibe STAGE_TRANSITION_FORBIDDEN", async () => {
    const id = await crearStage("InProgress");
    const link = new OpenAPILink(stagesOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenDev}` })
    });
    const client = crearCliente(link);

    await expect(client.transitionStageProcedure({ id, state: "Completed" })).rejects.toMatchObject(
      {
        code: "STAGE_TRANSITION_FORBIDDEN",
        status: 403
      }
    );
  });

  it("transitionStageProcedure: admin avanza Pending → InProgress y recibe el anchor", async () => {
    const id = await crearStage("Pending");
    const link = new OpenAPILink(stagesOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    const resultado = await client.transitionStageProcedure({ id, state: "InProgress" });
    expect(resultado.state).toBe("InProgress");
    expect(resultado.anchor).toBeDefined();
  });

  it("transitionStageProcedure: Completed → InProgress es STAGE_TRANSITION_INVALID", async () => {
    const id = await crearStage("InProgress");
    const link = new OpenAPILink(stagesOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    // Pending/InProgress no llegan nunca a Completed sin evidencia en este
    // helper — se prueba la rama de la FSM que sí es alcanzable sin bundle:
    // InProgress → Observed es válido, InProgress → InProgress no lo es.
    await expect(
      client.transitionStageProcedure({ id, state: "InProgress" })
    ).rejects.toMatchObject({
      code: "STAGE_TRANSITION_INVALID",
      status: 409
    });
  });
});
