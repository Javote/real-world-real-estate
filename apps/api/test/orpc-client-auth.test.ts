import type http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { authOrpcRouter } from "../src/routes/auth.routes";
import { FIXTURES } from "./global-setup";
import { createORPCClient, OpenAPILink, type RouterClient } from "./helpers/orpc";

function crearCliente(link: InstanceType<typeof OpenAPILink>) {
  return createORPCClient<RouterClient<typeof authOrpcRouter>>(link);
}

// SPEC-216 §E2 — mismo patrón que `orpc-client-profile.test.ts`, pero es el
// primer router con procedimientos de DISTINTO contexto inicial en el mismo
// combinado (`loginProcedure` sin `user`, `meProcedure` con `user`
// obligatorio en tiempo de ejecución) — lo que `notary.routes.ts` solo
// anticipaba en un comentario. Este test es la prueba de que
// `os.$context<AuthContext>().prefix(...).router(authOrpcRouter)` tipa y
// funciona con los dos, no solo que compile.
let servidor: http.Server;
let baseUrl: string;

beforeAll(async () => {
  servidor = app.listen(0);
  const { port } = servidor.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1/auth`;
});

afterAll(async () => {
  servidor.close();
  await db.destroy();
});

describe("cliente oRPC tipado de auth, contra el servidor real (SPEC-216 §E2)", () => {
  it("loginProcedure: sin sesión previa, devuelve token y usuario sin passwordHash", async () => {
    const link = new OpenAPILink(authOrpcRouter, { url: baseUrl });
    const client = crearCliente(link);

    const sesion = await client.loginProcedure({
      email: FIXTURES.activo.email,
      password: FIXTURES.activo.password
    });

    // El tipo de `sesion` ya es `LoginResponse` (inferido del mismo
    // `loginResponseSchema` que valida en el servidor) — sin cast.
    expect(sesion.token).toBeTruthy();
    expect(sesion.user.email).toBe(FIXTURES.activo.email);
    expect(sesion.user).not.toHaveProperty("passwordHash");
  });

  it("loginProcedure: password incorrecta rechaza con 401", async () => {
    const link = new OpenAPILink(authOrpcRouter, { url: baseUrl });
    const client = crearCliente(link);

    await expect(
      client.loginProcedure({ email: FIXTURES.activo.email, password: "mala" })
    ).rejects.toMatchObject({ status: 401 });
  });

  it("meProcedure: con el token de login, devuelve el mismo usuario", async () => {
    const linkLogin = new OpenAPILink(authOrpcRouter, { url: baseUrl });
    const clienteLogin = crearCliente(linkLogin);
    const sesion = await clienteLogin.loginProcedure({
      email: FIXTURES.activo.email,
      password: FIXTURES.activo.password
    });

    const linkMe = new OpenAPILink(authOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${sesion.token}` })
    });
    const clienteMe = crearCliente(linkMe);

    const yo = await clienteMe.meProcedure();
    expect(yo.id).toBe(sesion.user.id);
    expect(yo).not.toHaveProperty("passwordHash");
  });

  it("meProcedure: sin token, `authorize` rechaza ANTES de que el cliente vea una respuesta de oRPC", async () => {
    const link = new OpenAPILink(authOrpcRouter, { url: baseUrl });
    const client = crearCliente(link);

    await expect(client.meProcedure()).rejects.toMatchObject({ status: 401 });
  });
});
