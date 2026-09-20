import type http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { notaryOrpcRouter } from "../src/routes/notary.routes";
import { FIXTURES } from "./global-setup";
import { createORPCClient, OpenAPILink, type RouterClient } from "./helpers/orpc";

function crearCliente(link: InstanceType<typeof OpenAPILink>) {
  return createORPCClient<RouterClient<typeof notaryOrpcRouter>>(link);
}

// SPEC-212 §A — "Cubre: generar el cliente oRPC tipado para esa vertical
// (@orpc/client), como prueba de que el contrato es real de los dos lados".
//
// No hay caller real todavía (`apps/web` sigue en `ApiPort`, migrarlo es
// SPEC-111, fuera de esta spec) — este test ES la prueba: arma el cliente
// desde el MISMO `notaryOrpcRouter` que exporta `notary.routes.ts` (no un
// tipo copiado a mano), habla HTTP de verdad contra el servidor completo
// (`authorize` incluido, sin mockear nada) y verifica que lo que el cliente
// tipa es lo que el servidor de verdad devuelve.
let servidor: http.Server;
let baseUrl: string;
let tokenNotario: string;

beforeAll(async () => {
  servidor = app.listen(0);
  const { port } = servidor.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1/notary`;

  const login = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: FIXTURES.notario.email, password: FIXTURES.notario.password });
  tokenNotario = login.body.token;
});

afterAll(async () => {
  servidor.close();
  await db.destroy();
});

describe("cliente oRPC tipado de notary, contra el servidor real (SPEC-212 §A)", () => {
  it("kpisProcedure: el cliente tipado recibe la misma forma que devuelve el handler", async () => {
    const link = new OpenAPILink(notaryOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenNotario}` })
    });
    const client = crearCliente(link);

    const kpis = await client.kpisProcedure();

    // El tipo de `kpis` ya es `NotaryKpis` (inferido del mismo
    // `notaryKpisSchema` que valida en el servidor) — estas propiedades
    // typechequean sin cast.
    expect(typeof kpis.pendingDossiers).toBe("number");
    expect(typeof kpis.verified).toBe("number");
    expect(typeof kpis.signed).toBe("number");
    expect(typeof kpis.unitsUnderReview).toBe("number");
  });

  it("dossierByIdProcedure: un id inexistente llega como el mismo 404 que ve `supertest`", async () => {
    const link = new OpenAPILink(notaryOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenNotario}` })
    });
    const client = crearCliente(link);

    await expect(
      client.dossierByIdProcedure({ id: "aaaaaaaaaaaaaaaaaaaaaaaa" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404
    });
  });

  it("sin token, `authorize` rechaza ANTES de que el cliente vea una respuesta de oRPC", async () => {
    const link = new OpenAPILink(notaryOrpcRouter, { url: baseUrl });
    const client = crearCliente(link);

    await expect(client.kpisProcedure()).rejects.toMatchObject({ status: 401 });
  });
});
