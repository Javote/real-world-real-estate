import type http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { db } from "../src/lib/db.js";
import { publicOrpcRouter } from "../src/routes/public.routes.js";
import { FIXTURES } from "./global-setup.js";
import { createORPCClient, OpenAPILink, type RouterClient } from "./helpers/orpc.js";

function crearCliente(link: InstanceType<typeof OpenAPILink>) {
  return createORPCClient<RouterClient<typeof publicOrpcRouter>>(link);
}

let servidor: http.Server;
let baseUrl: string;
let shareToken: string;

beforeAll(async () => {
  servidor = app.listen(0);
  const { port } = servidor.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1/public`;

  const login = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: FIXTURES.investor.email, password: FIXTURES.investor.password });

  const unidad = await db
    .selectFrom("Unit")
    .select("id")
    .where("unitReference", "=", FIXTURES.unidad.unitReference)
    .executeTakeFirstOrThrow();

  const compartido = await request(app)
    .post(`/api/v1/investor/units/${unidad.id}/dossier/share`)
    .set("Authorization", `Bearer ${login.body.token}`);
  shareToken = compartido.body.shareToken;
});

afterAll(async () => {
  servidor.close();
  await db.destroy();
});

describe("cliente oRPC tipado de public, contra el servidor real (SPEC-216 §E2)", () => {
  it("publicDossierProcedure: sin ningún header, devuelve el dossier recortado", async () => {
    const link = new OpenAPILink(publicOrpcRouter, { url: baseUrl });
    const client = crearCliente(link);

    const dossier = await client.publicDossierProcedure({ shareToken });

    expect(dossier.unitReference).toBe(FIXTURES.unidad.unitReference);
    expect(dossier).not.toHaveProperty("investorId");
    expect(dossier).not.toHaveProperty("unitId");
  });

  it("un token bien formado que no existe es NOT_FOUND", async () => {
    const link = new OpenAPILink(publicOrpcRouter, { url: baseUrl });
    const client = crearCliente(link);

    await expect(
      client.publicDossierProcedure({ shareToken: "a".repeat(64) })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404
    });
  });
});
