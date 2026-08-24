import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// M2-D5 filas 02, 22, 62 — **M3-BE-07**.
//
// Lo que fijan estos tests: que una notificación viaje con su CLAVE y no con
// una frase (regla 15), y que nadie lea las de otro.

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

let tokenInvestor: string;
let tokenDev: string;
let investorId: string;
let notificacionId: string;

beforeAll(async () => {
  tokenInvestor = (await login(FIXTURES.investor)).body.token;
  tokenDev = (await login(FIXTURES.activo)).body.token;

  const investor = await db
    .selectFrom("User")
    .select("id")
    .where("email", "=", FIXTURES.investor.email)
    .executeTakeFirstOrThrow();
  investorId = investor.id;

  notificacionId = createId();
  await db
    .insertInto("Notification")
    .values({
      id: notificacionId,
      userId: investorId,
      category: "stage",
      titleKey: "notifications.stage.completed",
      paramsJson: JSON.stringify({ stageName: "Fundaciones" }),
      unitId: null,
      readAt: null,
      createdAt: new Date()
    })
    .execute();
});

afterAll(async () => {
  await db.deleteFrom("Notification").where("userId", "=", investorId).execute();
  await db.destroy();
});

describe("GET /notifications/unread-count", () => {
  it("cuenta solo las no leídas del usuario autenticado", async () => {
    const res = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${tokenInvestor}`);

    expect(res.status).toBe(200);
    expect(res.body.unread).toBeGreaterThanOrEqual(1);
  });

  it("otro usuario no ve las ajenas", async () => {
    const res = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    expect(res.body.unread).toBe(0);
  });
});

describe("GET /investor/notifications", () => {
  it("devuelve la CLAVE y los params, nunca la frase armada", async () => {
    const res = await request(app)
      .get("/api/v1/investor/notifications")
      .set("Authorization", `Bearer ${tokenInvestor}`);

    expect(res.status).toBe(200);
    const notificacion = res.body.find((n: { id: string }) => n.id === notificacionId);
    expect(notificacion.titleKey).toBe("notifications.stage.completed");
    expect(notificacion.params).toEqual({ stageName: "Fundaciones" });
  });

  it("una categoría que no existe es 400, no un listado vacío", async () => {
    const res = await request(app)
      .get("/api/v1/investor/notifications?category=inventada")
      .set("Authorization", `Bearer ${tokenInvestor}`);

    expect(res.status).toBe(400);
  });

  it("filtra por categoría", async () => {
    const res = await request(app)
      .get("/api/v1/investor/notifications?category=release")
      .set("Authorization", `Bearer ${tokenInvestor}`);

    expect(res.status).toBe(200);
    expect(res.body.every((n: { category: string }) => n.category === "release")).toBe(true);
  });
});

describe("PATCH /notifications/:id/read", () => {
  it("marcar dos veces conserva el primer readAt: la fecha de lectura es un hecho", async () => {
    const primera = await request(app)
      .patch(`/api/v1/notifications/${notificacionId}/read`)
      .set("Authorization", `Bearer ${tokenInvestor}`);
    expect(primera.status).toBe(204);

    const trasPrimera = await db
      .selectFrom("Notification")
      .select("readAt")
      .where("id", "=", notificacionId)
      .executeTakeFirstOrThrow();

    await request(app)
      .patch(`/api/v1/notifications/${notificacionId}/read`)
      .set("Authorization", `Bearer ${tokenInvestor}`);

    const trasSegunda = await db
      .selectFrom("Notification")
      .select("readAt")
      .where("id", "=", notificacionId)
      .executeTakeFirstOrThrow();

    expect(new Date(trasSegunda.readAt!).getTime()).toBe(new Date(trasPrimera.readAt!).getTime());
  });

  it("la notificación de otro es 404, no 403: no se confirma que exista", async () => {
    const res = await request(app)
      .patch(`/api/v1/notifications/${notificacionId}/read`)
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(404);
  });
});
