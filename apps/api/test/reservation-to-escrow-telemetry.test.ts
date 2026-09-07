import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// M3 §3 — mediana reserva → escrow < 12 min (D-021). El evento es
// `OnChainEvent` de tipo INVITATION_ACCEPTED: createdAt = instante de la
// reserva, updatedAt = cuándo `reconciliarAnclajes` lo vio Confirmed.

let tokenAdmin: string;
let tokenDev: string;
let proyecto: string;

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

async function crearEvento(minutosHastaConfirmar: number | null) {
  const inicio = new Date();
  const fin =
    minutosHastaConfirmar === null
      ? null
      : new Date(inicio.getTime() + minutosHastaConfirmar * 60_000);
  await db
    .insertInto("OnChainEvent")
    .values({
      id: createId(),
      projectId: proyecto,
      stageId: null,
      evidenceId: null,
      referenceId: createId(),
      eventIndex: 0,
      eventType: "INVITATION_ACCEPTED",
      fromState: null,
      toState: null,
      commitment: "a".repeat(64),
      status: fin ? "Confirmed" : "Pending",
      txid: fin ? createId().padEnd(64, "0") : null,
      network: fin ? "Preprod" : null,
      outputRef: null,
      blockTimestamp: fin,
      createdAt: inicio,
      updatedAt: fin ?? inicio
    })
    .execute();
}

beforeAll(async () => {
  const proj = await db
    .selectFrom("Project")
    .select("id")
    .where("slug", "=", FIXTURES.proyecto.slug)
    .executeTakeFirstOrThrow();
  proyecto = proj.id;

  tokenAdmin = (await login(FIXTURES.admin)).body.token;
  tokenDev = (await login(FIXTURES.activo)).body.token;
});

afterAll(async () => {
  await db.deleteFrom("OnChainEvent").where("eventType", "=", "INVITATION_ACCEPTED").execute();
});

describe("GET /audit-logs/telemetry/reservation-to-escrow", () => {
  it("solo admin — un developer recibe 403", async () => {
    const res = await request(app)
      .get("/api/v1/audit-logs/telemetry/reservation-to-escrow")
      .set("Authorization", `Bearer ${tokenDev}`);
    expect(res.status).toBe(403);
  });

  it("sin muestras confirmadas: sampleSize 0, mediana null", async () => {
    await crearEvento(null);

    const res = await request(app)
      .get("/api/v1/audit-logs/telemetry/reservation-to-escrow")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.sampleSize).toBe(0);
    expect(res.body.medianMinutes).toBeNull();
  });

  it("calcula la mediana en minutos sobre los eventos confirmados", async () => {
    await db.deleteFrom("OnChainEvent").where("eventType", "=", "INVITATION_ACCEPTED").execute();
    await crearEvento(4);
    await crearEvento(8);
    await crearEvento(20);

    const res = await request(app)
      .get("/api/v1/audit-logs/telemetry/reservation-to-escrow")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.sampleSize).toBe(3);
    expect(res.body.medianMinutes).toBeCloseTo(8, 1);
    expect(res.body.maxMinutes).toBeCloseTo(20, 1);
  });
});
