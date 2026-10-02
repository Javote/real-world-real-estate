import { DEFAULT_STAGE_CATALOG, INITIAL_STAGE_STATE } from "@plataforma/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

let token: string;

beforeAll(async () => {
  token = (await login(FIXTURES.activo)).body.token;
});

afterAll(async () => {
  await db.destroy();
});

describe("POST /developer/projects · el Stage template se aplica siempre", () => {
  it("crea el proyecto con las 10 etapas del catálogo, cada una anclada", async () => {
    const res = await request(app)
      .post("/api/v1/developer/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({
        latitude: -34.6,
        longitude: -58.4,
        name: "Proyecto con template",
        slug: `con-template-${Date.now()}`
      });

    expect(res.status).toBe(201);
    expect(res.body.stages).toHaveLength(DEFAULT_STAGE_CATALOG.length);

    const nombres = res.body.stages.map((s: { name: string }) => s.name);
    expect(nombres).toEqual(DEFAULT_STAGE_CATALOG.map((e) => e.name));

    for (const stage of res.body.stages) {
      expect(stage.state).toBe(INITIAL_STAGE_STATE);
      expect(stage.anchor.status).toBe("Confirmed");
      expect(stage.anchor.txid).toMatch(/^[0-9a-f]{64}$/);
    }

    const filas = await db
      .selectFrom("Stage")
      .select(["name", "sequenceOrder"])
      .where("projectId", "=", res.body.id)
      .orderBy("sequenceOrder", "asc")
      .execute();
    expect(filas).toHaveLength(10);
    expect(filas.map((f) => f.sequenceOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("cada etapa tiene su propio hilo — 10 mints, no uno compartido", async () => {
    const res = await request(app)
      .post("/api/v1/developer/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({
        latitude: -34.6,
        longitude: -58.4,
        name: "Proyecto para hilos",
        slug: `para-hilos-${Date.now()}`
      });

    const eventos = await db
      .selectFrom("OnChainEvent")
      .select(["stageId", "outputRef"])
      .where(
        "stageId",
        "in",
        res.body.stages.map((s: { id: string }) => s.id)
      )
      .execute();

    expect(eventos).toHaveLength(10);
    expect(new Set(eventos.map((e) => e.outputRef)).size).toBe(10);
  });

  it("el proyecto y sus etapas quedan atómicos: el creador ya es developer del proyecto", async () => {
    const res = await request(app)
      .post("/api/v1/developer/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({
        latitude: -34.6,
        longitude: -58.4,
        name: "Proyecto para membresía",
        slug: `para-membresia-${Date.now()}`
      });

    const detalle = await request(app)
      .get(`/api/v1/developer/projects/${res.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(detalle.status).toBe(200);
  });
});
