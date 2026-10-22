import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { createId } from "../src/db/id.js";
import * as dominio from "../src/domain/stage-transition.js";
import { db } from "../src/lib/db.js";
import { FIXTURES } from "./global-setup.js";
import { crearStageMinteado } from "./helpers/stages.js";

// El guard carga el stage antes del handler; si entre los dos alguien lo borra, el dominio contesta
// STAGE_NOT_FOUND. Por HTTP no hay forma de meterse en ese hueco: el dominio lo simula.
const NO_ESTA = { ok: false, status: 404, code: "STAGE_NOT_FOUND" } as const;

let tokenAdmin: string;
let proyecto: string;
let stageId: string;

beforeAll(async () => {
  tokenAdmin = (
    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: FIXTURES.admin.email, password: FIXTURES.admin.password })
  ).body.token;
  proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
  const admin = await db
    .selectFrom("User")
    .select("id")
    .where("email", "=", FIXTURES.admin.email)
    .executeTakeFirstOrThrow();
  stageId = (
    await crearStageMinteado({
      projectId: proyecto,
      name: "Stage que desaparece",
      sequenceOrder: 9_301,
      actorUserId: admin.id
    })
  ).id;
});

afterEach(() => vi.restoreAllMocks());

describe("un stage que desaparece entre el guard y el dominio es 404", () => {
  it("PATCH /stages/:id/state", async () => {
    vi.spyOn(dominio, "transitionStage").mockResolvedValueOnce(NO_ESTA);

    const res = await request(app)
      .patch(`/api/v1/stages/${stageId}/state`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ state: "InProgress" });

    expect(res.status).toBe(404);
  });

  it.each([
    ["certify", {}],
    ["observe", { note: "Falta el acta" }]
  ])("POST /certifier/stages/:id/%s", async (accion, cuerpo) => {
    vi.spyOn(dominio, "transitionStage").mockResolvedValueOnce(NO_ESTA);

    const res = await request(app)
      .post(`/api/v1/certifier/stages/${stageId}/${accion}`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send(cuerpo);

    expect(res.status).toBe(404);
  });

  it("POST /projects/:id/stages/:stageId/retry-anchor", async () => {
    vi.spyOn(dominio, "retryStageMint").mockResolvedValueOnce(NO_ESTA);

    const res = await request(app)
      .post(`/api/v1/projects/${proyecto}/stages/${stageId}/retry-anchor`)
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(404);
  });
});

describe("un recurso que desaparece entre el chequeo y el insert es 404", () => {
  it("POST /projects/:id/certifier-invitations, si el certifier se borra antes del insert", async () => {
    const certifierId = createId();
    const ahora = new Date();
    await db
      .insertInto("User")
      .values({
        id: certifierId,
        email: `certifier-${certifierId}@test.local`,
        passwordHash: "x",
        fullName: "Certifier que se va",
        role: "verifier",
        isActive: true,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();
    const fk = Object.assign(new Error("FOREIGN KEY constraint failed"), {
      code: "SQLITE_CONSTRAINT_FOREIGNKEY"
    });
    vi.spyOn(db, "insertInto").mockImplementationOnce((() => ({
      values: () => ({ execute: () => Promise.reject(fk) })
    })) as never);

    const res = await request(app)
      .post(`/api/v1/projects/${proyecto}/certifier-invitations`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ certifierId });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Project or user not found");
  });
});

describe("un usuario que desaparece entre el guard y el handler", () => {
  it("GET /auth/me es 401, no 500", async () => {
    const leer = db.selectFrom.bind(db);
    // La primera lectura es la del guard; la segunda, la del handler, ya no lo encuentra.
    vi.spyOn(db, "selectFrom")
      .mockImplementationOnce(((tabla: "User") => leer(tabla)) as never)
      .mockImplementationOnce((() => ({
        select: () => ({ where: () => ({ executeTakeFirst: async () => undefined }) })
      })) as never);

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("User not active");
  });
});
