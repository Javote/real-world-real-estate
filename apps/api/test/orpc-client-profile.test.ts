import type http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { profileOrpcRouter } from "../src/routes/profile.routes";
import { FIXTURES } from "./global-setup";
import { createORPCClient, OpenAPILink, type RouterClient } from "./helpers/orpc";

function crearCliente(link: InstanceType<typeof OpenAPILink>) {
  return createORPCClient<RouterClient<typeof profileOrpcRouter>>(link);
}

// SPEC-216 §E1 — mismo patrón de prueba que las cuatro sub-partes de
// SPEC-212 (`test/orpc-client-notary.test.ts` y hermanos): "Cubre: generar el
// cliente oRPC tipado para cada archivo migrado, como prueba de que el
// contrato es real". Sin caller real todavía (SPEC-111 sigue pendiente).
let servidor: http.Server;
let baseUrl: string;
let token: string;

beforeAll(async () => {
  servidor = app.listen(0);
  const { port } = servidor.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1/profile`;

  const login = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: FIXTURES.activo.email, password: FIXTURES.activo.password });
  token = login.body.token;
});

afterAll(async () => {
  servidor.close();
  await db.destroy();
});

describe("cliente oRPC tipado de profile, contra el servidor real (SPEC-216 §E1)", () => {
  it("profileProcedure: el cliente tipado recibe la misma forma que devuelve el handler", async () => {
    const link = new OpenAPILink(profileOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${token}` })
    });
    const client = crearCliente(link);

    const perfil = await client.profileProcedure();

    // El tipo de `perfil` ya es `Profile` (inferido del mismo `profileSchema`
    // que valida en el servidor) — sin cast.
    expect(perfil.email).toBe(FIXTURES.activo.email);
    expect(perfil).not.toHaveProperty("passwordHash");
  });

  it("updateProfileProcedure: guarda y devuelve el nombre actualizado", async () => {
    const link = new OpenAPILink(profileOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${token}` })
    });
    const client = crearCliente(link);

    const actualizado = await client.updateProfileProcedure({ fullName: "Dev Renombrado" });
    expect(actualizado.fullName).toBe("Dev Renombrado");

    // Vuelve a "Dev Test" para no ensuciar el resto de la suite, que comparte
    // la misma base entre archivos.
    await client.updateProfileProcedure({ fullName: FIXTURES.activo.fullName });
  });

  it("sin token, `authorize` rechaza ANTES de que el cliente vea una respuesta de oRPC", async () => {
    const link = new OpenAPILink(profileOrpcRouter, { url: baseUrl });
    const client = crearCliente(link);

    await expect(client.profileProcedure()).rejects.toMatchObject({ status: 401 });
  });
});
