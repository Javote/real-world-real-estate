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

// 2026-09-08: `POST /projects/:id/evidence` y `GET /projects/:id/evidence`
// (CRUD genérico, sin caller real en el front — ver CLAUDE.md raíz) se
// borraron. Esta suite pasó a probar la ruta real que usa la pantalla,
// `POST /developer/projects/:id/stages/:stageId/evidence` (M2-D5 fila 38),
// que exige `stageId` en el path — a diferencia de la vieja, no admite un
// "documento suelto" sin etapa, y esa es la diferencia real entre las dos:
// la vieja lo permitía porque nadie lo pedía, no porque alguien lo usara.

const UPLOAD_DIR = resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./test-uploads");

// SPEC-218: un stage no tiene dos evidencias con el mismo SHA-256, así que un
// test que sube "un PDF cualquiera" dos veces al mismo stage ya no puede usar
// los mismos bytes: cada llamada produce un contenido ÚNICO. Los tests que
// necesitan el MISMO contenido dos veces lo dicen (reusan la variable).
const pdf = () => Buffer.from(`%PDF-1.4\nevidencia ${createId()}\n%%EOF\n`);
const png = () =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(createId())
  ]);
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(createId())]);
const PDF = pdf(); // solo para el test de 401, que no llega a guardar nada

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

  // Una sola etapa para los tests que no le importa el estado del stage —
  // los que sí (Pending→InProgress) crean la suya propia, más abajo.
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

/** Como `subir`, pero con N archivos en el mismo pedido (SPEC-218). */
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
    // El hash lo calcula el SERVIDOR (regla 3): no llega del cliente, y tiene
    // que ser el del contenido real, no el de otra cosa.
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

    // SPEC-218: un tipo no permitido es un rechazo POR ARCHIVO; con un solo
    // archivo y ninguno aceptado, el pedido es 400 NO_FILES_ACCEPTED.
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("NO_FILES_ACCEPTED");
    expect(res.body.rejected).toEqual([{ index: 0, code: "UNSUPPORTED_FILE_TYPE" }]);
    // Regla 10: si la validación falla después de que Multer escribió, se borra
    // el huérfano. Un directorio que crece con basura rechazada es una fuga.
    expect(archivosEnDisco()).toBe(antes);
  });

  it("rechaza un archivo más grande que el límite (EVIDENCE_MAX_FILE_MB, de packages/shared) sin dejar huérfanos", async () => {
    // El tope ya no es una variable de entorno que el test baja a 1 MB: es la
    // constante de `packages/shared`, la MISMA que usa el front — así que el test
    // sube 50 MB + 1 de verdad (SPEC-218; un test, ~1 s).
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
    // Falta `category`, que el schema exige.
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
    // La ruta migró su validación de texto a `call()` (SPEC-212, investigación
    // "Multer + call()") justo para que este shape deje de ser el único
    // distinto de las otras 45 rutas de §A-D — ver el comentario grande de
    // `developer-evidencia.routes.ts`.
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

    // Rol global correcto (developer) pero sin membresía: la segunda capa de
    // autorización es la que rechaza (regla 5). Y tampoco deja huérfano.
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
  // D-011: la clave de almacenamiento (acá, la ruta absoluta en disco del
  // servidor) es un detalle interno. Filtrarla expone la topología del
  // filesystem del servidor a cualquiera con acceso de lectura.
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

// M1-D2c: "Pending → InProgress : work initiated". La primera evidencia que
// un developer sube a un stage Pending es la señal de que el trabajo
// arrancó — sin botón aparte. Ver CLAUDE.md raíz y la restricción de
// PATCH /stages/:id/state en stage-transitions.test.ts.
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

// SPEC-403 — `authoritative` solo entendía el literal "true"; un checkbox
// real manda "on", y con la transformación vieja esa evidencia se guardaba
// como no-autoritativa en silencio: el guard de D-028 nunca se disparaba.
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
  // El bug que cierra: completar un stage llamaba a `crearBundle` dos veces
  // —una en el POST de evidencia, otra desde `transitionStage`— y la segunda
  // escribía una fila gemela con el MISMO root. En producción, "Terminaciones"
  // de `torre-a` quedó con 3 evidencias, 4 bundles y 3 roots distintos.
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

    // Tres subidas: cada una agrega una hoja, así que cada una es un conjunto
    // distinto y merece su propia acta.
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

    // El stage ya está en `InProgress`: la PRIMERA subida lo movió sola
    // (D-020, "work initiated"). Pedirlo de nuevo sería 409 — la FSM no tiene
    // `InProgress → InProgress`.
    const enCurso = await db
      .selectFrom("Stage")
      .select("state")
      .where("id", "=", stage.id)
      .executeTakeFirstOrThrow();
    expect(enCurso.state).toBe("InProgress");

    // Completar NO agrega evidencia, así que el conjunto no cambió: el acta
    // vigente ya dice ese root y no tiene que escribirse otra igual.
    const completado = await request(app)
      .patch(`/api/v1/stages/${stage.id}/state`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ state: "Completed" });
    expect(completado.status).toBe(200);

    const finales = await actas(stage.id);
    expect(finales).toHaveLength(3);
    // Y la invariante que importa, la que producción viola hoy: ninguna acta
    // repite el root de la anterior.
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

    // Dos llamadas más, sin evidencia nueva en el medio: las dos devuelven el
    // mismo root y ninguna escribe.
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
  // `Completed` es terminal en la FSM (D-020) y hasta hoy el pipeline de
  // evidencia no se enteraba: la subida armaba un bundle nuevo con un root
  // nuevo y lo anclaba, mientras el datum del hilo conserva el root congelado
  // al certificar. La pantalla del stage muestra el bundle MÁS RECIENTE, así
  // que ese root aparecía al lado del TXID de certificación que no lo
  // atestigua — regla 17.
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

    // Una evidencia mueve el stage a InProgress solo (D-020) y le da al
    // stage crítico lo que necesita para poder cerrarse.
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

// ─────────────────────────────────────────────────────────────────────────
// SPEC-218 — la subida por LOTE, validada en los dos lados.
//
// Un pedido trae hasta 10 archivos y produce UN bundle, UN anclaje y UNA
// notificación. Un archivo que no se acepta (tipo real no permitido, repetido,
// ya enviado al stage) se rechaza SOLO él: el resto entra, y el rechazado vuelve
// en `rejected` con su código.
// ─────────────────────────────────────────────────────────────────────────
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

  /** Un stage propio por test: los conteos (bundles, eventos, filas) no se pisan. */
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

    // Un lote es UN acta y UN anclaje, no uno por archivo (M2-D4 §P5).
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

    // Una notificación por lote al investor, no tres.
    expect((await notificacionesDeSubida()) - notifAntes).toBe(1);

    // El audit log conserva la granularidad: una entrada por evidencia.
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
      // Un ejecutable con el `Content-Type` de un PDF: lo que un `fileFilter`
      // por MIME declarado deja pasar.
      archivo(Buffer.from("MZ\x90\x00 ejecutable disfrazado"), "falso.pdf"),
      archivo(pdf(), "ok2.pdf")
    ]);

    expect(res.status).toBe(201);
    expect(res.body.evidences).toHaveLength(2);
    expect(res.body.rejected).toEqual([{ index: 1, code: "UNSUPPORTED_FILE_TYPE" }]);
    expect(await evidenciasDe(sId)).toHaveLength(2);
    expect((await notificacionesDeSubida()) - notifAntes).toBe(1);
    // Solo quedan en disco los dos aceptados (con `disk` el temporal ES el
    // almacenamiento): el rechazado no dejó ni el temporal.
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
        // Mismo contenido con OTRO nombre: cuenta el contenido, no el nombre.
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
      // Solo el nuevo dejó un archivo.
      expect(archivosEnDisco() - antes).toBe(1);

      // El root del segundo lote incluye UNA hoja nueva, no dos: 2 hojas en total.
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

      // 5 MB: si el servidor respondiera sin descartar el body, el cliente
      // vería un corte de conexión y no el 409.
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
    expect(fila?.originalFilename).toBe("plano-financiero-secreto.pdf"); // solo en la base
    expect(fila?.storedFilename).not.toContain("secreto");
    expect(fila?.storagePath).not.toContain("secreto");
    // Y lo que guardamos como tipo es el REAL, detectado, no el declarado.
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
