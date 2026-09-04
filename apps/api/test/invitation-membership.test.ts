import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// M2-D1 §4 le da al investor lectura sobre Construction stage, Evidence bundle y
// Contract del proyecto de SU unidad, y el flujo de onboarding (§Onboarding flow,
// paso 6) dice que después de aceptar la unidad aparece en su portfolio "with
// progress timeline visible". En este código esa lectura se implementa con
// membresía por proyecto (`ANY_MEMBERSHIP` incluye `buyer`), y el seed la planta
// a mano — pero el flujo real de aceptación no la creaba.

const NUEVO = { email: "recien-llegado@test.local", password: "recienllegado123" };

let proyecto: string;
let invitacion: string;
let usuario: string;

const token = async () =>
  (await request(app).post("/api/v1/auth/login").send(NUEVO)).body.token as string;

beforeAll(async () => {
  const ahora = new Date();
  proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;

  usuario = createId();
  await db
    .insertInto("User")
    .values({
      id: usuario,
      email: NUEVO.email,
      passwordHash: await bcrypt.hash(NUEVO.password, 10),
      fullName: "Recién Llegado",
      role: "buyer",
      isActive: true,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();

  const unidad = createId();
  await db
    .insertInto("Unit")
    .values({
      id: unidad,
      projectId: proyecto,
      unitReference: "NEW-1",
      status: "available",
      priceMinorUnits: 7_000_000,
      currency: "USD",
      investorId: null,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();

  invitacion = createId();
  await db
    .insertInto("Invitation")
    .values({
      id: invitacion,
      projectId: proyecto,
      unitId: unidad,
      investorEmail: NUEVO.email,
      amountMinorUnits: 7_000_000,
      currency: "USD",
      status: "pending",
      createdAt: ahora
    })
    .execute();
});

afterAll(async () => {
  await db.destroy();
});

describe("aceptar una invitación deja al investor con acceso al proyecto", () => {
  it("antes de aceptar no ve los stages del proyecto", async () => {
    // El control: sin este caso, el de abajo pasaría igual si la ruta no
    // autorizara nada.
    const res = await request(app)
      .get(`/api/v1/projects/${proyecto}/stages`)
      .set("Authorization", `Bearer ${await token()}`);

    expect(res.status).toBe(403);
  });

  it("aceptar crea su membresía `buyer` en el proyecto", async () => {
    const aceptar = await request(app)
      .post(`/api/v1/investor/invitations/${invitacion}/accept`)
      .set("Authorization", `Bearer ${await token()}`);

    expect(aceptar.status).toBe(201);

    const membresia = await db
      .selectFrom("ProjectMember")
      .selectAll()
      .where("userId", "=", usuario)
      .where("projectId", "=", proyecto)
      .executeTakeFirst();

    expect(membresia?.membershipRole).toBe("buyer");
  });

  it("y con eso ya puede leer los stages de su proyecto", async () => {
    // Es el paso 6 del flujo de onboarding de M2-D1: "Unit now appears in
    // investor's portfolio with progress timeline visible". Sin la membresía,
    // toda ruta con `requireProjectAccess` —incluidas las del Merkle proof de su
    // propia evidencia— le contestaba 403.
    const res = await request(app)
      .get(`/api/v1/projects/${proyecto}/stages`)
      .set("Authorization", `Bearer ${await token()}`);

    expect(res.status).toBe(200);
  });
});
