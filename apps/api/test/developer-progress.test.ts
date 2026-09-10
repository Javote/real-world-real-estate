import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";
import { crearStageMinteado } from "./helpers/stages";

// M3 §2.1 — `developerProgressItemSchema` suma `certifiedAt` (del stage) y
// `estimatedDelivery` (del proyecto), que la captura 45 pide para "Stage
// Detail" y la etiqueta de finalización del timeline.

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

let token: string;
let projectId: string;
let actorId: string;

beforeAll(async () => {
  token = (await login(FIXTURES.activo)).body.token;

  projectId = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
  actorId = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow()
  ).id;

  await db
    .updateTable("Project")
    .set({ estimatedDelivery: new Date("2027-09-01T00:00:00Z") })
    .where("id", "=", projectId)
    .execute();

  const certificada = new Date("2026-03-15T00:00:00Z");
  const stage = await crearStageMinteado({
    projectId,
    name: "Stage con fecha de certificación",
    sequenceOrder: Math.floor(Math.random() * 1_000_000) + 400_000,
    actorUserId: actorId
  });
  await db
    .updateTable("Stage")
    .set({ certifiedAt: certificada, state: "Completed" })
    .where("id", "=", stage.id)
    .execute();

  await crearStageMinteado({
    projectId,
    name: "Stage sin certificar",
    sequenceOrder: Math.floor(Math.random() * 1_000_000) + 500_000,
    actorUserId: actorId
  });
});

afterAll(async () => {
  await db.destroy();
});

describe("GET /developer/progress · certifiedAt y estimatedDelivery", () => {
  it("selecciona certifiedAt del stage y estimatedDelivery del proyecto", async () => {
    const res = await request(app)
      .get("/api/v1/developer/progress")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);

    const fila = res.body.find(
      (f: { stageName: string }) => f.stageName === "Stage con fecha de certificación"
    );
    expect(fila).toBeDefined();
    expect(new Date(fila.certifiedAt).toISOString()).toBe("2026-03-15T00:00:00.000Z");
    expect(new Date(fila.estimatedDelivery).toISOString()).toBe("2027-09-01T00:00:00.000Z");
  });

  it("un stage sin certificar viaja con certifiedAt null", async () => {
    const res = await request(app)
      .get("/api/v1/developer/progress")
      .set("Authorization", `Bearer ${token}`);

    const pendiente = res.body.find(
      (f: { stageName: string }) => f.stageName === "Stage sin certificar"
    );
    expect(pendiente).toBeDefined();
    expect(pendiente.certifiedAt).toBeNull();
  });
});
