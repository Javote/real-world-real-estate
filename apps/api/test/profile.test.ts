import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { db } from "../src/lib/db.js";
import { FIXTURES } from "./global-setup.js";

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
