import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// M2-D5 filas 03-05 (browse), 06-07 (documentos), 09-12 (stage), 38/44c
// (subida anclada) y 46-47 (anclaje de documento suelto).

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

let tokenDev: string;
let tokenAdmin: string;
let projectId: string;
let stageId: string;
const temporales: string[] = [];

function pdfDePrueba(nombre: string): string {
  const destino = path.join(process.cwd(), nombre);
  fs.writeFileSync(destino, "%PDF-1.4\n% archivo de prueba\n%%EOF\n");
  temporales.push(destino);
  return destino;
}

beforeAll(async () => {
  tokenDev = (await login(FIXTURES.activo)).body.token;
  tokenAdmin = (await login(FIXTURES.admin)).body.token;

  const proyecto = await db
    .selectFrom("Project")
    .select("id")
    .where("slug", "=", FIXTURES.proyecto.slug)
    .executeTakeFirstOrThrow();
  projectId = proyecto.id;

  const stage = await request(app)
    .post(`/api/v1/projects/${projectId}/stages`)
    .set("Authorization", `Bearer ${tokenDev}`)
    .send({ name: "Excavación", sequenceOrder: 90 });
  stageId = stage.body.id;
});

afterAll(async () => {
  for (const archivo of temporales) {
    if (fs.existsSync(archivo)) fs.unlinkSync(archivo);
  }
  await db.destroy();
});

describe("GET /projects — filtros del backlog", () => {
  it("busca por nombre con `q`", async () => {
    const res = await request(app)
      .get("/api/v1/projects?q=Torre%20Test")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.some((p: { name: string }) => p.name === "Torre Test")).toBe(true);
  });

  it("un `%` tipeado en el buscador no matchea todo", async () => {
    const res = await request(app)
      .get("/api/v1/projects?q=%25")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    // Ningún proyecto tiene un `%` en el nombre: si el escape no funcionara,
    // el comodín devolvería todos.
    expect(res.body).toEqual([]);
  });

  it("ordena por nombre con `sort`", async () => {
    const res = await request(app)
      .get("/api/v1/projects?sort=name")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    const nombres = res.body.map((p: { name: string }) => p.name);
    expect(nombres).toEqual([...nombres].sort());
  });

  it("un `bbox` mal formado es 400, no un filtro ignorado en silencio", async () => {
    const res = await request(app)
      .get("/api/v1/projects?bbox=1,2,3")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(400);
  });

  it("un `bbox` válido filtra por coordenadas, y lo que no tiene coordenadas queda afuera", async () => {
    const res = await request(app)
      .get("/api/v1/projects?bbox=-100,-50,100,50")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    // Los proyectos del fixture no tienen lat/lon: no se les inventa un punto.
    expect(res.body).toEqual([]);
  });
});

describe("POST /developer/projects/:id/stages/:stageId/evidence", () => {
  it("sube, arma el bundle y devuelve Merkle root y TXID en la misma respuesta", async () => {
    const res = await request(app)
      .post(`/api/v1/developer/projects/${projectId}/stages/${stageId}/evidence`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .field("evidenceType", "document")
      .field("category", "permiso")
      .attach("file", pdfDePrueba("upload-uno.pdf"));

    expect(res.status).toBe(201);
    expect(res.body.merkleRoot).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.anchor.eventType).toBe("EVIDENCE_ANCHOR");
    expect(res.body.anchor.commitment).toBe(res.body.merkleRoot);
    // `storagePath` NUNCA sale al cliente (D-011).
    expect(res.body.evidence.storagePath).toBeUndefined();
    expect(res.body.evidence.sha256Hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("un stage de otro proyecto es 404, no una subida a ciegas", async () => {
    const otro = await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.otroProyecto.slug)
      .executeTakeFirstOrThrow();

    const res = await request(app)
      .post(`/api/v1/developer/projects/${otro.id}/stages/${stageId}/evidence`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .field("evidenceType", "document")
      .field("category", "permiso")
      .attach("file", pdfDePrueba("upload-dos.pdf"));

    expect(res.status).toBe(404);
  });
});

describe("GET /projects/:id/documents y /projects/:id/stages/:stageId", () => {
  it("los documentos traen el hash completo y su estado derivado del TXID", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/documents`)
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    for (const doc of res.body) {
      // El hash viaja COMPLETO: la truncación 6+4 la hace `HashChip` (regla 16).
      expect(doc.sha256Hash).toMatch(/^[0-9a-f]{64}$/);
      expect(doc.storagePath).toBeUndefined();
      // Sin TXID el estado es "Pendiente", nunca "Verificado" (regla 17).
      if (!doc.txid) expect(doc.anchorStatus).toBe("Pending");
    }
  });

  it("el stage anidado trae su bundle y sus eventos", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/stages/${stageId}`)
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(stageId);
    expect(res.body.bundle.commitmentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(res.body.evidences[0].storagePath).toBeUndefined();
  });

  it("un stage de otro proyecto bajo este path es 404", async () => {
    const otro = await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.otroProyecto.slug)
      .executeTakeFirstOrThrow();

    const res = await request(app)
      .get(`/api/v1/projects/${otro.id}/stages/${stageId}`)
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(404);
  });
});

describe("POST /developer/documents", () => {
  it("ancla un documento suelto, y hacerlo dos veces no gasta otra transacción", async () => {
    const subida = await request(app)
      .post(`/api/v1/projects/${projectId}/evidence`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .field("evidenceType", "document")
      .field("category", "plano")
      .attach("file", pdfDePrueba("suelto.pdf"));

    expect(subida.status).toBe(201);

    const primera = await request(app)
      .post("/api/v1/developer/documents")
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ evidenceId: subida.body.id });

    expect(primera.status).toBe(201);
    expect(primera.body.eventType).toBe("DOCUMENT_ANCHOR");
    expect(primera.body.commitment).toBe(subida.body.sha256Hash);

    const segunda = await request(app)
      .post("/api/v1/developer/documents")
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ evidenceId: subida.body.id });

    expect(segunda.status).toBe(200);
    expect(segunda.body.id).toBe(primera.body.id);
  });

  it("un developer sin membresía no ancla el documento de otro", async () => {
    const documento = await db
      .selectFrom("Evidence")
      .select("id")
      .where("projectId", "=", projectId)
      .executeTakeFirstOrThrow();

    const tokenAjeno = (await login(FIXTURES.ajeno)).body.token;
    const res = await request(app)
      .post("/api/v1/developer/documents")
      .set("Authorization", `Bearer ${tokenAjeno}`)
      .send({ evidenceId: documento.id });

    expect(res.status).toBe(403);
  });
});
