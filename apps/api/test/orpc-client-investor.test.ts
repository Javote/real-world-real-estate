import type http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { investorOrpcRouter } from "../src/routes/investor.routes";
import { FIXTURES } from "./global-setup";
import { createORPCClient, OpenAPILink, type RouterClient } from "./helpers/orpc";

function crearCliente(link: InstanceType<typeof OpenAPILink>) {
  return createORPCClient<RouterClient<typeof investorOrpcRouter>>(link);
}

// SPEC-212 §C — mismo patrón de prueba que §A/§B: "Cubre: generar el
// cliente oRPC tipado para esa vertical, como prueba de que el contrato es
// real de los dos lados". Sin caller real todavía (SPEC-111).
let servidor: http.Server;
let baseUrl: string;
let tokenInvestor: string;

beforeAll(async () => {
  servidor = app.listen(0);
  const { port } = servidor.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1/investor`;

  const login = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: FIXTURES.investor.email, password: FIXTURES.investor.password });
  tokenInvestor = login.body.token;
});

afterAll(async () => {
  servidor.close();
  await db.destroy();
});

describe("cliente oRPC tipado de investor, contra el servidor real (SPEC-212 §C)", () => {
  it("favoritesProcedure: el cliente tipado recibe la misma forma que devuelve el handler", async () => {
    const link = new OpenAPILink(investorOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenInvestor}` })
    });
    const client = crearCliente(link);

    const favoritos = await client.favoritesProcedure();

    // El tipo ya es `Project[]` (inferido de `projectSchema`) — sin cast.
    expect(Array.isArray(favoritos)).toBe(true);
  });

  it("unitDetailProcedure: un id inexistente llega como el mismo 404 que ve `supertest`", async () => {
    const link = new OpenAPILink(investorOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenInvestor}` })
    });
    const client = crearCliente(link);

    await expect(
      client.unitDetailProcedure({ id: "aaaaaaaaaaaaaaaaaaaaaaaa" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404
    });
  });

  it("sin token, `authorize` rechaza ANTES de que el cliente vea una respuesta de oRPC", async () => {
    const link = new OpenAPILink(investorOrpcRouter, { url: baseUrl });
    const client = crearCliente(link);

    await expect(client.favoritesProcedure()).rejects.toMatchObject({ status: 401 });
  });
});
