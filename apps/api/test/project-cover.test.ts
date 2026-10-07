import { existsSync, readdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { PROJECT_COVER_MAX_FILE_BYTES } from "@plataforma/shared";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { createId } from "../src/db/id.js";
import { db } from "../src/lib/db.js";
import { storage } from "../src/lib/storage.js";
import { FIXTURES } from "./global-setup.js";

const UPLOAD_DIR = resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./test-uploads");
const archivosEnDisco = () => (existsSync(UPLOAD_DIR) ? readdirSync(UPLOAD_DIR).length : 0);

const png = () =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(createId())
  ]);
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(createId())]);
const pdf = () => Buffer.from(`%PDF-1.4\nno es una portada ${createId()}\n%%EOF\n`);

const token = async (email: string, password: string) => {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password });
  return res.body.token as string;
};

let developer: string;
let ajeno: string;
let developerId: string;

async function nuevoProyecto() {
  const id = createId();
  const ahora = new Date();
  await db
    .insertInto("Project")
    .values({
      id,
      name: "Torre Portada",
      slug: `torre-portada-${id}`,
      totalUnits: 0,
      status: "planning",
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  await db
    .insertInto("ProjectMember")
    .values({
      id: createId(),
      userId: developerId,
      projectId: id,
      membershipRole: "developer",
      createdAt: ahora
    })
    .execute();
  return id;
}

const subir = (tk: string, projectId: string, archivo?: { buf: Buffer; tipo: string }) => {
  const req = request(app)
    .put(`/api/v1/developer/projects/${projectId}/cover`)
    .set("Authorization", `Bearer ${tk}`);
  return archivo
    ? req.attach("file", archivo.buf, { filename: "render-fachada.png", contentType: archivo.tipo })
    : req.field("nada", "x");
};

const portadaDe = (projectId: string) =>
  db.selectFrom("ProjectCover").selectAll().where("projectId", "=", projectId).executeTakeFirst();

beforeAll(async () => {
  developer = await token(FIXTURES.activo.email, FIXTURES.activo.password);
  ajeno = await token(FIXTURES.ajeno.email, FIXTURES.ajeno.password);
  developerId = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow()
  ).id;
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.destroy();
});

// El segundo paso del lote (el UPDATE de `Project`) apunta a una tabla que no existe: el lote entero
// falla y el upsert de la portada, que iba primero, se deshace con él.
function loteQueFalla() {
  vi.spyOn(db, "updateTable").mockImplementationOnce(
    () =>
      ({
        set: () => ({
          where: () => ({ compile: () => ({ sql: "update NoExiste set x = 1", parameters: [] }) })
        })
      }) as unknown as ReturnType<typeof db.updateTable>
  );
}

describe("PUT /developer/projects/:id/cover — quién puede", () => {
  it("sin sesión, 401", async () => {
    const id = await nuevoProyecto();
    const res = await request(app)
      .put(`/api/v1/developer/projects/${id}/cover`)
      .attach("file", png(), { filename: "a.png", contentType: "image/png" });
    expect(res.status).toBe(401);
  });

  it("un developer que no es del proyecto, 403, y no queda nada guardado", async () => {
    const id = await nuevoProyecto();
    const antes = archivosEnDisco();
    const res = await subir(ajeno, id, { buf: png(), tipo: "image/png" });
    expect(res.status).toBe(403);
    expect(await portadaDe(id)).toBeUndefined();
    expect(archivosEnDisco()).toBe(antes);
  });

  it("un id que no tiene forma de id, 400", async () => {
    const res = await subir(developer, "no-es-un-id!", { buf: png(), tipo: "image/png" });
    expect(res.status).toBe(400);
  });
});

describe("PUT /developer/projects/:id/cover — qué acepta", () => {
  it("sin archivo, 400", async () => {
    const id = await nuevoProyecto();
    const res = await subir(developer, id);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("File is required");
  });

  it("un PDF es evidencia válida pero no una portada: 400 y ningún archivo huérfano", async () => {
    const id = await nuevoProyecto();
    const antes = archivosEnDisco();
    const res = await subir(developer, id, { buf: pdf(), tipo: "application/pdf" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("UNSUPPORTED_FILE_TYPE");
    expect(await portadaDe(id)).toBeUndefined();
    expect(archivosEnDisco()).toBe(antes);
  });

  it("un PNG declarado como JPEG se rechaza: el tipo real tiene que coincidir", async () => {
    const id = await nuevoProyecto();
    const res = await subir(developer, id, { buf: png(), tipo: "image/jpeg" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("UNSUPPORTED_FILE_TYPE");
  });

  it("más grande que el tope de la portada, 400 LIMIT_FILE_SIZE", async () => {
    const id = await nuevoProyecto();
    const antes = archivosEnDisco();
    const grande = Buffer.concat([jpeg(), Buffer.alloc(PROJECT_COVER_MAX_FILE_BYTES)]);
    const res = await subir(developer, id, { buf: grande, tipo: "image/jpeg" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("LIMIT_FILE_SIZE");
    expect(archivosEnDisco()).toBe(antes);
  });
});

describe("PUT /developer/projects/:id/cover — cargar y reemplazar", () => {
  it("guarda la portada, marca la versión en el proyecto y escribe el AuditLog", async () => {
    const id = await nuevoProyecto();
    const res = await subir(developer, id, { buf: png(), tipo: "image/png" });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["coverUpdatedAt"]);

    const proyecto = await db
      .selectFrom("Project")
      .select("coverUpdatedAt")
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    expect(proyecto.coverUpdatedAt?.toISOString()).toBe(res.body.coverUpdatedAt);

    const portada = await portadaDe(id);
    expect(portada?.mimeType).toBe("image/png");
    expect(await storage.exists(portada!.storageRef)).toBe(true);

    const audit = await db
      .selectFrom("AuditLog")
      .select(["action", "entityType"])
      .where("entityId", "=", id)
      .where("action", "=", "UPDATE_PROJECT_COVER")
      .execute();
    expect(audit).toEqual([{ action: "UPDATE_PROJECT_COVER", entityType: "Project" }]);
  });

  it("la ref de almacenamiento nunca sale en el detalle del proyecto", async () => {
    const id = await nuevoProyecto();
    await subir(developer, id, { buf: png(), tipo: "image/png" });
    const res = await request(app)
      .get(`/api/v1/developer/projects/${id}`)
      .set("Authorization", `Bearer ${developer}`);
    expect(res.status).toBe(200);
    expect(res.body.coverUpdatedAt).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toContain("project-cover");
    expect(JSON.stringify(res.body)).not.toContain(UPLOAD_DIR);
  });

  it("reemplazarla borra el objeto anterior y deja una sola fila", async () => {
    const id = await nuevoProyecto();
    await subir(developer, id, { buf: png(), tipo: "image/png" });
    const primera = await portadaDe(id);

    const res = await subir(developer, id, { buf: jpeg(), tipo: "image/jpeg" });

    expect(res.status).toBe(200);
    const segunda = await portadaDe(id);
    expect(segunda?.mimeType).toBe("image/jpeg");
    expect(segunda?.storageRef).not.toBe(primera?.storageRef);
    expect(await storage.exists(primera!.storageRef)).toBe(false);
    expect(await storage.exists(segunda!.storageRef)).toBe(true);
  });

  it("si borrar la anterior falla, se registra y la portada nueva queda igual", async () => {
    const id = await nuevoProyecto();
    await subir(developer, id, { buf: png(), tipo: "image/png" });
    vi.spyOn(storage, "remove").mockRejectedValueOnce(new Error("R2 caído"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await subir(developer, id, { buf: jpeg(), tipo: "image/jpeg" });

    expect(res.status).toBe(200);
    expect(log).toHaveBeenCalledWith("[portada] no se pudo borrar la anterior", expect.any(Error));
    expect((await portadaDe(id))?.mimeType).toBe("image/jpeg");
  });

  it("si las filas no se confirman, 500: se borra lo subido y la portada anterior sigue", async () => {
    const id = await nuevoProyecto();
    await subir(developer, id, { buf: png(), tipo: "image/png" });
    const anterior = await portadaDe(id);
    const antes = archivosEnDisco();
    loteQueFalla();

    const res = await subir(developer, id, { buf: jpeg(), tipo: "image/jpeg" });

    expect(res.status).toBe(500);
    expect(await portadaDe(id)).toEqual(anterior);
    expect(await storage.exists(anterior!.storageRef)).toBe(true);
    expect(archivosEnDisco()).toBe(antes);
  });

  it("si además limpiar lo subido falla, se registra y el pedido falla con su error original", async () => {
    const id = await nuevoProyecto();
    loteQueFalla();
    vi.spyOn(storage, "remove").mockRejectedValueOnce(new Error("R2 caído"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await subir(developer, id, { buf: png(), tipo: "image/png" });

    expect(res.status).toBe(500);
    expect(log).toHaveBeenCalledWith("[portada] no se pudo limpiar", expect.any(Error));
    expect(await portadaDe(id)).toBeUndefined();
  });
});

describe("GET /public/projects/:id/cover — sin sesión", () => {
  it("sirve la imagen con su tipo, cacheable y legible desde otro origen", async () => {
    const id = await nuevoProyecto();
    const imagen = png();
    const subida = await subir(developer, id, { buf: imagen, tipo: "image/png" });

    const res = await request(app)
      .get(`/api/v1/public/projects/${id}/cover`)
      .query({ v: subida.body.coverUpdatedAt })
      .buffer(true)
      .parse((r, cb) => {
        const partes: Buffer[] = [];
        r.on("data", (c: Buffer) => partes.push(c));
        r.on("end", () => cb(null, Buffer.concat(partes)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(Buffer.compare(res.body as Buffer, imagen)).toBe(0);
  });

  it("un proyecto sin portada, 404", async () => {
    const id = await nuevoProyecto();
    const res = await request(app).get(`/api/v1/public/projects/${id}/cover`);
    expect(res.status).toBe(404);
  });

  it("una fila cuyo objeto ya no está, 404 y no un 500", async () => {
    const id = await nuevoProyecto();
    await subir(developer, id, { buf: png(), tipo: "image/png" });
    unlinkSync((await portadaDe(id))!.storageRef);

    const res = await request(app).get(`/api/v1/public/projects/${id}/cover`);
    expect(res.status).toBe(404);
  });

  it("un id que no tiene forma de id, 400", async () => {
    const res = await request(app).get("/api/v1/public/projects/no-es-un-id!/cover");
    expect(res.status).toBe(400);
  });
});
