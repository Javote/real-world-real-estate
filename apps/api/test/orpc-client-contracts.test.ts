import type http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { contractsOrpcRouter } from "../src/routes/contracts.routes";
import { FIXTURES } from "./global-setup";
import { createORPCClient, OpenAPILink, type RouterClient } from "./helpers/orpc";

function crearCliente(link: InstanceType<typeof OpenAPILink>) {
  return createORPCClient<RouterClient<typeof contractsOrpcRouter>>(link);
}

// SPEC-216 §E3 — mismo patrón que `orpc-client-profile.test.ts`. `authorize`
// sigue resolviendo la única regla disyuntiva (`alguna`) de la API ANTES de
// que oRPC vea la request: este test prueba las dos ramas, no que oRPC sepa
// nada de la disyunción.
let servidor: http.Server;
let baseUrl: string;
let contratoId: string;

beforeAll(async () => {
  servidor = app.listen(0);
  const { port } = servidor.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1/contracts`;

  const ahora = new Date();
  const proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
  const dueño = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.investor.email)
      .executeTakeFirstOrThrow()
  ).id;

  const unidad = createId();
  await db
    .insertInto("Unit")
    .values({
      id: unidad,
      projectId: proyecto,
      unitReference: "ORPC-CLIENT-1",
      status: "sold",
      priceMinorUnits: 1_000_000,
      currency: "USD",
      investorId: dueño,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();

  contratoId = createId();
  await db
    .insertInto("Contract")
    .values({
      id: contratoId,
      unitId: unidad,
      investorId: dueño,
      totalMinorUnits: 1_000_000,
      currency: "USD",
      signedAt: ahora,
      createdAt: ahora
    })
    .execute();
});

afterAll(async () => {
  servidor.close();
  await db.destroy();
});

describe("cliente oRPC tipado de contracts, contra el servidor real (SPEC-216 §E3)", () => {
  it("releasesProcedure: el dueño del contrato ve sus liberaciones (rama `dueño`)", async () => {
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: FIXTURES.investor.email, password: FIXTURES.investor.password });

    const link = new OpenAPILink(contractsOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${login.body.token}` })
    });
    const client = crearCliente(link);

    // El tipo de `releases` ya es `ContractRelease[]` (inferido del mismo
    // `contractReleaseSchema` que valida en el servidor) — sin cast.
    const releases = await client.releasesProcedure({ contractId: contratoId });
    expect(Array.isArray(releases)).toBe(true);
  });

  it("releasesProcedure: un miembro del proyecto sin ser dueño también ve (rama `proyecto`)", async () => {
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: FIXTURES.activo.email, password: FIXTURES.activo.password });

    const link = new OpenAPILink(contractsOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${login.body.token}` })
    });
    const client = crearCliente(link);

    await expect(client.releasesProcedure({ contractId: contratoId })).resolves.toBeInstanceOf(
      Array
    );
  });

  it("releasesProcedure: un contrato inexistente es NOT_FOUND", async () => {
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: FIXTURES.admin.email, password: FIXTURES.admin.password });

    const link = new OpenAPILink(contractsOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${login.body.token}` })
    });
    const client = crearCliente(link);

    await expect(
      client.releasesProcedure({ contractId: "aaaaaaaaaaaaaaaaaaaaaaaa" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404
    });
  });
});
