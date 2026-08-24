import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { ANY_MEMBERSHIP, requireProjectAccess } from "../src/middlewares/auth";
import { FIXTURES } from "./global-setup";

// SPEC-012 §Invariantes. Es la capa 2 de la regla 5 y es 🔴: cada código de
// respuesta de la invariante 4 tiene su caso, en las DOS formas de `source`.

let proyecto: string;
let milestone: string;
let evidencia: string;

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

const tokenDe = async (f: { email: string; password: string }) =>
  (await login(f)).body.token as string;

beforeAll(async () => {
  proyecto = (
    await db
      .selectFrom("Project")
      .selectAll()
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;

  const ahora = new Date();

  // Un stage y una evidencia del proyecto de prueba: son lo que la forma B
  // tiene que cargar para averiguar a qué proyecto pertenecen.
  milestone = createId();
  await db
    .insertInto("Milestone")
    .values({
      id: milestone,
      projectId: proyecto,
      name: "Stage de prueba",
      sequenceOrder: 1,
      state: "Pending",
      validationCritical: false,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();

  const subeUsuario = (
    await db
      .selectFrom("User")
      .selectAll()
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow()
  ).id;

  evidencia = createId();
  await db
    .insertInto("Evidence")
    .values({
      id: evidencia,
      projectId: proyecto,
      milestoneId: milestone,
      uploadedById: subeUsuario,
      evidenceType: "document",
      category: "permits",
      authoritative: false,
      originalFilename: "prueba.pdf",
      storedFilename: "prueba-guardada.pdf",
      storagePath: "/tmp/no-existe/prueba.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1,
      sha256Hash: "0".repeat(64),
      uploadedAt: ahora,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
});

afterAll(async () => {
  await db.destroy();
});

describe("requireProjectAccess · forma A (el projectId está en el path)", () => {
  it("401 sin token — la capa 1 corta antes", async () => {
    const res = await request(app).get(`/api/v1/projects/${proyecto}/milestones`);
    expect(res.status).toBe(401);
  });

  it("403 para un developer que no es miembro", async () => {
    const token = await tokenDe(FIXTURES.ajeno);
    const res = await request(app)
      .get(`/api/v1/projects/${proyecto}/milestones`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("200 para el miembro — el control de que no cierra de más", async () => {
    const token = await tokenDe(FIXTURES.activo);
    const res = await request(app)
      .get(`/api/v1/projects/${proyecto}/milestones`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("403 si el proyecto no existe, incluso para admin (D-043)", async () => {
    const token = await tokenDe(FIXTURES.admin);
    const res = await request(app)
      .get(`/api/v1/projects/${createId()}/milestones`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe("requireProjectAccess · forma B (hay que cargar la entidad)", () => {
  it("404 cuando el stage no existe, con el mensaje de siempre", async () => {
    const token = await tokenDe(FIXTURES.activo);
    const res = await request(app)
      .get(`/api/v1/milestones/${createId()}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Milestone not found");
  });

  it("404 cuando la evidencia no existe", async () => {
    const token = await tokenDe(FIXTURES.activo);
    const res = await request(app)
      .get(`/api/v1/evidence/${createId()}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Evidence not found");
  });

  it("403 cuando el stage existe pero el usuario no es miembro de su proyecto", async () => {
    const token = await tokenDe(FIXTURES.ajeno);
    const res = await request(app)
      .get(`/api/v1/milestones/${milestone}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("403 cuando la evidencia existe pero el usuario no es miembro", async () => {
    const token = await tokenDe(FIXTURES.ajeno);
    const res = await request(app)
      .get(`/api/v1/evidence/${evidencia}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("200 para el miembro — sin esto, los 403 de arriba pasarían con todo roto", async () => {
    const token = await tokenDe(FIXTURES.activo);
    const res = await request(app)
      .get(`/api/v1/milestones/${milestone}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("el 403 gana sobre el 404: no se filtra si la entidad ajena existe", async () => {
    // Los dos casos dan el MISMO status para el no-miembro, así que desde
    // afuera no se puede distinguir "no existe" de "existe y no es tuyo"...
    // salvo por el caso de arriba, donde la entidad inexistente da 404. Esa
    // asimetría es deuda conocida y declarada (SPEC-012 §Lo que NO hace).
    const token = await tokenDe(FIXTURES.ajeno);
    const existente = await request(app)
      .get(`/api/v1/milestones/${milestone}`)
      .set("Authorization", `Bearer ${token}`);
    const inexistente = await request(app)
      .get(`/api/v1/milestones/${createId()}`)
      .set("Authorization", `Bearer ${token}`);

    expect(existente.status).toBe(403);
    expect(inexistente.status).toBe(404);
  });
});

describe("requireProjectAccess · la forma no deja omitir las membresías", () => {
  it("no compila si falta `allowedMemberships`", () => {
    // Igual que en `canAccessProject` (D-042), lo verifica el TYPECHECK: si el
    // parámetro se volviera opcional o pasara a rest args, tsc falla con
    // "Unused '@ts-expect-error' directive". Con rest args esto COMPILARÍA y
    // significaría lista vacía — cerrado, pero en silencio. Por eso es
    // posicional y obligatorio.
    const nuncaSeLlama = () =>
      // @ts-expect-error — `allowedMemberships` es obligatorio (SPEC-012)
      requireProjectAccess({ param: "id" });

    expect(nuncaSeLlama).toBeTypeOf("function");
  });

  it("ANY_MEMBERSHIP sigue siendo lo que se escribe para abrir a cualquier miembro", () => {
    expect(requireProjectAccess({ param: "id" }, ANY_MEMBERSHIP)).toBeTypeOf("function");
  });
});
