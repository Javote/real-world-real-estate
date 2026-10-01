import { createHash } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { compileDossier } from "../src/domain/dossier";
import { anchorPort } from "../src/lib/anchor";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

const ganchos = vi.hoisted(() => ({ demoraCompilacionMs: 0 }));

vi.mock("../src/domain/dossier", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/domain/dossier")>();
  return {
    ...real,
    compileDossier: async (unitId: string) => {
      const dossier = await real.compileDossier(unitId);
      await new Promise((r) => setTimeout(r, ganchos.demoraCompilacionMs));
      return dossier;
    }
  };
});

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

let proyecto: string;
let usuario: string;
let tokenNotario: string;
let tokenAdmin: string;
let tokenDev: string;

async function crearDossier() {
  const ahora = new Date();
  const investorId = createId();
  await db
    .insertInto("User")
    .values({
      id: investorId,
      email: `reclamo-${investorId}@test.local`,
      passwordHash: await bcrypt.hash("reclamo-pass", 4),
      fullName: "Investor reclamo",
      role: "buyer",
      isActive: true,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();

  const unitId = createId();
  await db
    .insertInto("Unit")
    .values({
      id: unitId,
      projectId: proyecto,
      unitReference: `RECLAMO-${unitId}`,
      status: "sold",
      priceMinorUnits: 5_000_000,
      currency: "USD",
      investorId,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();

  const dossier = await compileDossier(unitId);
  return dossier!.id;
}

async function crearEvidencia() {
  const ahora = new Date();
  const id = createId();
  await db
    .insertInto("Evidence")
    .values({
      id,
      projectId: proyecto,
      stageId: null,
      uploadedById: usuario,
      evidenceType: "certificate",
      category: "permits",
      authoritative: false,
      issuingAuthority: null,
      originalFilename: `${id}.pdf`,
      storedFilename: `${id}.pdf`,
      storagePath: `/tmp/no-existe/${id}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1,
      sha256Hash: createHash("sha256").update(id).digest("hex"),
      uploadedAt: ahora,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

async function eventosDe(referenceId: string) {
  return db
    .selectFrom("OnChainEvent")
    .select(["id", "status", "txid"])
    .where("referenceId", "=", referenceId)
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
  usuario = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow()
  ).id;
  tokenNotario = (await login(FIXTURES.notario)).body.token;
  tokenAdmin = (await login(FIXTURES.admin)).body.token;
  tokenDev = (await login(FIXTURES.activo)).body.token;
});

afterAll(async () => {
  await db.destroy();
});

describe("POST /notary/dossiers/:id/sign — dos firmas simultáneas", () => {
  it("una ancla (201) y la otra recibe esa firma (200): un solo evento, un solo audit", async () => {
    const dossierId = await crearDossier();

    ganchos.demoraCompilacionMs = 300;
    const respuestas = await Promise.all(
      [0, 1].map(() =>
        request(app)
          .post(`/api/v1/notary/dossiers/${dossierId}/sign`)
          .set("Authorization", `Bearer ${tokenNotario}`)
      )
    ).finally(() => {
      ganchos.demoraCompilacionMs = 0;
    });

    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(respuestas[0]!.body.masterHash).toBe(respuestas[1]!.body.masterHash);

    expect(await eventosDe(dossierId)).toHaveLength(1);

    const audits = await db
      .selectFrom("AuditLog")
      .select("id")
      .where("entityId", "=", dossierId)
      .where("action", "=", "SIGN_DOSSIER")
      .execute();
    expect(audits).toHaveLength(1);
  });
});

describe("el ciclo del dossier rechazado", () => {
  it("un rechazado sin cambios no se firma ni se vuelve a rechazar", async () => {
    const dossierId = await crearDossier();

    const rechazo = await request(app)
      .post(`/api/v1/notary/dossiers/${dossierId}/reject`)
      .set("Authorization", `Bearer ${tokenNotario}`)
      .send({ note: "falta el permiso municipal" });
    expect(rechazo.status).toBe(200);

    const firma = await request(app)
      .post(`/api/v1/notary/dossiers/${dossierId}/sign`)
      .set("Authorization", `Bearer ${tokenNotario}`);
    expect(firma.status).toBe(409);
    expect(firma.body.code).toBe("DOSSIER_NOT_SIGNABLE");

    const otroRechazo = await request(app)
      .post(`/api/v1/notary/dossiers/${dossierId}/reject`)
      .set("Authorization", `Bearer ${tokenNotario}`)
      .send({ note: "otra vez" });
    expect(otroRechazo.status).toBe(409);
    expect(otroRechazo.body.code).toBe("DOSSIER_NOT_REJECTABLE");

    expect(await eventosDe(dossierId)).toHaveLength(0);
  });

  it("cuando cambia su masterHash vuelve a compiled, conserva la nota y se puede firmar", async () => {
    const dossierId = await crearDossier();

    await request(app)
      .post(`/api/v1/notary/dossiers/${dossierId}/reject`)
      .set("Authorization", `Bearer ${tokenNotario}`)
      .send({ note: "falta el permiso municipal" });

    await crearEvidencia();

    const releido = await request(app)
      .get(`/api/v1/notary/dossiers/${dossierId}`)
      .set("Authorization", `Bearer ${tokenNotario}`);
    expect(releido.body.status).toBe("compiled");
    expect(releido.body.rejectionNote).toBe("falta el permiso municipal");

    const firma = await request(app)
      .post(`/api/v1/notary/dossiers/${dossierId}/sign`)
      .set("Authorization", `Bearer ${tokenNotario}`);
    expect(firma.status).toBe(201);
    expect(firma.body.masterHash).toBe(releido.body.masterHash);
  });
});

describe.each([
  {
    ruta: "POST /evidence/:id/anchor",
    enviar: (id: string) =>
      request(app)
        .post(`/api/v1/evidence/${id}/anchor`)
        .set("Authorization", `Bearer ${tokenAdmin}`)
  },
  {
    ruta: "POST /developer/documents",
    enviar: (id: string) =>
      request(app)
        .post("/api/v1/developer/documents")
        .set("Authorization", `Bearer ${tokenDev}`)
        .send({ evidenceId: id })
  }
])("$ruta — reclamar antes de anclar", ({ enviar }) => {
  it("dos pedidos simultáneos: uno ancla (201), el otro recibe ese evento (200)", async () => {
    const evidencia = await crearEvidencia();

    const real = anchorPort().anchorCommitment.bind(anchorPort());
    const espia = vi.spyOn(anchorPort(), "anchorCommitment").mockImplementation(async (input) => {
      await new Promise((r) => setTimeout(r, 300));
      return real(input);
    });

    let envios = 0;
    const respuestas = await Promise.all([enviar(evidencia), enviar(evidencia)]).finally(() => {
      envios = espia.mock.calls.length;
      espia.mockRestore();
    });

    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(respuestas[0]!.body.id).toBe(respuestas[1]!.body.id);
    expect(envios).toBe(1);
    expect(await eventosDe(evidencia)).toHaveLength(1);
  });

  it("un anclaje en vuelo reciente bloquea; uno vencido no", async () => {
    const enVuelo = await crearEvidencia();
    const vencido = await crearEvidencia();

    for (const [evidenceId, edadMs] of [
      [enVuelo, 0],
      [vencido, 11 * 60_000]
    ] as const) {
      const creado = new Date(Date.now() - edadMs);
      await db
        .insertInto("OnChainEvent")
        .values({
          id: createId(),
          projectId: proyecto,
          stageId: null,
          evidenceId,
          referenceId: evidenceId,
          eventIndex: 0,
          eventType: "EVIDENCE_ANCHOR",
          fromState: null,
          toState: null,
          commitment: "c".repeat(64),
          status: "Pending",
          txid: null,
          network: null,
          outputRef: null,
          blockTimestamp: null,
          createdAt: creado,
          updatedAt: creado
        })
        .execute();
    }

    const bloqueado = await enviar(enVuelo);
    expect(bloqueado.status).toBe(200);
    expect(bloqueado.body.txid).toBeNull();

    const reintento = await enviar(vencido);
    expect(reintento.status).toBe(201);
    expect(reintento.body.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await eventosDe(vencido)).toHaveLength(2);
  });

  it("un anclaje Failed no bloquea el reintento", async () => {
    const evidencia = await crearEvidencia();

    const espia = vi
      .spyOn(anchorPort(), "anchorCommitment")
      .mockRejectedValueOnce(new Error("el proveedor no contesta"));
    const fallido = await enviar(evidencia);
    espia.mockRestore();
    expect(fallido.body.status).toBe("Failed");

    const reintento = await enviar(evidencia);
    expect(reintento.status).toBe(201);
    expect(reintento.body.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});
