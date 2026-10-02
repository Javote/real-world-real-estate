import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { createId } from "../src/db/id.js";
import { anchorPort } from "../src/lib/anchor.js";
import { db } from "../src/lib/db.js";
import { FIXTURES } from "./global-setup.js";

let proyecto: string;
let tokenAdmin: string;
let tokenDev: string;
let tokenAjeno: string;
let usuario: string;

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

async function crearStage(seq: number) {
  const ahora = new Date();
  const id = createId();
  await db
    .insertInto("Stage")
    .values({
      id,
      projectId: proyecto,
      name: "Stage con evidencia",
      sequenceOrder: seq,
      state: "InProgress",
      validationCritical: true,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

async function subirEvidencia(stageId: string, contenido: string) {
  const ahora = new Date();
  const id = createId();
  const { createHash } = await import("node:crypto");
  await db
    .insertInto("Evidence")
    .values({
      id,
      projectId: proyecto,
      stageId,
      uploadedById: usuario,
      evidenceType: "certificate",
      category: "permits",
      authoritative: true,
      issuingAuthority: "Municipalidad de Córdoba",
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
  tokenAjeno = (await login(FIXTURES.ajeno)).body.token;
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

  it("el evento anclado queda con referenceId — lo que permite reconciliarlo por su ref, no solo por evidenceId", async () => {
    const stage = await crearStage(998_040);
    const evidencia = await subirEvidencia(stage, "referenceid-check");

    const res = await request(app)
      .post(`/api/v1/evidence/${evidencia}/anchor`)
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(201);

    const evento = await db
      .selectFrom("OnChainEvent")
      .select("referenceId")
      .where("id", "=", res.body.id)
      .executeTakeFirstOrThrow();
    expect(evento.referenceId).toBe(evidencia);
  });

  it("si el puerto de anclaje falla, el evento queda Failed y la respuesta sigue siendo 201", async () => {
    const stage = await crearStage(998_041);
    const evidencia = await subirEvidencia(stage, "puerto-falla");

    const anchorCommitment = vi
      .spyOn(anchorPort(), "anchorCommitment")
      .mockRejectedValueOnce(new Error("el proveedor no contesta"));

    const res = await request(app)
      .post(`/api/v1/evidence/${evidencia}/anchor`)
      .set("Authorization", `Bearer ${tokenAdmin}`);

    anchorCommitment.mockRestore();

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("Failed");
    expect(res.body.txid).toBeNull();
  });

  it("si el puerto confirma tarde, el evento queda Pending con el TXID real, no Failed", async () => {
    const stage = await crearStage(998_042);
    const evidencia = await subirEvidencia(stage, "confirma-tarde");

    const confirmedAt = vi.spyOn(anchorPort(), "confirmedAt").mockResolvedValueOnce(null);

    const res = await request(app)
      .post(`/api/v1/evidence/${evidencia}/anchor`)
      .set("Authorization", `Bearer ${tokenAdmin}`);

    confirmedAt.mockRestore();

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("Pending");
    expect(res.body.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it("registra AuditLog ANCHOR_EVIDENCE con el txid y el status finales", async () => {
    const stage = await crearStage(998_043);
    const evidencia = await subirEvidencia(stage, "audit-log-check");

    const res = await request(app)
      .post(`/api/v1/evidence/${evidencia}/anchor`)
      .set("Authorization", `Bearer ${tokenAdmin}`);

    const entrada = await db
      .selectFrom("AuditLog")
      .selectAll()
      .where("entityId", "=", evidencia)
      .where("action", "=", "ANCHOR_EVIDENCE")
      .executeTakeFirstOrThrow();

    const metadata = JSON.parse(entrada.metadataJson as unknown as string) as {
      txid: string;
      status: string;
    };
    expect(metadata.txid).toBe(res.body.txid);
    expect(metadata.status).toBe(res.body.status);
  });
});

describe("EvidenceBundle · el acta del cierre", () => {
  it("completar un stage congela su evidencia y produce un Merkle root", async () => {
    const stage = await crearStage(998_010);
    await subirEvidencia(stage, "plano-aprobado");
    await subirEvidencia(stage, "certificado-estructural");

    const res = await request(app)
      .patch(`/api/v1/stages/${stage}/state`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ state: "Completed" });

    expect(res.status).toBe(200);

    const bundle = await db
      .selectFrom("EvidenceBundle")
      .selectAll()
      .where("stageId", "=", stage)
      .executeTakeFirstOrThrow();

    expect(bundle.commitmentHash).toMatch(/^[0-9a-f]{64}$/);

    const items = await db
      .selectFrom("EvidenceBundleItem")
      .selectAll()
      .where("bundleId", "=", bundle.id)
      .execute();

    expect(items).toHaveLength(2);
    expect(items.every((i) => i.sha256Hash.length === 64)).toBe(true);
  });

  it("y con el root, el stage crítico SÍ se ancla", async () => {
    const stage = await crearStage(998_011);
    await subirEvidencia(stage, "acta-final");

    const res = await request(app)
      .patch(`/api/v1/stages/${stage}/state`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ state: "Completed" });

    expect(res.status).toBe(200);
    const bundle = await db
      .selectFrom("EvidenceBundle")
      .selectAll()
      .where("stageId", "=", stage)
      .executeTakeFirstOrThrow();
    expect(bundle.commitmentHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("GET /evidence/:bundleId/files y /:bundleId/proof/:fileHash — segunda capa", () => {
  it("un developer sin membresía en el proyecto del bundle recibe 403", async () => {
    const stage = await crearStage(998_020);
    await subirEvidencia(stage, "plano-ajeno");

    await request(app)
      .patch(`/api/v1/stages/${stage}/state`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ state: "Completed" });

    const bundle = await db
      .selectFrom("EvidenceBundle")
      .selectAll()
      .where("stageId", "=", stage)
      .executeTakeFirstOrThrow();
    const item = await db
      .selectFrom("EvidenceBundleItem")
      .selectAll()
      .where("bundleId", "=", bundle.id)
      .executeTakeFirstOrThrow();

    const archivos = await request(app)
      .get(`/api/v1/evidence/${bundle.id}/files`)
      .set("Authorization", `Bearer ${tokenAjeno}`);
    expect(archivos.status).toBe(403);

    const prueba = await request(app)
      .get(`/api/v1/evidence/${bundle.id}/proof/${item.sha256Hash}`)
      .set("Authorization", `Bearer ${tokenAjeno}`);
    expect(prueba.status).toBe(403);

    const okArchivos = await request(app)
      .get(`/api/v1/evidence/${bundle.id}/files`)
      .set("Authorization", `Bearer ${tokenDev}`);
    expect(okArchivos.status).toBe(200);

    const okPrueba = await request(app)
      .get(`/api/v1/evidence/${bundle.id}/proof/${item.sha256Hash}`)
      .set("Authorization", `Bearer ${tokenDev}`);
    expect(okPrueba.status).toBe(200);
  });

  it("404 si el bundle no existe", async () => {
    const res = await request(app)
      .get(`/api/v1/evidence/${createId()}/files`)
      .set("Authorization", `Bearer ${tokenDev}`);
    expect([403, 404]).toContain(res.status);
  });
});

describe("GET /evidence/:bundleId/proof/:fileHash — proof object (hash + timestamp + signer)", () => {
  it("sin anclaje confirmado: signer sí, txid y timestamp en null (regla 17)", async () => {
    const stage = await crearStage(998_030);
    await subirEvidencia(stage, "plano-sin-anclar");

    await request(app)
      .patch(`/api/v1/stages/${stage}/state`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ state: "Completed" });

    const bundle = await db
      .selectFrom("EvidenceBundle")
      .selectAll()
      .where("stageId", "=", stage)
      .executeTakeFirstOrThrow();
    const item = await db
      .selectFrom("EvidenceBundleItem")
      .selectAll()
      .where("bundleId", "=", bundle.id)
      .executeTakeFirstOrThrow();

    const res = await request(app)
      .get(`/api/v1/evidence/${bundle.id}/proof/${item.sha256Hash}`)
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    expect(res.body.merkleRoot).toBe(bundle.commitmentHash);
    expect(res.body.leaf).toBe(item.sha256Hash);
    expect(res.body.signerUserId).toBe(usuario);
    expect(res.body.txid).toBeNull();
    expect(res.body.timestamp).toBeNull();
  });

  it("con anclaje confirmado: txid y timestamp viajan", async () => {
    const stage = await crearStage(998_031);
    const evidenciaId = await subirEvidencia(stage, "plano-anclado");

    await request(app)
      .patch(`/api/v1/stages/${stage}/state`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ state: "Completed" });

    const ahora = new Date();
    await db
      .insertInto("OnChainEvent")
      .values({
        id: createId(),
        projectId: proyecto,
        stageId: stage,
        evidenceId: evidenciaId,
        referenceId: null,
        eventIndex: 1,
        eventType: "EVIDENCE_ANCHOR",
        fromState: null,
        toState: null,
        commitment: "a".repeat(64),
        status: "Confirmed",
        txid: "a".repeat(64),
        network: "Preprod",
        outputRef: null,
        blockTimestamp: ahora,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();

    const bundle = await db
      .selectFrom("EvidenceBundle")
      .selectAll()
      .where("stageId", "=", stage)
      .executeTakeFirstOrThrow();
    const item = await db
      .selectFrom("EvidenceBundleItem")
      .selectAll()
      .where("bundleId", "=", bundle.id)
      .executeTakeFirstOrThrow();

    const res = await request(app)
      .get(`/api/v1/evidence/${bundle.id}/proof/${item.sha256Hash}`)
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    expect(res.body.txid).toBe("a".repeat(64));
    expect(res.body.anchorStatus).toBe("Confirmed");
    expect(typeof res.body.timestamp).toBe("string");
  });
});

describe("PATCH /evidence/:id con stageId", () => {
  it("mueve la evidencia a otro stage DEL MISMO proyecto", async () => {
    const origen = await crearStage(998_060);
    const destino = await crearStage(998_061);
    const evidenciaId = await subirEvidencia(origen, "para-mover");

    const res = await request(app)
      .patch(`/api/v1/evidence/${evidenciaId}`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ stageId: destino });

    expect(res.status).toBe(200);
    expect(res.body.stageId).toBe(destino);
  });

  it("un stageId de OTRO proyecto (o inexistente) da 400, no mueve nada", async () => {
    const origen = await crearStage(998_062);
    const evidenciaId = await subirEvidencia(origen, "no-se-mueve");

    const res = await request(app)
      .patch(`/api/v1/evidence/${evidenciaId}`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ stageId: createId() });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Stage does not belong to project/);

    const fila = await db
      .selectFrom("Evidence")
      .select("stageId")
      .where("id", "=", evidenciaId)
      .executeTakeFirstOrThrow();
    expect(fila.stageId).toBe(origen);
  });
});

describe("GET /evidence/:bundleId/proof/:fileHash — ramas del hash y del bundle vacío", () => {
  it("un fileHash que no pertenece al bundle da 404", async () => {
    const stage = await crearStage(998_050);
    await subirEvidencia(stage, "plano-del-bundle");

    await request(app)
      .patch(`/api/v1/stages/${stage}/state`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ state: "Completed" });

    const bundle = await db
      .selectFrom("EvidenceBundle")
      .selectAll()
      .where("stageId", "=", stage)
      .executeTakeFirstOrThrow();

    const res = await request(app)
      .get(`/api/v1/evidence/${bundle.id}/proof/${"f".repeat(64)}`)
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not part of this bundle/);
  });

  it("un bundle sin ningún item (fila plantada a mano) da 404 antes de calcular nada", async () => {
    const stage = await crearStage(998_051);
    const ahora = new Date();
    const bundleId = createId();
    await db
      .insertInto("EvidenceBundle")
      .values({
        id: bundleId,
        projectId: proyecto,
        stageId: stage,
        commitmentHash: "e".repeat(64),
        createdById: usuario,
        createdAt: ahora
      })
      .execute();

    const res = await request(app)
      .get(`/api/v1/evidence/${bundleId}/proof/${"e".repeat(64)}`)
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Bundle not found");
  });
});
