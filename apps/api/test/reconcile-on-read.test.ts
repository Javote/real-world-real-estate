import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { anchorPort } from "../src/lib/anchor";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// **La invariante: toda lectura que devuelva el estado de un anclaje
// reconcilia su propio alcance antes de consultar.**
//
// Por qué existe. `reconciliarParaLectura` no tiene cron ni timer (D-077, y la
// decisión de no agregar infra para lo que todavía no duele): el disparo ES la
// lectura. Eso funciona solo si el disparador está donde se muestra el
// anclaje, y hasta el 2026-09-09 no lo estaba: tres rutas devolvían
// `anchorStatus` sin reconciliar nunca, así que un evento que ya estaba en un
// bloque se servía `Pending` **para siempre** — no hasta la próxima carga,
// para siempre, porque nada más lo iba a mirar.
//
// **Cómo se observa, y por qué así.** No hay espías ni inspección del fuente
// (D-053: un escáner que grepea y adivina se borró por eso). Se planta un
// evento `Pending` con un txid que el simulador reconoce como suyo, se pide la
// ruta por HTTP, y se mira la BASE: si la fila quedó `Confirmed`, la ruta
// reconcilió. Es el comportamiento real, no una declaración sobre él.
//
// **La lista se mantiene a mano, igual que el literal de `route-guards`.** El
// test no descubre solo una ruta nueva que devuelva `anchorStatus`; lo que
// hace es que las que ya sabemos que deben reconciliar no puedan dejar de
// hacerlo en silencio. Si agregás una lectura con `anchorStatus`, sumala acá —
// y sumarla es donde mirás si el alcance que elegiste es el correcto.

let proyecto: string;
let contratoId: string;
let tokenDev: string;
let tokenCert: string;
let tokenInvestor: string;
let usuarioDev: string;
let unidadInvestor: string;

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

/** Un txid que el simulador reconoce como suyo — uno inventado da `null`. */
async function txidReal(reference: string): Promise<string> {
  const recibo = await anchorPort().anchorCommitment({ sha256: "a".repeat(64), reference });
  return recibo.txid;
}

/** Un anclaje `Pending` de verdad confirmable, en el alcance del proyecto. */
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
      // El CHECK de la tabla no deja un TXID sin red (D-080).
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

/**
 * Un bundle de un solo archivo, con su `EvidenceBundleItem`, listo para pedirle
 * `GET /evidence/:bundleId/proof/:fileHash`. No pasa por el flujo real de
 * completar un stage (ese ya lo cubre `evidence-anchor.test.ts`): acá solo
 * hace falta la forma mínima que esa ruta necesita para reconciliar.
 */
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

  // Ya reconciliaban en el código (`evidence.routes.ts`/`investor.routes.ts`
  // lo llaman antes de consultar) pero no estaban en esta lista — la misma
  // clase de agujero que el 2026-09-09, solo que en el test y no en la ruta:
  // nada impedía que alguien las rompiera sin que ningún rojo lo avisara.
  it("GET /evidence/:bundleId/proof/:fileHash", async () => {
    const { bundleId, fileHash } = await bundleConArchivo();

    const res = await request(app)
      .get(`/api/v1/evidence/${bundleId}/proof/${fileHash}`)
      .set("Authorization", `Bearer ${tokenDev}`);
    expect(res.status).toBe(200);
    // Regla 17: el proof object solo sostiene el TXID si `anchorStatus` ya
    // reconcilió a `Confirmed` — si esta ruta dejara de reconciliar, el body
    // seguiría en 200 pero con `txid: null`, así que el chequeo real está acá.
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
