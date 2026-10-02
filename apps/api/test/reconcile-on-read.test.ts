import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { anchorPort } from "../src/lib/anchor";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

let proyecto: string;
let contratoId: string;
let tokenDev: string;
let tokenCert: string;
let tokenInvestor: string;
let usuarioDev: string;
let unidadInvestor: string;

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

async function txidReal(reference: string): Promise<string> {
  const recibo = await anchorPort().anchorCommitment({ sha256: "a".repeat(64), reference });
  return recibo.txid;
}

async function anclajePendiente(): Promise<string> {
  const id = createId();
  const ahora = new Date();
  await db
    .insertInto("OnChainEvent")
    .values({
      id,
      projectId: proyecto,
      stageId: null,
      evidenceId: null,
      referenceId: createId(),
      eventIndex: 0,
      eventType: "EVIDENCE_ANCHOR",
      fromState: null,
      toState: null,
      commitment: "a".repeat(64),
      status: "Pending",
      txid: await txidReal(id),
      network: "Simulated",
      outputRef: null,
      blockTimestamp: null,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

const estado = async (id: string) =>
  (
    await db
      .selectFrom("OnChainEvent")
      .select(["status", "blockTimestamp"])
      .where("id", "=", id)
      .executeTakeFirstOrThrow()
  ).status;

beforeAll(async () => {
  tokenDev = (await login(FIXTURES.activo)).body.token;
  tokenCert = (await login(FIXTURES.certificador)).body.token;
  tokenInvestor = (await login(FIXTURES.investor)).body.token;

  proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;

  contratoId = (
    await db
      .selectFrom("Contract")
      .innerJoin("Unit", "Unit.id", "Contract.unitId")
      .select("Contract.id as id")
      .where("Unit.projectId", "=", proyecto)
      .executeTakeFirstOrThrow()
  ).id;

  usuarioDev = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow()
  ).id;

  unidadInvestor = (
    await db
      .selectFrom("Unit")
      .innerJoin("User", "User.id", "Unit.investorId")
      .select("Unit.id as id")
      .where("User.email", "=", FIXTURES.investor.email)
      .executeTakeFirstOrThrow()
  ).id;
});

async function bundleConArchivo(): Promise<{ bundleId: string; fileHash: string }> {
  const ahora = new Date();
  const stageId = createId();
  await db
    .insertInto("Stage")
    .values({
      id: stageId,
      projectId: proyecto,
      name: "Stage para reconcile-on-read",
      sequenceOrder: 900_010 + Math.floor(Math.random() * 1000),
      state: "InProgress",
      validationCritical: false,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();

  const evidenceId = createId();
  const fileHash = "d".repeat(64);
  await db
    .insertInto("Evidence")
    .values({
      id: evidenceId,
      projectId: proyecto,
      stageId,
      uploadedById: usuarioDev,
      evidenceType: "photo",
      category: "progress",
      authoritative: false,
      originalFilename: "foto.jpg",
      storedFilename: `${evidenceId}.jpg`,
      storagePath: `/tmp/no-existe/${evidenceId}.jpg`,
      mimeType: "image/jpeg",
      sizeBytes: 1,
      sha256Hash: fileHash,
      uploadedAt: ahora,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();

  const bundleId = createId();
  await db
    .insertInto("EvidenceBundle")
    .values({
      id: bundleId,
      projectId: proyecto,
      stageId,
      commitmentHash: "e".repeat(64),
      createdById: usuarioDev,
      createdAt: ahora
    })
    .execute();

  await db
    .insertInto("EvidenceBundleItem")
    .values({ bundleId, evidenceId, sha256Hash: fileHash })
    .execute();

  await db
    .insertInto("OnChainEvent")
    .values({
      id: createId(),
      projectId: proyecto,
      stageId: null,
      evidenceId,
      referenceId: null,
      eventIndex: 0,
      eventType: "EVIDENCE_ANCHOR",
      fromState: null,
      toState: null,
      commitment: fileHash,
      status: "Pending",
      txid: await txidReal(evidenceId),
      network: "Simulated",
      outputRef: null,
      blockTimestamp: null,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();

  return { bundleId, fileHash };
}

describe("toda lectura con anchorStatus reconcilia su alcance", () => {
  it("GET /projects/:id/documents", async () => {
    const id = await anclajePendiente();
    expect(await estado(id)).toBe("Pending");

    const res = await request(app)
      .get(`/api/v1/projects/${proyecto}/documents`)
      .set("Authorization", `Bearer ${tokenDev}`);
    expect(res.status).toBe(200);

    expect(await estado(id)).toBe("Confirmed");
  });

  it("GET /contracts/:contractId/releases", async () => {
    const id = await anclajePendiente();
    expect(await estado(id)).toBe("Pending");

    const res = await request(app)
      .get(`/api/v1/contracts/${contratoId}/releases`)
      .set("Authorization", `Bearer ${tokenDev}`);
    expect(res.status).toBe(200);

    expect(await estado(id)).toBe("Confirmed");
  });

  it("GET /certifier/certificates", async () => {
    const id = await anclajePendiente();
    expect(await estado(id)).toBe("Pending");

    const res = await request(app)
      .get("/api/v1/certifier/certificates")
      .set("Authorization", `Bearer ${tokenCert}`);
    expect(res.status).toBe(200);

    expect(await estado(id)).toBe("Confirmed");
  });

  it("GET /evidence/:bundleId/proof/:fileHash", async () => {
    const { bundleId, fileHash } = await bundleConArchivo();

    const res = await request(app)
      .get(`/api/v1/evidence/${bundleId}/proof/${fileHash}`)
      .set("Authorization", `Bearer ${tokenDev}`);
    expect(res.status).toBe(200);
    expect(res.body.txid).not.toBeNull();
  });

  it("GET /investor/units/:id/news", async () => {
    const id = await anclajePendiente();
    expect(await estado(id)).toBe("Pending");

    const res = await request(app)
      .get(`/api/v1/investor/units/${unidadInvestor}/news`)
      .set("Authorization", `Bearer ${tokenInvestor}`);
    expect(res.status).toBe(200);

    expect(await estado(id)).toBe("Confirmed");
  });
});

describe("lo que la reconciliación por lectura NO hace", () => {
  it("no toca un anclaje sin txid: es un envío que falló, no hay qué consultar", async () => {
    const id = createId();
    const ahora = new Date();
    await db
      .insertInto("OnChainEvent")
      .values({
        id,
        projectId: proyecto,
        stageId: null,
        evidenceId: null,
        referenceId: createId(),
        eventIndex: 0,
        eventType: "EVIDENCE_ANCHOR",
        fromState: null,
        toState: null,
        commitment: "b".repeat(64),
        status: "Pending",
        txid: null,
        network: null,
        outputRef: null,
        blockTimestamp: null,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();

    await request(app)
      .get(`/api/v1/projects/${proyecto}/documents`)
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(await estado(id)).toBe("Pending");
  });

  it("no confirma un anclaje de OTRO proyecto: el alcance acota de verdad", async () => {
    const otro = (
      await db
        .selectFrom("Project")
        .select("id")
        .where("id", "!=", proyecto)
        .executeTakeFirstOrThrow()
    ).id;

    const id = createId();
    const ahora = new Date();
    await db
      .insertInto("OnChainEvent")
      .values({
        id,
        projectId: otro,
        stageId: null,
        evidenceId: null,
        referenceId: createId(),
        eventIndex: 0,
        eventType: "EVIDENCE_ANCHOR",
        fromState: null,
        toState: null,
        commitment: "c".repeat(64),
        status: "Pending",
        txid: await txidReal(id),
        network: "Simulated",
        outputRef: null,
        blockTimestamp: null,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();

    await request(app)
      .get(`/api/v1/projects/${proyecto}/documents`)
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(await estado(id)).toBe("Pending");
  });
});
