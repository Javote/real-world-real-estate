import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { MEMBERSHIP_ROLES } from "../src/db/types";
import { db } from "../src/lib/db";
import { ANY_MEMBERSHIP, canAccessProject } from "../src/middlewares/auth";
import { FIXTURES } from "./global-setup";

let miembro: string;
let ajeno: string;
let proyecto: string;

beforeAll(async () => {
  miembro = (
    await db
      .selectFrom("User")
      .selectAll()
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow()
  ).id;
  ajeno = (
    await db
      .selectFrom("User")
      .selectAll()
      .where("email", "=", FIXTURES.ajeno.email)
      .executeTakeFirstOrThrow()
  ).id;
  proyecto = (
    await db
      .selectFrom("Project")
      .selectAll()
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
});

afterAll(async () => {
  await db.destroy();
});

describe("canAccessProject", () => {
  it("acepta al miembro cuando su membresía está en la lista", async () => {
    expect(await canAccessProject(miembro, "developer", proyecto, ["developer"])).toBe(true);
  });

  it("rechaza al miembro cuando su membresía NO está en la lista", async () => {
    expect(await canAccessProject(miembro, "developer", proyecto, ["verifier"])).toBe(false);
  });

  it("rechaza a un usuario sin membresía en el proyecto", async () => {
    expect(await canAccessProject(ajeno, "developer", proyecto, ANY_MEMBERSHIP)).toBe(false);
  });

  it("acepta al miembro con ANY_MEMBERSHIP", async () => {
    expect(await canAccessProject(miembro, "developer", proyecto, ANY_MEMBERSHIP)).toBe(true);
  });

  it("un admin sin membresía pasa igual — el bypass de la matriz de M2-D1 §4", async () => {
    expect(await canAccessProject(ajeno, "admin", proyecto, ["verifier"])).toBe(true);
  });

  it("una lista vacía no acepta a nadie", async () => {
    expect(await canAccessProject(miembro, "developer", proyecto, [])).toBe(false);
  });

  it("ANY_MEMBERSHIP cubre el enum entero", async () => {
    expect([...ANY_MEMBERSHIP].sort()).toEqual([...MEMBERSHIP_ROLES].sort());
  });

  it("no compila si se omite qué membresías acepta", () => {
    // opcional, tsc falla con "Unused '@ts-expect-error' directive". La llamada
    const nuncaSeLlama = () =>
      // @ts-expect-error — el 4º parámetro es obligatorio
      canAccessProject(miembro, "developer", proyecto);

    expect(nuncaSeLlama).toBeTypeOf("function");
  });
});

describe("los endpoints de lectura siguen exigiendo membresía", () => {
  const login = (email: string, password: string) =>
    request(app).post("/api/v1/auth/login").send({ email, password });

  const tokenDe = async (f: { email: string; password: string }) =>
    (await login(f.email, f.password)).body.token as string;

  it("un developer sin membresía no lee el detalle del proyecto", async () => {
    const token = await tokenDe(FIXTURES.ajeno);

    const res = await request(app)
      .get(`/api/v1/projects/${proyecto}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("un developer sin membresía no lista los documentos del proyecto", async () => {
    const token = await tokenDe(FIXTURES.ajeno);

    const res = await request(app)
      .get(`/api/v1/projects/${proyecto}/documents`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("el miembro sí lee el detalle del proyecto", async () => {
    const token = await tokenDe(FIXTURES.activo);

    const res = await request(app)
      .get(`/api/v1/projects/${proyecto}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

describe("GET /api/v1/projects · el listado usa la misma regla", () => {
  const login = (email: string, password: string) =>
    request(app).post("/api/v1/auth/login").send({ email, password });

  const listar = async (f: { email: string; password: string }) => {
    const { body } = await login(f.email, f.password);
    return request(app).get("/api/v1/projects").set("Authorization", `Bearer ${body.token}`);
  };

  it("un miembro ve su proyecto y NO ve el ajeno", async () => {
    const res = await listar(FIXTURES.activo);

    expect(res.status).toBe(200);
    expect(res.body.map((p: { slug: string }) => p.slug)).toEqual([FIXTURES.proyecto.slug]);
  });

  it("un proyecto con dos membresías del mismo usuario aparece UNA vez", async () => {
    const res = await listar(FIXTURES.activo);

    const torres = res.body.filter((p: { slug: string }) => p.slug === FIXTURES.proyecto.slug);
    expect(torres).toHaveLength(1);
  });

  it("un usuario sin ninguna membresía no ve nada", async () => {
    const res = await listar(FIXTURES.ajeno);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("un admin ve los dos proyectos, del más nuevo al más viejo", async () => {
    const res = await listar(FIXTURES.admin);

    expect(res.status).toBe(200);
    expect(res.body.map((p: { slug: string }) => p.slug)).toEqual([
      FIXTURES.otroProyecto.slug,
      FIXTURES.proyecto.slug
    ]);
  });
});

describe("canAccessProject · un proyecto que no existe", () => {
  it("no se lo concede ni a un admin", async () => {
    expect(await canAccessProject("cualquiera", "admin", "no-existe", ANY_MEMBERSHIP)).toBe(false);
  });
});
