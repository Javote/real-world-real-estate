import type http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { notificationsOrpcRouter } from "../src/routes/notifications.routes";
import { FIXTURES } from "./global-setup";
import { createORPCClient, OpenAPILink, type RouterClient } from "./helpers/orpc";

function crearCliente(link: InstanceType<typeof OpenAPILink>) {
  return createORPCClient<RouterClient<typeof notificationsOrpcRouter>>(link);
}

// SPEC-216 §E1 — mismo patrón que `orpc-client-profile.test.ts`.
let servidor: http.Server;
let baseUrl: string;
let token: string;
let investorId: string;

beforeAll(async () => {
  servidor = app.listen(0);
  const { port } = servidor.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1/notifications`;

  const login = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: FIXTURES.investor.email, password: FIXTURES.investor.password });
  token = login.body.token;

  const investor = await db
    .selectFrom("User")
    .select("id")
    .where("email", "=", FIXTURES.investor.email)
    .executeTakeFirstOrThrow();
  investorId = investor.id;
});

afterAll(async () => {
  await db.deleteFrom("Notification").where("userId", "=", investorId).execute();
  servidor.close();
  await db.destroy();
});

describe("cliente oRPC tipado de notifications, contra el servidor real (SPEC-216 §E1)", () => {
  it("unreadCountProcedure: el cliente tipado recibe la misma forma que devuelve el handler", async () => {
    const link = new OpenAPILink(notificationsOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${token}` })
    });
    const client = crearCliente(link);

    const conteo = await client.unreadCountProcedure();

    // El tipo de `conteo` ya es `UnreadCount` (inferido del mismo
    // `unreadCountSchema` que valida en el servidor) — sin cast.
    expect(typeof conteo.unread).toBe("number");
  });

  it("markReadProcedure: marca una notificación propia como leída, 204 sin cuerpo", async () => {
    const notificacionId = createId();
    await db
      .insertInto("Notification")
      .values({
        id: notificacionId,
        userId: investorId,
        category: "stage",
        titleKey: "notifications.stage.completed",
        paramsJson: JSON.stringify({}),
        unitId: null,
        readAt: null,
        createdAt: new Date()
      })
      .execute();

    const link = new OpenAPILink(notificationsOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${token}` })
    });
    const client = crearCliente(link);

    await expect(client.markReadProcedure({ id: notificacionId })).resolves.toBeUndefined();

    const fila = await db
      .selectFrom("Notification")
      .select("readAt")
      .where("id", "=", notificacionId)
      .executeTakeFirstOrThrow();
    expect(fila.readAt).not.toBeNull();
  });

  it("markReadProcedure: la notificación de otro es NOT_FOUND, no un 403", async () => {
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: FIXTURES.activo.email, password: FIXTURES.activo.password });

    const link = new OpenAPILink(notificationsOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${login.body.token}` })
    });
    const client = crearCliente(link);

    await expect(
      client.markReadProcedure({ id: "aaaaaaaaaaaaaaaaaaaaaaaa" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404
    });
  });

  it("sin token, `authorize` rechaza ANTES de que el cliente vea una respuesta de oRPC", async () => {
    const link = new OpenAPILink(notificationsOrpcRouter, { url: baseUrl });
    const client = crearCliente(link);

    await expect(client.unreadCountProcedure()).rejects.toMatchObject({ status: 401 });
  });
});
