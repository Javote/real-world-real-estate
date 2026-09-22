import { createHash } from "node:crypto";
import { merkleRootFromProof } from "@plataforma/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";
import { crearStageMinteado } from "./helpers/stages";

// SPEC-018 §A2 — `evidence.routes.ts` ya tenía el 100% de las branches, pero
// `sha256Pair` (el combinador del camino de Merkle de `GET /evidence/
// :bundleId/proof/:fileHash`) no corría nunca: los tests existentes piden la
// prueba de un bundle de UN archivo, y con una sola hoja el camino es vacío y
// no se combina nada. Acá el bundle tiene dos, y el camino se verifica contra
// la raíz anclada — que es para lo que existe (M2-D4 P5).

const sha256Pair = (a: string, b: string) =>
  createHash("sha256")
    .update(Buffer.from(a + b, "hex"))
    .digest("hex");
const pdf = () => Buffer.from(`%PDF-1.4\nevidencia ${createId()}\n%%EOF\n`);

let miembro: string;
let projectId: string;
let actorId: string;
let contador = Math.floor(Math.random() * 1_000_000) + 4_000_000;

const nuevoStage = async () =>
  (
    await crearStageMinteado({
      projectId,
      name: "Stage de cobertura A2 (evidence)",
      sequenceOrder: ++contador,
      actorUserId: actorId
    })
  ).id;

/** Sube `n` PDFs en un solo lote: un bundle con `n` hojas. */
async function subirLote(n: number) {
  const sId = await nuevoStage();
  const req = request(app)
    .post(`/api/v1/developer/projects/${projectId}/stages/${sId}/evidence`)
    .set("Authorization", `Bearer ${miembro}`)
    .field("evidenceType", "document")
    .field("category", "avance");
  for (let i = 0; i < n; i++)
    req.attach("file", pdf(), { filename: `${i}.pdf`, contentType: "application/pdf" });
  const res = await req;
  expect(res.status).toBe(201);
  return res.body as {
    bundleId: string;
    merkleRoot: string;
    evidences: { id: string; sha256Hash: string }[];
  };
}

const pedirPrueba = (bundleId: string, fileHash: string) =>
  request(app)
    .get(`/api/v1/evidence/${bundleId}/proof/${fileHash}`)
    .set("Authorization", `Bearer ${miembro}`);

beforeAll(async () => {
  miembro = (
    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: FIXTURES.activo.email, password: FIXTURES.activo.password })
  ).body.token;
  projectId = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
  actorId = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow()
  ).id;
});

afterAll(async () => {
  await db.destroy();
});

describe("GET /evidence/:bundleId/proof/:fileHash — bundle de más de un archivo", () => {
  it("devuelve un camino no vacío que, recorrido desde la hoja, da la raíz anclada", async () => {
    const lote = await subirLote(3);

    for (const { sha256Hash } of lote.evidences) {
      const res = await pedirPrueba(lote.bundleId, sha256Hash);

      expect(res.status).toBe(200);
      expect(res.body.leaf).toBe(sha256Hash);
      expect(res.body.merkleRoot).toBe(lote.merkleRoot);
      expect(res.body.proof.length).toBeGreaterThan(0);
      expect(merkleRootFromProof(sha256Hash, res.body.proof, sha256Pair)).toBe(lote.merkleRoot);
    }
  });

  it("un bundle con una hoja corrupta en la base no arma un camino sobre basura: 404", async () => {
    const lote = await subirLote(2);
    const otra = (await subirLote(1)).evidences[0]!;
    // El PK de `EvidenceBundleItem` es (bundleId, evidenceId): la hoja
    // corrupta se cuelga de una evidencia real de otro stage. Mayúsculas: no
    // es un SHA-256 en hex minúscula, que es lo que `merkleProof` exige.
    await db
      .insertInto("EvidenceBundleItem")
      .values({ bundleId: lote.bundleId, evidenceId: otra.id, sha256Hash: "A".repeat(64) })
      .execute();

    const res = await pedirPrueba(lote.bundleId, lote.evidences[0]!.sha256Hash);

    expect(res.status).toBe(404);
  });
});
