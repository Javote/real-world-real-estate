import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { crearBundle } from "../src/domain/stage-transition";
import { db } from "../src/lib/db";
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
const PDF = Buffer.from("%PDF-1.4\nevidencia de prueba\n%%EOF\n");

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

describe("POST /developer/projects/:id/stages/:stageId/evidence — subida de evidencia", () => {
  it("un developer miembro sube un PDF y el servidor calcula el SHA-256", async () => {
    const res = await subir(
      miembro,
      stageId,
      { evidenceType: "document", category: "permiso" },
      {
        buf: PDF,
        nombre: "permiso.pdf",
        tipo: "application/pdf"
      }
    );

    expect(res.status).toBe(201);
    // El hash lo calcula el SERVIDOR (regla 3): no llega del cliente, y tiene
    // que ser el del contenido real, no el de otra cosa.
    expect(res.body.evidence.sha256Hash).toBe(createHash("sha256").update(PDF).digest("hex"));
    expect(res.body.evidence.sha256Hash).toMatch(/^[a-f0-9]{64}$/);
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

    expect(res.status).toBeGreaterThanOrEqual(400);
    // Regla 10: si la validación falla después de que Multer escribió, se borra
    // el huérfano. Un directorio que crece con basura rechazada es una fuga.
    expect(archivosEnDisco()).toBe(antes);
  });

  it("rechaza un archivo más grande que el límite", async () => {
    const gigante = Buffer.alloc(2 * 1024 * 1024, 0x41); // 2 MB contra un límite de 1
    const res = await subir(
      miembro,
      stageId,
      { evidenceType: "photo", category: "obra" },
      {
        buf: gigante,
        nombre: "grande.png",
        tipo: "image/png"
      }
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("un body inválido borra el archivo que Multer ya había escrito", async () => {
    const antes = archivosEnDisco();
    // Falta `category`, que el schema exige.
    const res = await subir(
      miembro,
      stageId,
      { evidenceType: "document" },
      {
        buf: PDF,
        nombre: "sin-categoria.pdf",
        tipo: "application/pdf"
      }
    );

    expect(res.status).toBe(400);
    expect(archivosEnDisco()).toBe(antes);
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
        buf: PDF,
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
        buf: PDF,
        nombre: "storage-path.pdf",
        tipo: "application/pdf"
      }
    );
    evidenceId = res.body.evidence.id;
  });

  it("POST .../evidence no devuelve storagePath", async () => {
    const res = await subir(
      miembro,
      stageId,
      { evidenceType: "document", category: "permiso" },
      {
        buf: PDF,
        nombre: "otro.pdf",
        tipo: "application/pdf"
      }
    );

    expect(res.status).toBe(201);
    expect(res.body.evidence).not.toHaveProperty("storagePath");
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
      { buf: PDF, nombre: "foto.pdf", tipo: "application/pdf" }
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
      { buf: PDF, nombre: "foto2.pdf", tipo: "application/pdf" }
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
      { buf: PDF, nombre: "correccion.pdf", tipo: "application/pdf" }
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
      { buf: PDF, nombre: "unica.pdf", tipo: "application/pdf" }
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
    expect(root1).toBe(antes[0].commitmentHash);
    expect(root2).toBe(antes[0].commitmentHash);
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
      { buf: PDF, nombre: "previa.pdf", tipo: "application/pdf" }
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
      { buf: PDF, nombre: "tardia.pdf", tipo: "application/pdf" }
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
      { buf: PDF, nombre: "tardia2.pdf", tipo: "application/pdf" }
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
      { buf: PDF, nombre: "tardia3.pdf", tipo: "application/pdf" }
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
      { buf: PDF, nombre: "inicial.pdf", tipo: "application/pdf" }
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
