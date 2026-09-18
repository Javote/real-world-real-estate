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

/**
 * SPEC-214: crea un evento `Confirmed` donde `blockTimestamp` y `updatedAt`
 * pueden divergir a propósito — es lo que reproduce el hueco que el cierre
 * del criterio 9 encontró (D-077: alguien volvió a leer minutos después de
 * que la cadena ya había confirmado).
 */
async function crearEventoConfirmado(opts: {
  minutosHastaBloque: number | null;
  minutosHastaLectura: number;
}) {
  const inicio = new Date();
  const bloque =
    opts.minutosHastaBloque === null
      ? null
      : new Date(inicio.getTime() + opts.minutosHastaBloque * 60_000);
  const lectura = new Date(inicio.getTime() + opts.minutosHastaLectura * 60_000);

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
      blockTimestamp: bloque,
      createdAt: inicio,
      updatedAt: lectura
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
    // Los tres tienen blockTimestamp (crearEvento lo iguala a updatedAt).
    expect(res.body.withBlockTimestampCount).toBe(3);
  });

  describe("SPEC-214 — mide contra blockTimestamp, no contra updatedAt", () => {
    it("con blockTimestamp y updatedAt divergentes, mide la latencia de cadena real", async () => {
      await db.deleteFrom("OnChainEvent").where("eventType", "=", "INVITATION_ACCEPTED").execute();
      // La cadena confirmó a los 3 min; nadie volvió a leer el proyecto hasta
      // los 40 — es exactamente el hueco que updatedAt-createdAt inflaba.
      await crearEventoConfirmado({ minutosHastaBloque: 3, minutosHastaLectura: 40 });

      const res = await request(app)
        .get("/api/v1/audit-logs/telemetry/reservation-to-escrow")
        .set("Authorization", `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.sampleSize).toBe(1);
      expect(res.body.medianMinutes).toBeCloseTo(3, 1);
      expect(res.body.withBlockTimestampCount).toBe(1);
    });

    it("una fila Confirmed vieja sin blockTimestamp usa updatedAt como respaldo, y no cuenta en withBlockTimestampCount", async () => {
      await db.deleteFrom("OnChainEvent").where("eventType", "=", "INVITATION_ACCEPTED").execute();
      // blockTimestamp null pero Confirmed: el caso de antes de que la
      // columna se poblara consistentemente.
      await crearEventoConfirmado({ minutosHastaBloque: null, minutosHastaLectura: 7 });

      const res = await request(app)
        .get("/api/v1/audit-logs/telemetry/reservation-to-escrow")
        .set("Authorization", `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.sampleSize).toBe(1);
      expect(res.body.medianMinutes).toBeCloseTo(7, 1);
      expect(res.body.withBlockTimestampCount).toBe(0);
    });

    it("un blockTimestamp anterior a createdAt se descarta, no se publica un negativo", async () => {
      await db.deleteFrom("OnChainEvent").where("eventType", "=", "INVITATION_ACCEPTED").execute();
      await crearEventoConfirmado({ minutosHastaBloque: -5, minutosHastaLectura: 10 });
      await crearEventoConfirmado({ minutosHastaBloque: 6, minutosHastaLectura: 6 });

      const res = await request(app)
        .get("/api/v1/audit-logs/telemetry/reservation-to-escrow")
        .set("Authorization", `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      // La fila con blockTimestamp negativo queda afuera: sampleSize cuenta
      // solo la otra, ninguna mediana negativa.
      expect(res.body.sampleSize).toBe(1);
      expect(res.body.medianMinutes).toBeCloseTo(6, 1);
      expect(res.body.medianMinutes).toBeGreaterThanOrEqual(0);
    });
  });
});
