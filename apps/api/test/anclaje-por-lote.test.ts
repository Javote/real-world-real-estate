import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { createId } from "../src/db/id.js";
import { db } from "../src/lib/db.js";
import { FIXTURES } from "./global-setup.js";
import { crearStageMinteado } from "./helpers/stages.js";

const pdf = () => Buffer.from(`%PDF-1.4\nevidencia ${createId()}\n%%EOF\n`);

const token = async (f: { email: string; password: string }) =>
  (await request(app).post("/api/v1/auth/login").send(f)).body.token as string;

let dev: string;
let admin: string;
let projectId: string;

type Lote = {
  evidences: { id: string; sha256Hash: string }[];
  bundleId: string;
  anchor: { txid: string };
};

async function stageNuevo(): Promise<string> {
  const actorUserId = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow()
  ).id;
  const stage = await crearStageMinteado({
    projectId,
    name: "Stage de anclaje por lote",
    sequenceOrder: 999_700 + Math.floor(Math.random() * 1000),
    actorUserId
  });
  return stage.id;
}

async function subirLote(stageId: string, cantidad: number): Promise<Lote> {
  const req = request(app)
    .post(`/api/v1/developer/projects/${projectId}/stages/${stageId}/evidence`)
    .set("Authorization", `Bearer ${dev}`)
    .field("evidenceType", "document")
    .field("category", "document");
  for (let i = 0; i < cantidad; i++) {
    req.attach("file", pdf(), { filename: `doc-${i}.pdf`, contentType: "application/pdf" });
  }
  const res = await req;
  expect(res.status).toBe(201);
  return res.body;
}

async function documentos(): Promise<Map<string, { txid: string | null; anchorStatus: string }>> {
  const res = await request(app)
    .get(`/api/v1/projects/${projectId}/documents`)
    .set("Authorization", `Bearer ${dev}`);
  expect(res.status).toBe(200);
  return new Map(
    res.body.map((d: { id: string; txid: string | null; anchorStatus: string }) => [d.id, d])
  );
}

beforeAll(async () => {
  dev = await token(FIXTURES.activo);
  admin = await token(FIXTURES.admin);
  projectId = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
});

afterAll(async () => {
  await db.destroy();
});

describe("un lote se ancla una vez y el anclaje cubre a todos sus archivos", () => {
  it("los documentos muestran el TXID del lote en cada archivo, no solo en el primero", async () => {
    const lote = await subirLote(await stageNuevo(), 3);
    const docs = await documentos();

    for (const e of lote.evidences) {
      expect(docs.get(e.id)?.txid).toBe(lote.anchor.txid);
      expect(docs.get(e.id)?.anchorStatus).not.toBe("Pending");
    }
  });

  it("con dos lotes en un stage, un archivo del primero conserva el TXID que lo registró", async () => {
    const stageId = await stageNuevo();
    const primero = await subirLote(stageId, 2);
    const segundo = await subirLote(stageId, 2);
    const docs = await documentos();

    for (const e of primero.evidences) expect(docs.get(e.id)?.txid).toBe(primero.anchor.txid);
    for (const e of segundo.evidences) expect(docs.get(e.id)?.txid).toBe(segundo.anchor.txid);
  });

  it("la prueba Merkle de un archivo que no es el primero trae el TXID de su bundle", async () => {
    const lote = await subirLote(await stageNuevo(), 2);
    const segundo = lote.evidences[1]!;

    const res = await request(app)
      .get(`/api/v1/evidence/${lote.bundleId}/proof/${segundo.sha256Hash}`)
      .set("Authorization", `Bearer ${dev}`);

    expect(res.status).toBe(200);
    expect(res.body.txid).toBe(lote.anchor.txid);
  });

  it("la prueba contra el bundle acumulado trae el TXID de ese bundle, no el del primero", async () => {
    const stageId = await stageNuevo();
    const primero = await subirLote(stageId, 1);
    const segundo = await subirLote(stageId, 1);
    const delPrimero = primero.evidences[0]!;

    const res = await request(app)
      .get(`/api/v1/evidence/${segundo.bundleId}/proof/${delPrimero.sha256Hash}`)
      .set("Authorization", `Bearer ${dev}`);

    expect(res.status).toBe(200);
    expect(res.body.txid).toBe(segundo.anchor.txid);
  });

  it("anclar a mano un archivo que ya cubre su lote devuelve ese anclaje y no gasta otro (regla 8)", async () => {
    const lote = await subirLote(await stageNuevo(), 2);
    const segundo = lote.evidences[1]!;

    const res = await request(app)
      .post(`/api/v1/evidence/${segundo.id}/anchor`)
      .set("Authorization", `Bearer ${admin}`);

    expect(res.status).toBe(200);
    expect(res.body.txid).toBe(lote.anchor.txid);
    const anclajes = await db
      .selectFrom("OnChainEvent")
      .select("id")
      .where("referenceId", "=", segundo.id)
      .execute();
    expect(anclajes).toHaveLength(0);
  });
});
