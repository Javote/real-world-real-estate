import type http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { db } from "../src/lib/db.js";
import { certifierOrpcRouter } from "../src/routes/certifier.routes.js";
import { FIXTURES } from "./global-setup.js";
import { createORPCClient, OpenAPILink, type RouterClient } from "./helpers/orpc.js";

function crearCliente(link: InstanceType<typeof OpenAPILink>) {
  return createORPCClient<RouterClient<typeof certifierOrpcRouter>>(link);
}

let servidor: http.Server;
let baseUrl: string;
let tokenCertificador: string;

beforeAll(async () => {
  servidor = app.listen(0);
  const { port } = servidor.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1/certifier`;

  const login = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: FIXTURES.certificador.email, password: FIXTURES.certificador.password });
  tokenCertificador = login.body.token;
});

afterAll(async () => {
  servidor.close();
  await db.destroy();
});

describe("cliente oRPC tipado de certifier, contra el servidor real (SPEC-212 §B)", () => {
  it("kpisProcedure: el cliente tipado recibe la misma forma que devuelve el handler", async () => {
    const link = new OpenAPILink(certifierOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenCertificador}` })
    });
    const client = crearCliente(link);

    const kpis = await client.kpisProcedure();

    expect(typeof kpis.assigned).toBe("number");
    expect(typeof kpis.certified).toBe("number");
    expect(typeof kpis.observed).toBe("number");
    expect(typeof kpis.totalStages).toBe("number");
  });

  it("stageViewProcedure: un id inexistente llega como el mismo 404 que ve `supertest`", async () => {
    const link = new OpenAPILink(certifierOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenCertificador}` })
    });
    const client = crearCliente(link);

    await expect(
      client.stageViewProcedure({ id: "aaaaaaaaaaaaaaaaaaaaaaaa" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404
    });
  });

  it("sin token, `authorize` rechaza ANTES de que el cliente vea una respuesta de oRPC", async () => {
    const link = new OpenAPILink(certifierOrpcRouter, { url: baseUrl });
    const client = crearCliente(link);

    await expect(client.kpisProcedure()).rejects.toMatchObject({ status: 401 });
  });
});
