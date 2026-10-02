import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { EVIDENCE_MAX_FILE_BYTES } from "@plataforma/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { crearBundle } from "../src/domain/stage-transition";
import { anchorPort } from "../src/lib/anchor";
import { en } from "../src/lib/arrays";
import { db } from "../src/lib/db";
import { storage } from "../src/lib/storage";
import { FIXTURES } from "./global-setup";
import { crearStageMinteado } from "./helpers/stages";

const UPLOAD_DIR = resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./test-uploads");

const pdf = () => Buffer.from(`%PDF-1.4\nevidencia ${createId()}\n%%EOF\n`);
const png = () =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(createId())
  ]);
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(createId())]);
const PDF = pdf();

const token = async (email: string, password: string) => {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password });
  return res.body.token as string;
};
const archivosEnDisco = () => (existsSync(UPLOAD_DIR) ? readdirSync(UPLOAD_DIR).length : 0);

let miembro: string;
let ajeno: string;
let projectId: string;
let stageId: string;

beforeAll(async () => {
  miembro = await token(FIXTURES.activo.email, FIXTURES.activo.password);
  ajeno = await token(FIXTURES.ajeno.email, FIXTURES.ajeno.password);
  const p = await db
    .selectFrom("Project")
    .selectAll()
    .where("slug", "=", FIXTURES.proyecto.slug)
    .executeTakeFirstOrThrow();
  projectId = p.id;

  const actorId = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow()
  ).id;

  const stage = await crearStageMinteado({
    projectId,
    name: "Stage para subida de evidencia",
    sequenceOrder: 999_501,
    actorUserId: actorId
  });
  stageId = stage.id;
});

afterAll(async () => {
  await db.destroy();
});

const subir = (
  tk: string,
  sId: string,
  campos: Record<string, string>,
  archivo?: { buf: Buffer; nombre: string; tipo: string }
) => {
  const req = request(app)
    .post(`/api/v1/developer/projects/${projectId}/stages/${sId}/evidence`)
    .set("Authorization", `Bearer ${tk}`);
  for (const [k, v] of Object.entries(campos)) req.field(k, v);
  if (archivo)
    req.attach("file", archivo.buf, { filename: archivo.nombre, contentType: archivo.tipo });
  return req;
};

type Archivo = { buf: Buffer; nombre: string; tipo: string };

const subirLote = (
  tk: string,
  sId: string,
  campos: Record<string, string>,
  archivos: Archivo[],
  pId: string = projectId
) => {
  const req = request(app)
    .post(`/api/v1/developer/projects/${pId}/stages/${sId}/evidence`)
    .set("Authorization", `Bearer ${tk}`);
  for (const [k, v] of Object.entries(campos)) req.field(k, v);
  for (const a of archivos) req.attach("file", a.buf, { filename: a.nombre, contentType: a.tipo });
  return req;
};

describe("POST /developer/projects/:id/stages/:stageId/evidence — subida de evidencia", () => {
  it("un developer miembro sube un PDF y el servidor calcula el SHA-256", async () => {
    const contenido = pdf();
    const res = await subir(
      miembro,
      stageId,
      { evidenceType: "document", category: "permiso" },
      {
        buf: contenido,
        nombre: "permiso.pdf",
        tipo: "application/pdf"
      }
    );

    expect(res.status).toBe(201);
    expect(res.body.evidences).toHaveLength(1);
    expect(res.body.rejected).toEqual([]);
    expect(res.body.evidences[0].sha256Hash).toBe(
      createHash("sha256").update(contenido).digest("hex")
    );
    expect(res.body.evidences[0].sha256Hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rechaza un tipo de archivo no permitido SIN dejar el archivo huérfano", async () => {
    const antes = archivosEnDisco();
    const res = await subir(
      miembro,
      stageId,
      { evidenceType: "document", category: "x" },
      {
        buf: Buffer.from("MZ ejecutable"),
        nombre: "virus.exe",
        tipo: "application/x-msdownload"
      }
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("NO_FILES_ACCEPTED");
    expect(res.body.rejected).toEqual([{ index: 0, code: "UNSUPPORTED_FILE_TYPE" }]);
    expect(archivosEnDisco()).toBe(antes);
  });

  it("rechaza un archivo más grande que el límite (EVIDENCE_MAX_FILE_MB, de packages/shared) sin dejar huérfanos", async () => {
    const antes = archivosEnDisco();
    const gigante = Buffer.concat([
      Buffer.from("%PDF-1.4\n"),
      Buffer.alloc(EVIDENCE_MAX_FILE_BYTES, 0x41)
    ]);
    const res = await subir(
      miembro,
      stageId,
      { evidenceType: "photo", category: "obra" },
      { buf: gigante, nombre: "grande.pdf", tipo: "application/pdf" }
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("LIMIT_FILE_SIZE");
    expect(archivosEnDisco()).toBe(antes);
  });

  it("un body inválido borra el archivo que Multer ya había escrito", async () => {
    const antes = archivosEnDisco();
    const res = await subir(
      miembro,
      stageId,
      { evidenceType: "document" },
      {
        buf: pdf(),
        nombre: "sin-categoria.pdf",
        tipo: "application/pdf"
      }
    );

    expect(res.status).toBe(400);
    expect(archivosEnDisco()).toBe(antes);
  });

  it("SPEC-212: el 400 tiene el shape unificado de oRPC, no error.flatten()", async () => {
    const res = await subir(
      miembro,
      stageId,
      { evidenceType: "document" },
      { buf: pdf(), nombre: "sin-categoria.pdf", tipo: "application/pdf" }
    );

    expect(res.status).toBe(400);
    expect(res.body).not.toHaveProperty("formErrors");
    expect(res.body).not.toHaveProperty("fieldErrors");
    expect(res.body.code).toBe("BAD_REQUEST");
    expect(Array.isArray(res.body.data?.issues)).toBe(true);
  });

  it("sin archivo devuelve 400", async () => {
    const res = await subir(miembro, stageId, { evidenceType: "document", category: "permiso" });

    expect(res.status).toBe(400);
  });

  it("un developer que NO es miembro del proyecto no puede subir", async () => {
    const antes = archivosEnDisco();
    const res = await subir(
      ajeno,
      stageId,
      { evidenceType: "document", category: "permiso" },
      {
        buf: pdf(),
        nombre: "ajeno.pdf",
        tipo: "application/pdf"
      }
    );

    expect(res.status).toBe(403);
    expect(archivosEnDisco()).toBe(antes);
  });

  it("sin token no se puede subir", async () => {
    const res = await request(app)
      .post(`/api/v1/developer/projects/${projectId}/stages/${stageId}/evidence`)
      .field("evidenceType", "document")
      .field("category", "permiso")
      .attach("file", PDF, { filename: "x.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(401);
  });
});

describe("evidencia — storagePath jamás sale al cliente (D-011)", () => {
  let evidenceId: string;

  beforeAll(async () => {
    const res = await subir(
      miembro,
      stageId,
      { evidenceType: "document", category: "permiso" },
      {
        buf: pdf(),
        nombre: "storage-path.pdf",
        tipo: "application/pdf"
      }
    );
    evidenceId = res.body.evidences[0].id;
  });

  it("POST .../evidence no devuelve storagePath", async () => {
    const res = await subir(
      miembro,
      stageId,
      { evidenceType: "document", category: "permiso" },
      {
        buf: pdf(),
        nombre: "otro.pdf",
        tipo: "application/pdf"
      }
    );

    expect(res.status).toBe(201);
    expect(res.body.evidences[0]).not.toHaveProperty("storagePath");
  });

  it("GET /developer/documents (listado, cross-proyecto) no devuelve storagePath", async () => {
    const res = await request(app)
      .get("/api/v1/developer/documents")
      .set("Authorization", `Bearer ${miembro}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const item of res.body) expect(item).not.toHaveProperty("storagePath");
  });

  it("GET /evidence/:id no devuelve storagePath", async () => {
    const res = await request(app)
      .get(`/api/v1/evidence/${evidenceId}`)
      .set("Authorization", `Bearer ${miembro}`);

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("storagePath");
  });

  it("PATCH /evidence/:id no devuelve storagePath", async () => {
    const res = await request(app)
      .patch(`/api/v1/evidence/${evidenceId}`)
      .set("Authorization", `Bearer ${miembro}`)
      .send({ category: "permiso-actualizado" });

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("storagePath");
  });

  it("GET /evidence/:id/download sigue funcionando (usa storagePath solo server-side)", async () => {
    const res = await request(app)
      .get(`/api/v1/evidence/${evidenceId}/download`)
      .set("Authorization", `Bearer ${miembro}`);

    expect(res.status).toBe(200);
  });
});

describe("POST .../evidence · dispara Pending → InProgress", () => {
  async function crearStage(estado: "Pending" | "InProgress" | "Observed") {
    const ahora = new Date();
    const id = createId();
    await db
      .insertInto("Stage")
      .values({
        id,
        projectId,
        name: "Stage para auto-transición",
        sequenceOrder: Math.floor(Math.random() * 1_000_000) + 500_000,
        state: estado,
        validationCritical: false,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();
    return id;
  }

  it("la primera evidencia mueve el stage de Pending a InProgress", async () => {
    const nuevo = await crearStage("Pending");

    const res = await subir(
      miembro,
      nuevo,
      { evidenceType: "photo", category: "avance" },
      { buf: pdf(), nombre: "foto.pdf", tipo: "application/pdf" }
    );
    expect(res.status).toBe(201);

    const fila = await db
      .selectFrom("Stage")
      .select("state")
      .where("id", "=", nuevo)
      .executeTakeFirstOrThrow();
    expect(fila.state).toBe("InProgress");
  });

  it("subir evidencia a un stage ya InProgress no dispara nada raro (no-op)", async () => {
    const nuevo = await crearStage("InProgress");

    const res = await subir(
      miembro,
      nuevo,
      { evidenceType: "photo", category: "avance" },
      { buf: pdf(), nombre: "foto2.pdf", tipo: "application/pdf" }
    );
    expect(res.status).toBe(201);

    const fila = await db
      .selectFrom("Stage")
      .select("state")
      .where("id", "=", nuevo)
      .executeTakeFirstOrThrow();
    expect(fila.state).toBe("InProgress");
  });

  it("subir evidencia a un stage Observed NO lo reabre solo — esa es una acción aparte", async () => {
    const nuevo = await crearStage("Observed");

    const res = await subir(
      miembro,
      nuevo,
      { evidenceType: "photo", category: "correccion" },
      { buf: pdf(), nombre: "correccion.pdf", tipo: "application/pdf" }
    );
    expect(res.status).toBe(201);

    const fila = await db
      .selectFrom("Stage")
      .select("state")
      .where("id", "=", nuevo)
      .executeTakeFirstOrThrow();
    expect(fila.state).toBe("Observed");
  });
});

describe("POST .../evidence · authoritative='on' (checkbox real) se guarda atribuida", () => {
  it("sin issuingAuthority, completar el stage se rechaza con STAGE_EVIDENCE_UNATTRIBUTED", async () => {
    const ahora = new Date();
    const stageId = createId();
    await db
      .insertInto("Stage")
      .values({
        id: stageId,
        projectId,
        name: "Stage para authoritative=on",
        sequenceOrder: Math.floor(Math.random() * 1_000_000) + 700_000,
        state: "Pending",
        validationCritical: true,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();

    const subida = await subir(
      miembro,
      stageId,
      { evidenceType: "certificate", category: "permits", authoritative: "on" },
      { buf: pdf(), nombre: "acta.pdf", tipo: "application/pdf" }
    );
    expect(subida.status).toBe(201);
    expect(subida.body.evidences[0].authoritative).toBe(true);

    const admin = await token(FIXTURES.admin.email, FIXTURES.admin.password);
    const res = await request(app)
      .patch(`/api/v1/stages/${stageId}/state`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ state: "Completed" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("STAGE_EVIDENCE_UNATTRIBUTED");
  });
});

describe("EvidenceBundle · el acta es idempotente por contenido (regla 8)", () => {
  let admin: string;
  let actorId: string;

  beforeAll(async () => {
    admin = await token(FIXTURES.admin.email, FIXTURES.admin.password);
    actorId = (
      await db
        .selectFrom("User")
        .select("id")
        .where("email", "=", FIXTURES.activo.email)
        .executeTakeFirstOrThrow()
    ).id;
  });

  const actas = (sId: string) =>
    db.selectFrom("EvidenceBundle").select(["commitmentHash"]).where("stageId", "=", sId).execute();

  it("completar el stage no duplica el acta que la última subida ya escribió", async () => {
    const stage = await crearStageMinteado({
      projectId,
      name: "Stage para actas idempotentes",
      sequenceOrder: 999_601,
      actorUserId: actorId
    });

    for (const n of [1, 2, 3]) {
      const res = await subir(
        miembro,
        stage.id,
        { evidenceType: "document", category: "avance" },
        {
          buf: Buffer.concat([PDF, Buffer.from(`#${n}`)]),
          nombre: `a${n}.pdf`,
          tipo: "application/pdf"
        }
      );
      expect(res.status).toBe(201);
    }
    expect(await actas(stage.id)).toHaveLength(3);

    const enCurso = await db
      .selectFrom("Stage")
      .select("state")
      .where("id", "=", stage.id)
      .executeTakeFirstOrThrow();
    expect(enCurso.state).toBe("InProgress");

    const completado = await request(app)
      .patch(`/api/v1/stages/${stage.id}/state`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ state: "Completed" });
    expect(completado.status).toBe(200);

    const finales = await actas(stage.id);
    expect(finales).toHaveLength(3);
    expect(new Set(finales.map((b) => b.commitmentHash)).size).toBe(3);
  });

  it("crearBundle sobre un conjunto que no cambió devuelve el acta vigente sin escribir otra", async () => {
    const stage = await crearStageMinteado({
      projectId,
      name: "Stage para crearBundle repetido",
      sequenceOrder: 999_602,
      actorUserId: actorId
    });

    const res = await subir(
      miembro,
      stage.id,
      { evidenceType: "document", category: "avance" },
      { buf: pdf(), nombre: "unica.pdf", tipo: "application/pdf" }
    );
    expect(res.status).toBe(201);

    const fila = await db
      .selectFrom("Stage")
      .selectAll()
      .where("id", "=", stage.id)
      .executeTakeFirstOrThrow();

    const antes = await actas(stage.id);
    expect(antes).toHaveLength(1);

    const root1 = await crearBundle(fila, actorId);
    const root2 = await crearBundle(fila, actorId);
    expect(root1).toBe(en(antes, 0).commitmentHash);
    expect(root2).toBe(en(antes, 0).commitmentHash);
    expect(await actas(stage.id)).toHaveLength(1);
  });

  it("un stage sin evidencia sigue devolviendo null, no un acta vacía", async () => {
    const stage = await crearStageMinteado({
      projectId,
      name: "Stage sin evidencia",
      sequenceOrder: 999_603,
      actorUserId: actorId
    });
    const fila = await db
      .selectFrom("Stage")
      .selectAll()
      .where("id", "=", stage.id)
      .executeTakeFirstOrThrow();

    expect(await crearBundle(fila, actorId)).toBeNull();
    expect(await actas(stage.id)).toHaveLength(0);
  });
});

describe("POST .../evidence · un stage Completed no acepta más evidencia", () => {
  let admin: string;
  let actorId: string;

  beforeAll(async () => {
    admin = await token(FIXTURES.admin.email, FIXTURES.admin.password);
    actorId = (
      await db
        .selectFrom("User")
        .select("id")
        .where("email", "=", FIXTURES.activo.email)
        .executeTakeFirstOrThrow()
    ).id;
  });

  async function stageCompletado(sequenceOrder: number) {
    const stage = await crearStageMinteado({
      projectId,
      name: `Stage cerrado ${sequenceOrder}`,
      sequenceOrder,
      actorUserId: actorId
    });

    const subida = await subir(
      miembro,
      stage.id,
      { evidenceType: "document", category: "avance" },
      { buf: pdf(), nombre: "previa.pdf", tipo: "application/pdf" }
    );
    expect(subida.status).toBe(201);

    const cierre = await request(app)
      .patch(`/api/v1/stages/${stage.id}/state`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ state: "Completed" });
    expect(cierre.status).toBe(200);

    return stage.id;
  }

  it("rechaza con 409 STAGE_ALREADY_COMPLETED", async () => {
    const sId = await stageCompletado(999_701);

    const res = await subir(
      miembro,
      sId,
      { evidenceType: "document", category: "tardia" },
      { buf: pdf(), nombre: "tardia.pdf", tipo: "application/pdf" }
    );

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("STAGE_ALREADY_COMPLETED");
  });

  it("no deja el archivo huérfano en disco (regla 10)", async () => {
    const sId = await stageCompletado(999_702);
    const antes = archivosEnDisco();

    await subir(
      miembro,
      sId,
      { evidenceType: "document", category: "tardia" },
      { buf: pdf(), nombre: "tardia2.pdf", tipo: "application/pdf" }
    );

    expect(archivosEnDisco()).toBe(antes);
  });

  it("no escribe evidencia, ni acta nueva, ni anclaje", async () => {
    const sId = await stageCompletado(999_703);

    const contar = async () => ({
      evidencias: (
        await db.selectFrom("Evidence").select("id").where("stageId", "=", sId).execute()
      ).length,
      actas: (
        await db.selectFrom("EvidenceBundle").select("id").where("stageId", "=", sId).execute()
      ).length,
      eventos: (
        await db.selectFrom("OnChainEvent").select("id").where("stageId", "=", sId).execute()
      ).length
    });

    const antes = await contar();
    await subir(
      miembro,
      sId,
      { evidenceType: "document", category: "tardia" },
      { buf: pdf(), nombre: "tardia3.pdf", tipo: "application/pdf" }
    );

    expect(await contar()).toEqual(antes);
  });

  it("un stage Observed SÍ acepta evidencia — es el camino de remediación", async () => {
    const stage = await crearStageMinteado({
      projectId,
      name: "Stage observado que recibe correccion",
      sequenceOrder: 999_704,
      actorUserId: actorId
    });
    await subir(
      miembro,
      stage.id,
      { evidenceType: "document", category: "avance" },
      { buf: pdf(), nombre: "inicial.pdf", tipo: "application/pdf" }
    );
    const observado = await request(app)
      .patch(`/api/v1/stages/${stage.id}/state`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ state: "Observed" });
    expect(observado.status).toBe(200);

    const res = await subir(
      miembro,
      stage.id,
      { evidenceType: "document", category: "correccion" },
      { buf: Buffer.concat([PDF, Buffer.from("fix")]), nombre: "fix.pdf", tipo: "application/pdf" }
    );
    expect(res.status).toBe(201);
  });
});

describe("SPEC-218 · subida por lote", () => {
  let actorId: string;
  let investorId: string;
  let contador = 990_000;

  beforeAll(async () => {
    actorId = (
      await db
        .selectFrom("User")
        .select("id")
        .where("email", "=", FIXTURES.activo.email)
        .executeTakeFirstOrThrow()
    ).id;
    investorId = (
      await db
        .selectFrom("User")
        .select("id")
        .where("email", "=", FIXTURES.investor.email)
        .executeTakeFirstOrThrow()
    ).id;
  });

  const nuevoStage = async () =>
    (
      await crearStageMinteado({
        projectId,
        name: "Stage de lote",
        sequenceOrder: ++contador,
        actorUserId: actorId
      })
    ).id;

  const evidenciasDe = (sId: string) =>
    db.selectFrom("Evidence").selectAll().where("stageId", "=", sId).execute();
  const bundlesDe = (sId: string) =>
    db.selectFrom("EvidenceBundle").selectAll().where("stageId", "=", sId).execute();
  const anclajesDe = (sId: string) =>
    db
      .selectFrom("OnChainEvent")
      .select("id")
      .where("stageId", "=", sId)
      .where("eventType", "=", "EVIDENCE_ANCHOR")
      .execute();
  const notificacionesDeSubida = async () =>
    (
      await db
        .selectFrom("Notification")
        .select("id")
        .where("userId", "=", investorId)
        .where("titleKey", "=", "notifications.evidence.uploaded")
        .execute()
    ).length;

  const campos = { evidenceType: "document", category: "avance" };
  const archivo = (buf: Buffer, nombre: string, tipo = "application/pdf"): Archivo => ({
    buf,
    nombre,
    tipo
  });

  it("3 archivos válidos → 3 evidencias, UN bundle, UN anclaje, UNA notificación y 3 entradas de audit", async () => {
    const sId = await nuevoStage();
    const notifAntes = await notificacionesDeSubida();

    const res = await subirLote(miembro, sId, campos, [
      archivo(pdf(), "a.pdf"),
      archivo(png(), "b.png", "image/png"),
      archivo(jpeg(), "c.jpg", "image/jpeg")
    ]);

    expect(res.status).toBe(201);
    expect(res.body.evidences).toHaveLength(3);
    expect(res.body.rejected).toEqual([]);
    expect(await evidenciasDe(sId)).toHaveLength(3);

    const bundles = await bundlesDe(sId);
    expect(bundles).toHaveLength(1);
    expect(res.body.bundleId).toBe(bundles[0]?.id);
    const items = await db
      .selectFrom("EvidenceBundleItem")
      .select("evidenceId")
      .where("bundleId", "=", res.body.bundleId)
      .execute();
    expect(items).toHaveLength(3);
    expect(await anclajesDe(sId)).toHaveLength(1);

    expect((await notificacionesDeSubida()) - notifAntes).toBe(1);

    const auditorias = await db
      .selectFrom("AuditLog")
      .select("entityId")
      .where("action", "=", "UPLOAD_STAGE_EVIDENCE")
      .where(
        "entityId",
        "in",
        res.body.evidences.map((e: { id: string }) => e.id)
      )
      .execute();
    expect(auditorias).toHaveLength(3);
  });

  it("un archivo de tipo falso entre tres: se rechaza SOLO ese, y no deja rastro", async () => {
    const sId = await nuevoStage();
    const antes = archivosEnDisco();
    const notifAntes = await notificacionesDeSubida();

    const res = await subirLote(miembro, sId, campos, [
      archivo(pdf(), "ok1.pdf"),
      archivo(Buffer.from("MZ\x90\x00 ejecutable disfrazado"), "falso.pdf"),
      archivo(pdf(), "ok2.pdf")
    ]);

    expect(res.status).toBe(201);
    expect(res.body.evidences).toHaveLength(2);
    expect(res.body.rejected).toEqual([{ index: 1, code: "UNSUPPORTED_FILE_TYPE" }]);
    expect(await evidenciasDe(sId)).toHaveLength(2);
    expect((await notificacionesDeSubida()) - notifAntes).toBe(1);
    expect(archivosEnDisco() - antes).toBe(2);
  });

  it("un PNG etiquetado como JPEG también es un tipo que no coincide", async () => {
    const sId = await nuevoStage();
    const res = await subirLote(miembro, sId, campos, [
      archivo(png(), "engañoso.jpg", "image/jpeg"),
      archivo(pdf(), "ok.pdf")
    ]);

    expect(res.status).toBe(201);
    expect(res.body.rejected).toEqual([{ index: 0, code: "UNSUPPORTED_FILE_TYPE" }]);
    expect(res.body.evidences).toHaveLength(1);
  });

  it("ninguno aceptable → 400 NO_FILES_ACCEPTED, sin bundle, sin anclaje, sin notificación", async () => {
    const sId = await nuevoStage();
    const antes = archivosEnDisco();
    const notifAntes = await notificacionesDeSubida();

    const res = await subirLote(miembro, sId, campos, [
      archivo(Buffer.from("MZ uno"), "uno.pdf"),
      archivo(Buffer.from("MZ dos"), "dos.pdf")
    ]);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("NO_FILES_ACCEPTED");
    expect(res.body.rejected).toEqual([
      { index: 0, code: "UNSUPPORTED_FILE_TYPE" },
      { index: 1, code: "UNSUPPORTED_FILE_TYPE" }
    ]);
    expect(await evidenciasDe(sId)).toHaveLength(0);
    expect(await bundlesDe(sId)).toHaveLength(0);
    expect(await anclajesDe(sId)).toHaveLength(0);
    expect(await notificacionesDeSubida()).toBe(notifAntes);
    expect(archivosEnDisco()).toBe(antes);
  });

  it("más de 10 archivos → error del pedido: no se procesa ninguno ni queda nada en disco", async () => {
    const sId = await nuevoStage();
    const antes = archivosEnDisco();

    const res = await subirLote(
      miembro,
      sId,
      campos,
      Array.from({ length: 11 }, (_, i) => archivo(pdf(), `f${i}.pdf`))
    );

    expect(res.status).toBe(400);
    expect(await evidenciasDe(sId)).toHaveLength(0);
    expect(await bundlesDe(sId)).toHaveLength(0);
    expect(archivosEnDisco()).toBe(antes);
  });

  it("10 archivos (el tope) entran en un solo lote", async () => {
    const sId = await nuevoStage();
    const res = await subirLote(
      miembro,
      sId,
      campos,
      Array.from({ length: 10 }, (_, i) => archivo(pdf(), `f${i}.pdf`))
    );

    expect(res.status).toBe(201);
    expect(res.body.evidences).toHaveLength(10);
    expect(await bundlesDe(sId)).toHaveLength(1);
  });

  describe("repetidos", () => {
    it("dos archivos nuevos e idénticos, directo al backend: el primero entra, el segundo vuelve DUPLICATE_FILE_IN_BATCH", async () => {
      const sId = await nuevoStage();
      const igual = pdf();

      const res = await subirLote(miembro, sId, campos, [
        archivo(igual, "original.pdf"),
        archivo(Buffer.from(igual), "copia.pdf")
      ]);

      expect(res.status).toBe(201);
      expect(res.body.evidences).toHaveLength(1);
      expect(res.body.rejected).toEqual([{ index: 1, code: "DUPLICATE_FILE_IN_BATCH" }]);
      expect(await evidenciasDe(sId)).toHaveLength(1);
    });

    it("un archivo ya enviado en un lote anterior NO tumba el lote: el nuevo entra y el otro vuelve EVIDENCE_ALREADY_IN_STAGE", async () => {
      const sId = await nuevoStage();
      const previo = pdf();
      const primera = await subirLote(miembro, sId, campos, [archivo(previo, "previo.pdf")]);
      expect(primera.status).toBe(201);

      const antes = archivosEnDisco();
      const res = await subirLote(miembro, sId, campos, [
        archivo(Buffer.from(previo), "otra-vez.pdf"),
        archivo(pdf(), "nuevo.pdf")
      ]);

      expect(res.status).toBe(201);
      expect(res.body.rejected).toEqual([{ index: 0, code: "EVIDENCE_ALREADY_IN_STAGE" }]);
      expect(res.body.evidences).toHaveLength(1);
      expect(await evidenciasDe(sId)).toHaveLength(2);
      expect(archivosEnDisco() - antes).toBe(1);

      const items = await db
        .selectFrom("EvidenceBundleItem")
        .select("evidenceId")
        .where("bundleId", "=", res.body.bundleId)
        .execute();
      expect(items).toHaveLength(2);
    });

    it("dos idénticos que además ya estaban en el stage: los dos vuelven EVIDENCE_ALREADY_IN_STAGE (el motivo de fondo)", async () => {
      const sId = await nuevoStage();
      const previo = pdf();
      await subirLote(miembro, sId, campos, [archivo(previo, "previo.pdf")]);

      const res = await subirLote(miembro, sId, campos, [
        archivo(Buffer.from(previo), "a.pdf"),
        archivo(Buffer.from(previo), "b.pdf")
      ]);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("NO_FILES_ACCEPTED");
      expect(res.body.rejected).toEqual([
        { index: 0, code: "EVIDENCE_ALREADY_IN_STAGE" },
        { index: 1, code: "EVIDENCE_ALREADY_IN_STAGE" }
      ]);
    });

    it("el mismo archivo en OTRO stage sí se acepta", async () => {
      const uno = await nuevoStage();
      const otro = await nuevoStage();
      const contenido = pdf();

      expect((await subirLote(miembro, uno, campos, [archivo(contenido, "x.pdf")])).status).toBe(
        201
      );
      const res = await subirLote(miembro, otro, campos, [
        archivo(Buffer.from(contenido), "x.pdf")
      ]);

      expect(res.status).toBe(201);
      expect(res.body.rejected).toEqual([]);
    });

    it("SPEC-219: la carrera real — dos pedidos concurrentes con el mismo archivo, uno 201 y el otro 409 EVIDENCE_ALREADY_IN_STAGE, una sola fila", async () => {
      const sId = await nuevoStage();
      const contenido = pdf();

      const putReal = storage.put.bind(storage);
      let llegaron = 0;
      let soltar!: () => void;
      const ambos = new Promise<void>((r) => {
        soltar = r;
      });
      const put = vi.spyOn(storage, "put").mockImplementation(async (entrada) => {
        llegaron += 1;
        if (llegaron === 2) soltar();
        await ambos;
        return putReal(entrada);
      });

      const subida = () =>
        subirLote(miembro, sId, campos, [archivo(Buffer.from(contenido), "concurrente.pdf")]);

      const antes = archivosEnDisco();
      const [a, b] = await Promise.all([subida(), subida()]).finally(() => put.mockRestore());
      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([201, 409]);

      const perdedor = a.status === 409 ? a : b;
      expect(perdedor.body.code).toBe("EVIDENCE_ALREADY_IN_STAGE");

      expect(await evidenciasDe(sId)).toHaveLength(1);
      expect(archivosEnDisco() - antes).toBe(1);
    });
  });

  describe("errores del pedido: se deciden ANTES de guardar nada", () => {
    it("un stage Completed es 409 aun con un body grande, y la respuesta le llega al cliente", async () => {
      const sId = await nuevoStage();
      await db
        .updateTable("Stage")
        .set({ state: "Completed", updatedAt: new Date() })
        .where("id", "=", sId)
        .execute();
      const antes = archivosEnDisco();

      const grande = Buffer.concat([
        Buffer.from("%PDF-1.4\n"),
        Buffer.alloc(5 * 1024 * 1024, 0x42)
      ]);
      const res = await subirLote(miembro, sId, campos, [archivo(grande, "tarde.pdf")]);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("STAGE_ALREADY_COMPLETED");
      expect(archivosEnDisco()).toBe(antes);
    });

    it("un stage que no es de este proyecto es 404 y no guarda nada", async () => {
      const antes = archivosEnDisco();
      const res = await subirLote(miembro, createId(), campos, [archivo(pdf(), "x.pdf")]);

      expect(res.status).toBe(404);
      expect(archivosEnDisco()).toBe(antes);
    });
  });

  describe("fallas de infraestructura: nada a medias", () => {
    it("si `put` falla en el segundo de tres, se borra el primero y no queda ninguna fila", async () => {
      const sId = await nuevoStage();
      const antes = archivosEnDisco();
      const original = storage.put.bind(storage);
      let llamada = 0;
      const put = vi.spyOn(storage, "put").mockImplementation(async (entrada) => {
        if (++llamada === 2) throw new Error("R2 caído");
        return original(entrada);
      });

      const res = await subirLote(miembro, sId, campos, [
        archivo(pdf(), "a.pdf"),
        archivo(pdf(), "b.pdf"),
        archivo(pdf(), "c.pdf")
      ]);
      put.mockRestore();

      expect(res.status).toBe(500);
      expect(await evidenciasDe(sId)).toHaveLength(0);
      expect(await bundlesDe(sId)).toHaveLength(0);
      expect(archivosEnDisco()).toBe(antes);
    });

    it("si el hash de lo guardado no coincide con el del temporal, el pedido falla y se limpia todo", async () => {
      const sId = await nuevoStage();
      const antes = archivosEnDisco();
      const original = storage.put.bind(storage);
      const put = vi.spyOn(storage, "put").mockImplementation(async (entrada) => {
        const g = await original(entrada);
        return { ...g, sha256: "0".repeat(64) };
      });

      const res = await subirLote(miembro, sId, campos, [archivo(pdf(), "a.pdf")]);
      put.mockRestore();

      expect(res.status).toBe(500);
      expect(await evidenciasDe(sId)).toHaveLength(0);
      expect(await anclajesDe(sId)).toHaveLength(0);
      expect(archivosEnDisco()).toBe(antes);
    });

    it("si el anclaje falla (D-059), el lote igual entra: 201, archivos conservados y anchor Failed", async () => {
      const sId = await nuevoStage();
      const anclar = vi
        .spyOn(anchorPort(), "anchorCommitment")
        .mockRejectedValueOnce(new Error("el proveedor no contesta"));

      const res = await subirLote(miembro, sId, campos, [
        archivo(pdf(), "a.pdf"),
        archivo(pdf(), "b.pdf")
      ]);
      anclar.mockRestore();

      expect(res.status).toBe(201);
      expect(res.body.evidences).toHaveLength(2);
      expect(res.body.anchor.status).toBe("Failed");
      expect(res.body.anchor.txid).toBeNull();
      expect(await evidenciasDe(sId)).toHaveLength(2);
    });
  });

  it("el nombre en disco y `storedFilename` son opacos: no llevan el nombre original (regla 2)", async () => {
    const sId = await nuevoStage();
    const res = await subirLote(miembro, sId, campos, [
      archivo(pdf(), "plano-financiero-secreto.pdf")
    ]);

    expect(res.status).toBe(201);
    const [fila] = await evidenciasDe(sId);
    expect(fila?.originalFilename).toBe("plano-financiero-secreto.pdf");
    expect(fila?.storedFilename).not.toContain("secreto");
    expect(fila?.storagePath).not.toContain("secreto");
    expect(fila?.mimeType).toBe("application/pdf");
  });

  it("un lote con un solo archivo se comporta como la subida de siempre (compatibilidad de uso)", async () => {
    const sId = await nuevoStage();
    const res = await subirLote(miembro, sId, campos, [archivo(pdf(), "solo.pdf")]);

    expect(res.status).toBe(201);
    expect(res.body.evidences).toHaveLength(1);
    expect(res.body.rejected).toEqual([]);
    expect(res.body.merkleRoot).toMatch(/^[0-9a-f]{64}$/);
  });
});
