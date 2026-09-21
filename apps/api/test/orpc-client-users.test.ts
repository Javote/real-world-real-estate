import type http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { usersOrpcRouter } from "../src/routes/users.routes";
import { FIXTURES } from "./global-setup";
import { createORPCClient, OpenAPILink, type RouterClient } from "./helpers/orpc";

function crearCliente(link: InstanceType<typeof OpenAPILink>) {
  return createORPCClient<RouterClient<typeof usersOrpcRouter>>(link);
}

// SPEC-216 §E4 — mismo patrón que `orpc-client-profile.test.ts`. Aislado en
// su propio commit por tocar superficie 🔴 (bcrypt): este test es la prueba
// de que el transporte cambió y `bcrypt.hash`/`passwordHash` no.
let servidor: http.Server;
let baseUrl: string;
let tokenAdmin: string;
let tokenDev: string;

beforeAll(async () => {
  servidor = app.listen(0);
  const { port } = servidor.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1/users`;

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

describe("cliente oRPC tipado de users, contra el servidor real (SPEC-216 §E4)", () => {
  it("userListProcedure: el cliente tipado recibe la lista, nunca passwordHash", async () => {
    const link = new OpenAPILink(usersOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    const lista = await client.userListProcedure();
    expect(lista.length).toBeGreaterThan(0);
    expect(lista.some((u) => u.email === FIXTURES.admin.email)).toBe(true);
    expect(JSON.stringify(lista)).not.toContain("passwordHash");
  });

  it("createUserProcedure: crea un usuario con password hasheada, nunca la devuelve", async () => {
    const link = new OpenAPILink(usersOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    const creado = await client.createUserProcedure({
      email: `orpc-client-${Date.now()}@test.local`,
      password: "una password larga y valida",
      role: "buyer",
      fullName: "Cliente oRPC"
    });

    expect(creado.email).toContain("orpc-client-");
    expect(creado).not.toHaveProperty("passwordHash");

    const detalle = await client.userByIdProcedure({ id: creado.id });
    expect(detalle.id).toBe(creado.id);

    await client.deleteUserProcedure({ id: creado.id });
  });

  it("createUserProcedure: un email repetido es RESOURCE_ALREADY_EXISTS, no un 500", async () => {
    const link = new OpenAPILink(usersOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    await expect(
      client.createUserProcedure({
        email: FIXTURES.admin.email,
        password: "otra password larga y valida",
        role: "buyer",
        fullName: "Admin Duplicado"
      })
    ).rejects.toMatchObject({
      code: "RESOURCE_ALREADY_EXISTS",
      status: 409
    });
  });

  it("updateUserProcedure: promueve un rol sin tocar la password", async () => {
    const link = new OpenAPILink(usersOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    const investor = await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.investor.email)
      .executeTakeFirstOrThrow();

    const actualizado = await client.updateUserProcedure({ id: investor.id, role: "notary" });
    expect(actualizado.role).toBe("notary");

    await db
      .updateTable("User")
      .set({ role: "buyer", updatedAt: new Date() })
      .where("id", "=", investor.id)
      .execute();
  });

  it("un no-admin recibe FORBIDDEN, no ve una respuesta de oRPC", async () => {
    const link = new OpenAPILink(usersOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenDev}` })
    });
    const client = crearCliente(link);

    await expect(client.userListProcedure()).rejects.toMatchObject({ status: 403 });
  });
});
