import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import type { UserRole } from "../src/db/types.js";
import { db } from "../src/lib/db.js";
import { FIXTURES } from "./global-setup.js";
import { crearStageMinteado } from "./helpers/stages.js";

const token = async (email: string, password: string) => {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password });
  return res.body.token as string;
};

const cambiarRol = (email: string, role: UserRole) =>
  db.updateTable("User").set({ role }).where("email", "=", email).execute();

let proyecto: string;
let stage: string;

beforeAll(async () => {
  proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
  const dev = await db
    .selectFrom("User")
    .select("id")
    .where("email", "=", FIXTURES.activo.email)
    .executeTakeFirstOrThrow();
  stage = (
    await crearStageMinteado({
      projectId: proyecto,
      name: "Sesión",
      sequenceOrder: 901,
      actorUserId: dev.id
    })
  ).id;
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.destroy();
});

const soloAdmin = (t: string) =>
  request(app)
    .get(`/api/v1/projects/${proyecto}/certifier-invitations`)
    .set("Authorization", `Bearer ${t}`);

describe("authorize corre la regla con el token mientras la base confirma al usuario", () => {
  it("un token de admin cuyo rol bajó en la base ya no entra: manda la base", async () => {
    const t = await token(FIXTURES.revocable.email, FIXTURES.revocable.password);
    expect((await soloAdmin(t)).status).toBe(200);

    await cambiarRol(FIXTURES.revocable.email, "buyer");

    expect((await soloAdmin(t)).status).toBe(403);
  });

  it("un token de buyer cuyo rol subió a admin en la base entra: manda la base", async () => {
    const t = await token(FIXTURES.investor.email, FIXTURES.investor.password);
    expect((await soloAdmin(t)).status).toBe(403);

    await cambiarRol(FIXTURES.investor.email, "admin");

    expect((await soloAdmin(t)).status).toBe(200);
  });

  it("si leer el usuario falla, 401 Invalid token, como cuando authenticate lo esperaba", async () => {
    const t = await token(FIXTURES.activo.email, FIXTURES.activo.password);
    const selectFrom = db.selectFrom.bind(db);
    vi.spyOn(db, "selectFrom").mockImplementation(((tabla: string) => {
      if (tabla === "User") throw new Error("base caída");
      return selectFrom(tabla as never);
    }) as typeof db.selectFrom);

    const res = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${t}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Invalid token" });
  });

  it("usuario inactivo y regla que revienta: 401, no 500, y la regla anticipada no queda sin manejar", async () => {
    const t = await token(FIXTURES.activo.email, FIXTURES.activo.password);
    await db
      .updateTable("User")
      .set({ isActive: false })
      .where("email", "=", FIXTURES.activo.email)
      .execute();
    const selectFrom = db.selectFrom.bind(db);
    vi.spyOn(db, "selectFrom").mockImplementation(((tabla: string) => {
      if (tabla === "Stage") throw new Error("regla rota");
      return selectFrom(tabla as never);
    }) as typeof db.selectFrom);

    const res = await request(app)
      .get(`/api/v1/stages/${stage}`)
      .set("Authorization", `Bearer ${t}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "User not active" });
  });
});
