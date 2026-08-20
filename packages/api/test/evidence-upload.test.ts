import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import { FIXTURES } from "./global-setup";

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

beforeAll(async () => {
  miembro = await token(FIXTURES.activo.email, FIXTURES.activo.password);
  ajeno = await token(FIXTURES.ajeno.email, FIXTURES.ajeno.password);
  const p = await prisma.project.findUniqueOrThrow({ where: { slug: FIXTURES.proyecto.slug } });
  projectId = p.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const subir = (tk: string, campos: Record<string, string>, archivo?: { buf: Buffer; nombre: string; tipo: string }) => {
  const req = request(app)
    .post(`/api/v1/projects/${projectId}/evidence`)
    .set("Authorization", `Bearer ${tk}`);
  for (const [k, v] of Object.entries(campos)) req.field(k, v);
  if (archivo) req.attach("file", archivo.buf, { filename: archivo.nombre, contentType: archivo.tipo });
  return req;
};

describe("POST /projects/:id/evidence — subida de evidencia", () => {
  it("un developer miembro sube un PDF y el servidor calcula el SHA-256", async () => {
    const res = await subir(miembro, { evidenceType: "document", category: "permiso" }, {
      buf: PDF, nombre: "permiso.pdf", tipo: "application/pdf",
    });

    expect(res.status).toBe(201);
    // El hash lo calcula el SERVIDOR (regla 3): no llega del cliente, y tiene
    // que ser el del contenido real, no el de otra cosa.
    expect(res.body.sha256Hash).toBe(createHash("sha256").update(PDF).digest("hex"));
    expect(res.body.sha256Hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rechaza un tipo de archivo no permitido SIN dejar el archivo huérfano", async () => {
    const antes = archivosEnDisco();
    const res = await subir(miembro, { evidenceType: "document", category: "x" }, {
      buf: Buffer.from("MZ ejecutable"), nombre: "virus.exe", tipo: "application/x-msdownload",
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    // Regla 10: si la validación falla después de que Multer escribió, se borra
    // el huérfano. Un directorio que crece con basura rechazada es una fuga.
    expect(archivosEnDisco()).toBe(antes);
  });

  it("rechaza un archivo más grande que el límite", async () => {
    const gigante = Buffer.alloc(2 * 1024 * 1024, 0x41); // 2 MB contra un límite de 1
    const res = await subir(miembro, { evidenceType: "photo", category: "obra" }, {
      buf: gigante, nombre: "grande.png", tipo: "image/png",
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("un body inválido borra el archivo que Multer ya había escrito", async () => {
    const antes = archivosEnDisco();
    // Falta `category`, que el schema exige.
    const res = await subir(miembro, { evidenceType: "document" }, {
      buf: PDF, nombre: "sin-categoria.pdf", tipo: "application/pdf",
    });

    expect(res.status).toBe(400);
    expect(archivosEnDisco()).toBe(antes);
  });

  it("sin archivo devuelve 400", async () => {
    const res = await subir(miembro, { evidenceType: "document", category: "permiso" });

    expect(res.status).toBe(400);
  });

  it("un developer que NO es miembro del proyecto no puede subir", async () => {
    const antes = archivosEnDisco();
    const res = await subir(ajeno, { evidenceType: "document", category: "permiso" }, {
      buf: PDF, nombre: "ajeno.pdf", tipo: "application/pdf",
    });

    // Rol global correcto (developer) pero sin membresía: la segunda capa de
    // autorización es la que rechaza (regla 5). Y tampoco deja huérfano.
    expect(res.status).toBe(403);
    expect(archivosEnDisco()).toBe(antes);
  });

  it("sin token no se puede subir", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/evidence`)
      .field("evidenceType", "document")
      .field("category", "permiso")
      .attach("file", PDF, { filename: "x.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(401);
  });
});
