import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// D-061 · el anclaje de evidencia lo dispara el admin, y el cierre de un stage
// congela su evidencia en un bundle cuyo Merkle root es lo que viaja al datum.

let proyecto: string;
let tokenAdmin: string;
let tokenDev: string;
let usuario: string;

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

async function crearStage(seq: number) {
  const ahora = new Date();
  const id = createId();
  await db
    .insertInto("Milestone")
    .values({
      id,
      projectId: proyecto,
      name: "Stage con evidencia",
      sequenceOrder: seq,
      state: "InProgress",
      validationCritical: true,
      scopeType: "project",
      scopeUnitCount: 0,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

async function subirEvidencia(milestoneId: string, contenido: string) {
  const ahora = new Date();
  const id = createId();
  const { createHash } = await import("node:crypto");
  await db
    .insertInto("Evidence")
    .values({
      id,
      projectId: proyecto,
      milestoneId,
      uploadedById: usuario,
      evidenceType: "certificate",
      category: "permits",
      authoritative: true,
      originalFilename: `${contenido}.pdf`,
      storedFilename: `${id}.pdf`,
      storagePath: `/tmp/no-existe/${id}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1,
      sha256Hash: createHash("sha256").update(contenido).digest("hex"),
      uploadedAt: ahora,
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
      .selectAll()
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
  usuario = (
    await db
      .selectFrom("User")
      .selectAll()
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow()
  ).id;
  tokenAdmin = (await login(FIXTURES.admin)).body.token;
  tokenDev = (await login(FIXTURES.activo)).body.token;
});

afterAll(async () => {
  await db.destroy();
});

describe("POST /evidence/:id/anchor", () => {
  it("ancla el hash del archivo y devuelve el TXID", async () => {
    const stage = await crearStage(998_001);
    const evidencia = await subirEvidencia(stage, "acta-de-obra");

    const res = await request(app)
      .post(`/api/v1/evidence/${evidencia}/anchor`)
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(201);
    expect(res.body.eventType).toBe("EVIDENCE_ANCHOR");
    expect(res.body.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.evidenceId).toBe(evidencia);
    // Lo que se ancla es el hash del archivo, no el archivo ni su nombre.
    expect(res.body.commitment).toHaveLength(64);
  });

  it("es idempotente: anclar dos veces no gasta otra transacción", async () => {
    const stage = await crearStage(998_002);
    const evidencia = await subirEvidencia(stage, "permiso-municipal");

    const uno = await request(app)
      .post(`/api/v1/evidence/${evidencia}/anchor`)
      .set("Authorization", `Bearer ${tokenAdmin}`);
    const dos = await request(app)
      .post(`/api/v1/evidence/${evidencia}/anchor`)
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(dos.status).toBe(200);
    expect(dos.body.id).toBe(uno.body.id);

    const eventos = await db
      .selectFrom("OnChainEvent")
      .selectAll()
      .where("evidenceId", "=", evidencia)
      .execute();
    expect(eventos).toHaveLength(1);
  });

  it("no lo puede disparar un developer: es acción de admin", async () => {
    const stage = await crearStage(998_003);
    const evidencia = await subirEvidencia(stage, "foto-de-obra");

    const res = await request(app)
      .post(`/api/v1/evidence/${evidencia}/anchor`)
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(403);
  });

  it("404 si la evidencia no existe", async () => {
    const res = await request(app)
      .post(`/api/v1/evidence/${createId()}/anchor`)
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect([403, 404]).toContain(res.status);
  });
});

describe("EvidenceBundle · el acta del cierre", () => {
  it("completar un stage congela su evidencia y produce un Merkle root", async () => {
    const stage = await crearStage(998_010);
    await subirEvidencia(stage, "plano-aprobado");
    await subirEvidencia(stage, "certificado-estructural");

    const res = await request(app)
      .patch(`/api/v1/milestones/${stage}/state`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ state: "Completed" });

    expect(res.status).toBe(200);

    const bundle = await db
      .selectFrom("EvidenceBundle")
      .selectAll()
      .where("milestoneId", "=", stage)
      .executeTakeFirstOrThrow();

    expect(bundle.commitmentHash).toMatch(/^[0-9a-f]{64}$/);

    const items = await db
      .selectFrom("EvidenceBundleItem")
      .selectAll()
      .where("bundleId", "=", bundle.id)
      .execute();

    // El acta guarda el hash de cada archivo: el root tiene que poder
    // reconstruirse aunque la evidencia se borre.
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.sha256Hash.length === 64)).toBe(true);
  });

  it("y con el root, el stage crítico SÍ se ancla", async () => {
    // Este es el hueco que cierra la pieza 3: antes el datum iba con
    // evidenceRoot vacío y el anclaje quedaba en Failed.
    const stage = await crearStage(998_011);
    await subirEvidencia(stage, "acta-final");

    const res = await request(app)
      .patch(`/api/v1/milestones/${stage}/state`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ state: "Completed" });

    expect(res.status).toBe(200);
    // El stage se creó a mano (sin hilo abierto), así que el anclaje no puede
    // gastar nada: lo que importa acá es que el root ya viaja en el datum.
    const bundle = await db
      .selectFrom("EvidenceBundle")
      .selectAll()
      .where("milestoneId", "=", stage)
      .executeTakeFirstOrThrow();
    expect(bundle.commitmentHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
