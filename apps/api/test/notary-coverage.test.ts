import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { compileDossier } from "../src/domain/dossier";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// SPEC-018 §A5 — `notary.routes.ts`: `unitsUnderReview`/`pendingDossiers` de
// `/kpis` con un dossier `compiled` de verdad (no solo `signed`), y re-firmar
// un dossier ya firmado que se quedó sin su `OnChainEvent` — la carrera que
// describe el comentario de la línea de arriba en el handler.

const ganchos = vi.hoisted(() => ({ anchorFalla: false }));

vi.mock("../src/domain/anchoring", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/domain/anchoring")>();
  return {
    ...real,
    anchorCommitmentEvent: async (input: Parameters<typeof real.anchorCommitmentEvent>[0]) => {
      if (ganchos.anchorFalla) throw new Error("Blockfrost caído, a propósito");
      return real.anchorCommitmentEvent(input);
    }
  };
});

let proyecto: string;
let tokenAdmin: string;
let tokenNotario: string;

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

async function crearInvestor(email: string) {
  const ahora = new Date();
  const id = createId();
  await db
    .insertInto("User")
    .values({
      id,
      email,
      passwordHash: await bcrypt.hash("notary-coverage-pass", 10),
      fullName: "Investor SPEC-018 A5",
      role: "buyer",
      isActive: true,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

async function crearUnidadVendida(reference: string, investorId: string) {
  const ahora = new Date();
  const id = createId();
  await db
    .insertInto("Unit")
    .values({
      id,
      projectId: proyecto,
      unitReference: reference,
      status: "sold",
      priceMinorUnits: 5_000_000,
      currency: "USD",
      investorId,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
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
  tokenNotario = (await login(FIXTURES.notario)).body.token;
});

afterAll(async () => {
  await db.destroy();
});

describe("GET /notary/kpis con un dossier compiled (sin firmar)", () => {
  it("cuenta en pendingDossiers y en unitsUnderReview", async () => {
    const investorId = await crearInvestor(`notary-coverage-pend-${createId()}@test.local`);
    const unitId = await crearUnidadVendida(`SPEC018-A5-KPI-${createId()}`, investorId);

    // Directo por dominio, no por HTTP: compilar es lo único que hace falta
    // para que el dossier exista en estado `compiled`.
    await compileDossier(unitId);

    const res = await request(app)
      .get("/api/v1/notary/kpis")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.pendingDossiers).toBeGreaterThanOrEqual(1);
    expect(res.body.unitsUnderReview).toBeGreaterThanOrEqual(1);
  });
});

describe("POST /notary/dossiers/:id/sign — re-firmar sin evento de firma", () => {
  it("devuelve 200 con anchor undefined, no revienta ni duplica la firma", async () => {
    const investorId = await crearInvestor(`notary-coverage-race-${createId()}@test.local`);
    const unitId = await crearUnidadVendida(`SPEC018-A5-RACE-${createId()}`, investorId);
    await compileDossier(unitId);

    const dossier = await db
      .selectFrom("Dossier")
      .select("id")
      .where("unitId", "=", unitId)
      .executeTakeFirstOrThrow();

    ganchos.anchorFalla = true;
    try {
      const primeraFirma = await request(app)
        .post(`/api/v1/notary/dossiers/${dossier.id}/sign`)
        .set("Authorization", `Bearer ${tokenNotario}`);
      // El anclaje falló DESPUÉS de que el UPDATE a "signed" ya había corrido:
      // la respuesta al cliente es el 500 genérico de oRPC.
      expect(primeraFirma.status).toBe(500);
    } finally {
      ganchos.anchorFalla = false;
    }

    const fila = await db
      .selectFrom("Dossier")
      .select("status")
      .where("id", "=", dossier.id)
      .executeTakeFirstOrThrow();
    expect(fila.status).toBe("signed");

    const segundaFirma = await request(app)
      .post(`/api/v1/notary/dossiers/${dossier.id}/sign`)
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(segundaFirma.status).toBe(200);
    expect(segundaFirma.body.anchor).toBeUndefined();
  });
});
