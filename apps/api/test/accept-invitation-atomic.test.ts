import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// SPEC-201 — reproduce B-01 de la auditoría del backend (2026-09-11) y prueba
// que queda cerrado: `POST /investor/invitations/:id/accept` ya no puede
// sacarle la unidad a quien ya la compró, porque las 4 escrituras corren
// dentro de una sola `db.transaction()` con guardas atómicas.

const login = async (email: string, password: string) =>
  (await request(app).post("/api/v1/auth/login").send({ email, password })).body.token as string;

const crearUsuarioBuyer = async (email: string, password: string) => {
  const ahora = new Date();
  const id = createId();
  await db
    .insertInto("User")
    .values({
      id,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      fullName: "Comprador de prueba",
      role: "buyer",
      isActive: true,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
};

let proyecto: string;
let tokenDeveloper: string;

beforeAll(async () => {
  proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;

  tokenDeveloper = await login(FIXTURES.activo.email, FIXTURES.activo.password);
});

afterAll(async () => {
  await db.destroy();
});

async function crearUnidad(reference: string) {
  const ahora = new Date();
  const id = createId();
  await db
    .insertInto("Unit")
    .values({
      id,
      projectId: proyecto,
      unitReference: reference,
      status: "available",
      priceMinorUnits: 5_000_000,
      currency: "USD",
      investorId: null,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

async function emitirInvitacion(unitId: string, investorEmail: string) {
  return request(app)
    .post(`/api/v1/developer/projects/${proyecto}/invitations`)
    .set("Authorization", `Bearer ${tokenDeveloper}`)
    .send({ unitId, investorEmail, amountMinorUnits: 5_000_000, currency: "USD" });
}

describe("emitir una invitación (punto 3)", () => {
  it("una unidad `available` admite invitación — 201", async () => {
    const unidad = await crearUnidad(`SPEC201-A-${createId()}`);
    const res = await emitirInvitacion(unidad, "a@spec201.local");
    expect(res.status).toBe(201);
  });

  it("una unidad ya `reserved` (invitación pendiente en curso) no admite una segunda — 409 UNIT_NOT_AVAILABLE", async () => {
    const unidad = await crearUnidad(`SPEC201-B-${createId()}`);

    const primera = await emitirInvitacion(unidad, "b1@spec201.local");
    expect(primera.status).toBe(201);

    const segunda = await emitirInvitacion(unidad, "b2@spec201.local");
    expect(segunda.status).toBe(409);
    expect(segunda.body.code).toBe("UNIT_NOT_AVAILABLE");
  });

  it("una unidad `sold` no admite invitación — 409 UNIT_NOT_AVAILABLE", async () => {
    const unidad = await crearUnidad(`SPEC201-C-${createId()}`);
    await db.updateTable("Unit").set({ status: "sold" }).where("id", "=", unidad).execute();

    const res = await emitirInvitacion(unidad, "c@spec201.local");
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("UNIT_NOT_AVAILABLE");
  });
});

describe("aceptar una invitación (transacción atómica)", () => {
  it("invitación inexistente — 404", async () => {
    const email = "d@spec201.local";
    await crearUsuarioBuyer(email, "spec201pass");
    const token = await login(email, "spec201pass");

    const res = await request(app)
      .post(`/api/v1/investor/invitations/${createId()}/accept`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("invitación ya `declined` — 409 INVITATION_NOT_PENDING, sin escrituras", async () => {
    const email = "e@spec201.local";
    await crearUsuarioBuyer(email, "spec201pass");
    const token = await login(email, "spec201pass");

    const unidad = await crearUnidad(`SPEC201-E-${createId()}`);
    const emitida = await emitirInvitacion(unidad, email);
    expect(emitida.status).toBe(201);
    const invitacionId = emitida.body.id as string;

    await db
      .updateTable("Invitation")
      .set({ status: "declined", respondedAt: new Date() })
      .where("id", "=", invitacionId)
      .execute();

    const res = await request(app)
      .post(`/api/v1/investor/invitations/${invitacionId}/accept`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INVITATION_NOT_PENDING");

    const unidadDespues = await db
      .selectFrom("Unit")
      .select(["status", "investorId"])
      .where("id", "=", unidad)
      .executeTakeFirstOrThrow();
    expect(unidadDespues.status).toBe("reserved");
    expect(unidadDespues.investorId).toBeNull();
  });

  it("reintento del mismo accept ya exitoso — 409, no un segundo contrato", async () => {
    const email = "f@spec201.local";
    await crearUsuarioBuyer(email, "spec201pass");
    const token = await login(email, "spec201pass");

    const unidad = await crearUnidad(`SPEC201-F-${createId()}`);
    const emitida = await emitirInvitacion(unidad, email);
    const invitacionId = emitida.body.id as string;

    const primero = await request(app)
      .post(`/api/v1/investor/invitations/${invitacionId}/accept`)
      .set("Authorization", `Bearer ${token}`);
    expect(primero.status).toBe(201);

    const segundo = await request(app)
      .post(`/api/v1/investor/invitations/${invitacionId}/accept`)
      .set("Authorization", `Bearer ${token}`);
    expect(segundo.status).toBe(409);
    expect(segundo.body.code).toBe("INVITATION_NOT_PENDING");

    const contratos = await db
      .selectFrom("Contract")
      .selectAll()
      .where("unitId", "=", unidad)
      .execute();
    expect(contratos).toHaveLength(1);
  });

  it("dos `accept` concurrentes sobre la MISMA invitación — uno 201, otro 409; un solo contrato y una sola membresía", async () => {
    const email = "g@spec201.local";
    await crearUsuarioBuyer(email, "spec201pass");
    const token = await login(email, "spec201pass");

    const unidad = await crearUnidad(`SPEC201-G-${createId()}`);
    const emitida = await emitirInvitacion(unidad, email);
    const invitacionId = emitida.body.id as string;

    const acceptar = () =>
      request(app)
        .post(`/api/v1/investor/invitations/${invitacionId}/accept`)
        .set("Authorization", `Bearer ${token}`);

    const [a, b] = await Promise.all([acceptar(), acceptar()]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);

    const contratos = await db
      .selectFrom("Contract")
      .selectAll()
      .where("unitId", "=", unidad)
      .execute();
    expect(contratos).toHaveLength(1);

    const membresias = await db
      .selectFrom("ProjectMember")
      .selectAll()
      .where("projectId", "=", proyecto)
      .where("membershipRole", "=", "buyer")
      .where(
        "userId",
        "=",
        (
          await db
            .selectFrom("User")
            .select("id")
            .where("email", "=", email)
            .executeTakeFirstOrThrow()
        ).id
      )
      .execute();
    expect(membresias).toHaveLength(1);
  });

  it("una invitación `pending` sobre una unidad ya `sold` a otro investor — 409 UNIT_NOT_AVAILABLE, sin tocar nada", async () => {
    // Reproduce el escenario de B-01: dos invitaciones `pending` emitidas
    // sobre la misma unidad (posible antes del fix de la emisión), aceptadas
    // en orden. La segunda no puede sacarle la unidad al primero.
    const email1 = "h1@spec201.local";
    const email2 = "h2@spec201.local";
    await crearUsuarioBuyer(email1, "spec201pass");
    await crearUsuarioBuyer(email2, "spec201pass");
    const token1 = await login(email1, "spec201pass");
    const token2 = await login(email2, "spec201pass");

    const unidad = await crearUnidad(`SPEC201-H-${createId()}`);
    const inv1 = await emitirInvitacion(unidad, email1);
    const invitacion1Id = inv1.body.id as string;

    // Se planta a mano una segunda invitación `pending` sobre la MISMA
    // unidad — el estado que la auditoría reprodujo antes del fix de emisión.
    const ahora = new Date();
    const invitacion2Id = createId();
    await db
      .insertInto("Invitation")
      .values({
        id: invitacion2Id,
        projectId: proyecto,
        unitId: unidad,
        investorEmail: email2,
        amountMinorUnits: 5_000_000,
        currency: "USD",
        status: "pending",
        createdById: null,
        createdAt: ahora,
        respondedAt: null
      })
      .execute();

    const aceptar1 = await request(app)
      .post(`/api/v1/investor/invitations/${invitacion1Id}/accept`)
      .set("Authorization", `Bearer ${token1}`);
    expect(aceptar1.status).toBe(201);

    const aceptar2 = await request(app)
      .post(`/api/v1/investor/invitations/${invitacion2Id}/accept`)
      .set("Authorization", `Bearer ${token2}`);
    expect(aceptar2.status).toBe(409);
    expect(aceptar2.body.code).toBe("UNIT_NOT_AVAILABLE");

    const unidadFinal = await db
      .selectFrom("Unit")
      .select(["status", "investorId"])
      .where("id", "=", unidad)
      .executeTakeFirstOrThrow();
    const usuario1 = await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", email1)
      .executeTakeFirstOrThrow();
    expect(unidadFinal.status).toBe("sold");
    expect(unidadFinal.investorId).toBe(usuario1.id);

    // La segunda invitación, tras el 409, queda `pending` — la transacción
    // se revirtió entera, no solo a medias.
    const invitacion2Final = await db
      .selectFrom("Invitation")
      .select("status")
      .where("id", "=", invitacion2Id)
      .executeTakeFirstOrThrow();
    expect(invitacion2Final.status).toBe("pending");

    const contratos = await db
      .selectFrom("Contract")
      .selectAll()
      .where("unitId", "=", unidad)
      .execute();
    expect(contratos).toHaveLength(1);
  });
});
