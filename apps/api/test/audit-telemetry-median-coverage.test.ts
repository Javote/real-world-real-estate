import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// SPEC-018 §A5 — `mediana()` de `routes/audit.routes.ts` solo se ejercitaba
// con una cantidad IMPAR de muestras (`reservation-to-escrow-telemetry.test.ts`,
// 3 eventos). Falta el lado par: el promedio de las dos del medio.

let tokenAdmin: string;
let proyecto: string;

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

async function crearEventoConfirmado(minutosHastaConfirmar: number) {
  const inicio = new Date();
  const fin = new Date(inicio.getTime() + minutosHastaConfirmar * 60_000);
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
      status: "Confirmed",
      txid: createId().padEnd(64, "0"),
      network: "Preprod",
      outputRef: null,
      blockTimestamp: fin,
      createdAt: inicio,
      updatedAt: fin
    })
    .execute();
}

beforeAll(async () => {
  proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
  tokenAdmin = (await login(FIXTURES.admin)).body.token;
});

afterAll(async () => {
  await db.deleteFrom("OnChainEvent").where("eventType", "=", "INVITATION_ACCEPTED").execute();
  await db.destroy();
});

describe("GET /audit-logs/telemetry/reservation-to-escrow — cantidad par de muestras", () => {
  it("la mediana es el promedio de las dos del medio", async () => {
    await crearEventoConfirmado(4);
    await crearEventoConfirmado(8);

    const res = await request(app)
      .get("/api/v1/audit-logs/telemetry/reservation-to-escrow")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.sampleSize).toBe(2);
    expect(res.body.medianMinutes).toBeCloseTo(6, 1);
  });
});
