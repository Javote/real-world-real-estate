import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

let token: string;

beforeAll(async () => {
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: FIXTURES.activo.email, password: FIXTURES.activo.password });
  token = res.body.token;
});

afterAll(async () => {
  await db.destroy();
});

// PATCH /profile/notifications guarda el merge parcial tal cual (Tanda B del
// plan de documentación: "el merge, no lo que 'debería' devolver"), pero
// completar la RESPUESTA con notificationPrefsSchema es un cambio de
// comportamiento real, decidido en el checkpoint del dueño: siempre las 5
// claves, con default true en las que el merge todavía no tiene.
describe("PATCH /api/v1/profile/notifications", () => {
  it("un primer PATCH con una sola clave devuelve las 5, con default true en las demás", async () => {
    const res = await request(app)
      .patch("/api/v1/profile/notifications")
      .set("Authorization", `Bearer ${token}`)
      .send({ stage: false });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      stage: false,
      document: true,
      release: true,
      signature: true,
      certificate: true
    });
  });

  it("un segundo PATCH conserva lo guardado antes y solo pisa la clave nueva", async () => {
    const res = await request(app)
      .patch("/api/v1/profile/notifications")
      .set("Authorization", `Bearer ${token}`)
      .send({ document: false });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      stage: false,
      document: false,
      release: true,
      signature: true,
      certificate: true
    });
  });
});
