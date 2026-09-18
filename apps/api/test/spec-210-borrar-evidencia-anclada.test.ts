import { createHash } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { storage } from "../src/lib/storage";
import { FIXTURES } from "./global-setup";

// SPEC-210 (B-15) — reproduce y cierra: `DELETE /evidence/:id` no puede
// borrar el archivo ni la fila si hay algo que depende de ella. Antes de
// esto, un anclaje sobrevivía en la cadena y en la base mientras el archivo
// que probaba desaparecía (OnChainEvent.evidenceId → ON DELETE set null), y
// una evidencia dentro de un bundle cortaba con un 400 que describe el
// problema al revés (SQLITE_CONSTRAINT_FOREIGNKEY → "A referenced resource
// does not exist", cuando el recurso sí existe y está referenciado).

let proyecto: string;
let tokenAdmin: string;
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
      name: "Stage SPEC-210",
      sequenceOrder: seq,
      state: "InProgress",
      validationCritical: true,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

async function subirEvidencia(stageId: string | null, contenido: string) {
  const ahora = new Date();
  const id = createId();
  await db
    .insertInto("Evidence")
    .values({
      id,
      projectId: proyecto,
      stageId,
      uploadedById: usuario,
      evidenceType: "document",
      category: "plano",
      authoritative: false,
      issuingAuthority: null,
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

async function anclarEvidencia(evidenceId: string, status: "Confirmed" | "Pending" | "Failed") {
  const ahora = new Date();
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
      commitment: "a".repeat(64),
      status,
      txid: status === "Failed" ? null : createId().padEnd(64, "0"),
      network: status === "Failed" ? null : "Preprod",
      outputRef: null,
      blockTimestamp: null,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
}

async function meterEnBundle(evidenceId: string) {
  const ahora = new Date();
  const bundle = await db
    .insertInto("EvidenceBundle")
    .values({
      id: createId(),
      projectId: proyecto,
      stageId: await crearStage(Math.floor(Math.random() * 1_000_000) + 900_000),
      commitmentHash: "c".repeat(64),
      createdById: null,
      createdAt: ahora
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await db
    .insertInto("EvidenceBundleItem")
    .values({ bundleId: bundle.id, evidenceId, sha256Hash: "d".repeat(64) })
    .execute();

  return bundle.id;
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
  tokenAdmin = (await login(FIXTURES.admin)).body.token;
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.destroy();
});

describe("DELETE /evidence/:id", () => {
  it("evidencia sin anclaje ni bundle: 204, se borra de verdad", async () => {
    const stage = await crearStage(996_001);
    const evidencia = await subirEvidencia(stage, "spec210-limpia");

    const res = await request(app)
      .delete(`/api/v1/evidence/${evidencia}`)
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(204);

    const fila = await db
      .selectFrom("Evidence")
      .select("id")
      .where("id", "=", evidencia)
      .executeTakeFirst();
    expect(fila).toBeUndefined();
  });

  it("evidencia inexistente: 404", async () => {
    const res = await request(app)
      .delete(`/api/v1/evidence/${createId()}`)
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(404);
  });

  it.each(["Confirmed", "Pending", "Failed"] as const)(
    "evidencia con OnChainEvent %s: 409 EVIDENCE_ANCHORED, no se borra",
    async (status) => {
      const stage = await crearStage(996_100 + ["Confirmed", "Pending", "Failed"].indexOf(status));
      const evidencia = await subirEvidencia(stage, `spec210-anclada-${status}`);
      await anclarEvidencia(evidencia, status);

      const removeSpy = vi.spyOn(storage, "remove");

      const res = await request(app)
        .delete(`/api/v1/evidence/${evidencia}`)
        .set("Authorization", `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("EVIDENCE_ANCHORED");
      // El archivo ni se toca: la validación corre antes de llamar a storage.
      expect(removeSpy).not.toHaveBeenCalled();

      const fila = await db
        .selectFrom("Evidence")
        .select("id")
        .where("id", "=", evidencia)
        .executeTakeFirst();
      expect(fila).toBeDefined();
    }
  );

  it("evidencia dentro de un bundle, sin evento propio: 409, no el 400 de FK", async () => {
    const stage = await crearStage(996_200);
    const evidencia = await subirEvidencia(stage, "spec210-en-bundle");
    await meterEnBundle(evidencia);

    const res = await request(app)
      .delete(`/api/v1/evidence/${evidencia}`)
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("EVIDENCE_ANCHORED");

    const fila = await db
      .selectFrom("Evidence")
      .select("id")
      .where("id", "=", evidencia)
      .executeTakeFirst();
    expect(fila).toBeDefined();
  });

  it("si storage.remove falla, la fila no se borra", async () => {
    const stage = await crearStage(996_300);
    const evidencia = await subirEvidencia(stage, "spec210-remove-falla");

    const removeSpy = vi
      .spyOn(storage, "remove")
      .mockRejectedValueOnce(new Error("el storage no contesta"));

    const res = await request(app)
      .delete(`/api/v1/evidence/${evidencia}`)
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(500);
    expect(removeSpy).toHaveBeenCalledOnce();

    const fila = await db
      .selectFrom("Evidence")
      .select("id")
      .where("id", "=", evidencia)
      .executeTakeFirst();
    expect(fila).toBeDefined();
  });
});
