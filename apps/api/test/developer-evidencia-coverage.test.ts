import { existsSync, readdirSync } from "node:fs";
import type { Request } from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { createId } from "../src/db/id.js";
import { db } from "../src/lib/db.js";
import { storage } from "../src/lib/storage.js";
import { FIXTURES } from "./global-setup.js";
import { crearStageMinteado } from "./helpers/stages.js";

vi.mock("@plataforma/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@plataforma/shared")>()),
  EVIDENCE_MAX_FILE_BYTES: 64 * 1024
}));

const ganchos = vi.hoisted(() => ({
  despuesDeMulter: null as null | ((req: Request) => Promise<void>)
}));

vi.mock("../src/lib/upload.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/lib/upload.js")>();
  const envuelto: typeof real.uploadEvidenceFiles = (req, res, cb) =>
    real.uploadEvidenceFiles(req, res, (err?: unknown) => {
      const gancho = ganchos.despuesDeMulter;
      if (err || !gancho) return cb(err);
      gancho(req as Request).then(() => cb(), cb);
    });
  return { ...real, uploadEvidenceFiles: envuelto };
});

const pdf = () => Buffer.from(`%PDF-1.4\nevidencia ${createId()}\n%%EOF\n`);
const archivosEnDisco = () => {
  const dir = process.env.UPLOAD_DIR!;
  return existsSync(dir) ? readdirSync(dir).length : 0;
};

let miembro: string;
let projectId: string;
let actorId: string;
let contador = Math.floor(Math.random() * 1_000_000) + 3_000_000;

const nuevoStage = async () =>
  (
    await crearStageMinteado({
      projectId,
      name: "Stage de cobertura A2",
      sequenceOrder: ++contador,
      actorUserId: actorId
    })
  ).id;

const cerrar = (sId: string) =>
  db
    .updateTable("Stage")
    .set({ state: "Completed", updatedAt: new Date() })
    .where("id", "=", sId)
    .execute();

const evidenciasDe = (sId: string) =>
  db.selectFrom("Evidence").select("id").where("stageId", "=", sId).execute();

const url = (sId: string) => `/api/v1/developer/projects/${projectId}/stages/${sId}/evidence`;

const subir = (sId: string) =>
  request(app)
    .post(url(sId))
    .set("Authorization", `Bearer ${miembro}`)
    .field("evidenceType", "document")
    .field("category", "avance")
    .attach("file", pdf(), { filename: "a.pdf", contentType: "application/pdf" });

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

afterEach(() => {
  ganchos.despuesDeMulter = null;
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.destroy();
});

describe("rechazarStageAntesDeRecibir — el drenaje del body", () => {
  it("un body que ya llegó entero (JSON, lo consumió express.json) se rechaza de inmediato con el 409", async () => {
    const sId = await nuevoStage();
    await cerrar(sId);

    const res = await request(app)
      .post(url(sId))
      .set("Authorization", `Bearer ${miembro}`)
      .send({ evidenceType: "document", category: "avance" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("STAGE_ALREADY_COMPLETED");
  });

  it("un cliente que sigue mandando bytes más allá del tope no es una subida: se le corta la conexión", async () => {
    const sId = await nuevoStage();
    await cerrar(sId);
    const antes = archivosEnDisco();

    const pedido = request(app)
      .post(url(sId))
      .set("Authorization", `Bearer ${miembro}`)
      .set("Content-Type", "application/octet-stream")
      .send(Buffer.alloc(2 * 1024 * 1024, 0x42));

    await expect(pedido).rejects.toThrow();
    expect(archivosEnDisco()).toBe(antes);
  });

  it("si mirar el stage falla, el error va a errorHandler (500) sin leer el body", async () => {
    const sId = await nuevoStage();
    const original = db.selectFrom.bind(db);
    vi.spyOn(db, "selectFrom").mockImplementation(((tabla: string) => {
      if (tabla === "Stage") throw new Error("base caída");
      return original(tabla as never);
    }) as typeof db.selectFrom);

    const res = await subir(sId);

    expect(res.status).toBe(500);
  });
});

describe("POST .../evidence — el pedido que no es multipart", () => {
  it("un POST en JSON a un stage abierto no trae archivos: 400 File is required", async () => {
    const sId = await nuevoStage();

    const res = await request(app)
      .post(url(sId))
      .set("Authorization", `Bearer ${miembro}`)
      .send({ evidenceType: "document", category: "avance" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("File is required");
    expect(await evidenciasDe(sId)).toHaveLength(0);
  });
});

describe("POST .../evidence — el stage se cerró mientras subían los bytes", () => {
  it("el segundo chequeo lo ve: 409 STAGE_ALREADY_COMPLETED, sin filas y sin temporales", async () => {
    const sId = await nuevoStage();
    const antes = archivosEnDisco();
    ganchos.despuesDeMulter = async () => {
      await cerrar(sId);
    };

    const res = await subir(sId);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("STAGE_ALREADY_COMPLETED");
    expect(await evidenciasDe(sId)).toHaveLength(0);
    expect(archivosEnDisco()).toBe(antes);
  });
});

// El INSERT de las evidencias rechaza al ejecutarse, con cualquier cadena del builder antes.
function insertQueFalla(error: Error) {
  const consulta: object = new Proxy(
    {},
    { get: (_, clave) => (clave === "execute" ? () => Promise.reject(error) : () => consulta) }
  );
  vi.spyOn(db, "insertInto").mockImplementationOnce(
    () => consulta as ReturnType<typeof db.insertInto>
  );
}

describe("POST .../evidence — fallas de infraestructura al confirmar", () => {
  it("un insert que falla por otra cosa que el UNIQUE (stageId, sha256Hash) se relanza (500) y limpia lo subido", async () => {
    const sId = await nuevoStage();
    const antes = archivosEnDisco();
    const remove = vi.spyOn(storage, "remove");
    insertQueFalla(new Error("disco lleno"));

    const res = await subir(sId);

    expect(res.status).toBe(500);
    expect(res.body.code).not.toBe("EVIDENCE_ALREADY_IN_STAGE");
    expect(remove).toHaveBeenCalledTimes(1);
    expect(await evidenciasDe(sId)).toHaveLength(0);
    expect(archivosEnDisco()).toBe(antes);
  });

  it("un UNIQUE de otro índice no se confunde con el repetido: se relanza y errorHandler da el 409 genérico", async () => {
    const sId = await nuevoStage();
    const antes = archivosEnDisco();
    const choque = Object.assign(new Error("UNIQUE constraint failed: Evidence.id"), {
      code: "SQLITE_CONSTRAINT_UNIQUE"
    });
    insertQueFalla(choque);

    const res = await subir(sId);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("RESOURCE_ALREADY_EXISTS");
    expect(await evidenciasDe(sId)).toHaveLength(0);
    expect(archivosEnDisco()).toBe(antes);
  });

  it("si limpiar el objeto ya subido falla, se registra y el pedido sigue fallando con su error original", async () => {
    const sId = await nuevoStage();
    const original = storage.put.bind(storage);
    vi.spyOn(storage, "put").mockImplementation(async (entrada) => {
      const g = await original(entrada);
      return { ...g, sha256: "0".repeat(64) };
    });
    vi.spyOn(storage, "remove").mockRejectedValue(new Error("R2 caído"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await subir(sId);

    expect(res.status).toBe(500);
    expect(log).toHaveBeenCalledWith("[upload] no se pudo limpiar", expect.any(Error));
    expect(await evidenciasDe(sId)).toHaveLength(0);
  });
});
