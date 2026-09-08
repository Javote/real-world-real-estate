import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

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

  // Una sola etapa para los tests que no le importa el estado del stage —
  // los que sí (Pending→InProgress) crean la suya propia, más abajo.
  const stage = await request(app)
    .post(`/api/v1/projects/${projectId}/stages`)
    .set("Authorization", `Bearer ${miembro}`)
    .send({ name: "Stage para subida de evidencia", sequenceOrder: 999_501 });
  stageId = stage.body.id;
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
