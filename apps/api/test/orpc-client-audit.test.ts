import type http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { auditOrpcRouter } from "../src/routes/audit.routes";
import { FIXTURES } from "./global-setup";
import { createORPCClient, OpenAPILink, type RouterClient } from "./helpers/orpc";

function crearCliente(link: InstanceType<typeof OpenAPILink>) {
  return createORPCClient<RouterClient<typeof auditOrpcRouter>>(link);
}

// SPEC-216 §E3 — mismo patrón que `orpc-client-profile.test.ts`.
let servidor: http.Server;
let baseUrl: string;
let tokenAdmin: string;
let tokenDev: string;

beforeAll(async () => {
  servidor = app.listen(0);
  const { port } = servidor.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1/audit-logs`;

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

describe("cliente oRPC tipado de audit, contra el servidor real (SPEC-216 §E3)", () => {
  it("auditLogsProcedure: el cliente tipado recibe una lista", async () => {
    const link = new OpenAPILink(auditOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    const logs = await client.auditLogsProcedure();

    // El tipo de `logs` ya es `AuditLogRow[]` (inferido del mismo
    // `auditLogRowSchema` que valida en el servidor) — sin cast.
    expect(Array.isArray(logs)).toBe(true);
  });

  it("reservationToEscrowProcedure: la mediana es un número o null, nunca negativa", async () => {
    const link = new OpenAPILink(auditOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    const telemetria = await client.reservationToEscrowProcedure();

    expect(typeof telemetria.sampleSize).toBe("number");
    if (telemetria.medianMinutes !== null) {
      expect(telemetria.medianMinutes).toBeGreaterThanOrEqual(0);
    }
  });

  it("un no-admin recibe FORBIDDEN, no ve una respuesta de oRPC", async () => {
    const link = new OpenAPILink(auditOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenDev}` })
    });
    const client = crearCliente(link);

    await expect(client.auditLogsProcedure()).rejects.toMatchObject({ status: 403 });
  });
});
