import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";
import { crearStageMinteado } from "./helpers/stages";

// SPEC-017 §paso 4 — ramas de `developer-comercial.routes.ts` sin ningún
// test: el listado de unidades de un proyecto (nunca se llamó por HTTP), la
// edición de unidad, el inventario cross-proyecto vacío (un developer sin
// ningún proyecto), el rechazo de invitar sobre una unidad de OTRO proyecto,
// y tres ramas de la liberación que `spec-205-tope-de-liberacion.test.ts` no
// toca: etapa inexistente, etapa sin certificar, y la idempotencia (repetir
// la misma liberación da 200, no un segundo anclaje).

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

let tokenDev: string;
let tokenAdmin: string;
let proyecto: string;
let otroProyecto: string;
let actorId: string;

beforeAll(async () => {
  tokenDev = (await login(FIXTURES.activo)).body.token;
  tokenAdmin = (await login(FIXTURES.admin)).body.token;

  proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
  otroProyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.otroProyecto.slug)
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

afterAll(async () => {
  await db.destroy();
});

describe("GET /developer/projects/:id/units", () => {
  it("lista las unidades del proyecto, ordenadas por referencia", async () => {
    await request(app)
      .post(`/api/v1/developer/projects/${proyecto}/units`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ unitReference: "9Z" });

    const res = await request(app)
      .get(`/api/v1/developer/projects/${proyecto}/units`)
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    expect(res.body.some((u: { unitReference: string }) => u.unitReference === "9Z")).toBe(true);
  });
});

describe("PATCH /developer/units/:id", () => {
  it("edita la unidad y lo escribe en el audit log", async () => {
    const creada = await request(app)
      .post(`/api/v1/developer/projects/${proyecto}/units`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ unitReference: "9Y", priceMinorUnits: 1_000_000, currency: "USD" });

    const res = await request(app)
      .patch(`/api/v1/developer/units/${creada.body.id}`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ priceMinorUnits: 2_000_000 });

    expect(res.status).toBe(200);
    expect(res.body.priceMinorUnits).toBe(2_000_000);

    const auditoria = await db
      .selectFrom("AuditLog")
      .select(["action"])
      .where("entityId", "=", creada.body.id)
      .where("action", "=", "UPDATE_UNIT")
      .executeTakeFirst();
    expect(auditoria).toBeDefined();
  });
});

describe("GET /developer/units — inventario cross-proyecto", () => {
  it("un developer sin ningún proyecto ve la lista vacía, no un error", async () => {
    const email = `dev-sin-proyecto-${createId()}@test.local`;
    await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ email, password: "sinproyecto123", role: "developer", fullName: "Sin Proyecto" });

    const tokenNuevo = (await login({ email, password: "sinproyecto123" })).body.token;

    const res = await request(app)
      .get("/api/v1/developer/units")
      .set("Authorization", `Bearer ${tokenNuevo}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("POST /developer/projects/:id/invitations", () => {
  it("invitar sobre una unidad de OTRO proyecto es 400, no un 404 silencioso", async () => {
    const unidadDeOtroProyecto = await request(app)
      .post(`/api/v1/developer/projects/${otroProyecto}/units`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ unitReference: "X1" });

    const res = await request(app)
      .post(`/api/v1/developer/projects/${proyecto}/invitations`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({
        unitId: unidadDeOtroProyecto.body.id,
        investorEmail: FIXTURES.investor.email,
        amountMinorUnits: 1_000_000,
        currency: "USD"
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Unit does not belong to project");
  });
});

describe("POST /developer/contracts/:id/releases/:stageNum — ramas sin cubrir", () => {
  async function crearContratoConEtapa(sequenceOrder: number) {
    const unidad = await request(app)
      .post(`/api/v1/developer/projects/${proyecto}/units`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ unitReference: `R${sequenceOrder}`, priceMinorUnits: 5_000_000, currency: "USD" });

    const invitacion = await request(app)
      .post(`/api/v1/developer/projects/${proyecto}/invitations`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({
        unitId: unidad.body.id,
        investorEmail: FIXTURES.investor.email,
        amountMinorUnits: 5_000_000,
        currency: "USD"
      });

    const tokenInvestor = (await login(FIXTURES.investor)).body.token;
    const aceptada = await request(app)
      .post(`/api/v1/investor/invitations/${invitacion.body.id}/accept`)
      .set("Authorization", `Bearer ${tokenInvestor}`);

    const stage = await crearStageMinteado({
      projectId: proyecto,
      name: `Etapa release ${sequenceOrder}`,
      sequenceOrder,
      validationCritical: false,
      actorUserId: actorId
    });

    return { contractId: aceptada.body.contract.id as string, stageId: stage.id as string };
  }

  it("liberar contra un número de etapa que no existe da 404", async () => {
    const { contractId } = await crearContratoConEtapa(900_501);

    const res = await request(app)
      .post(`/api/v1/developer/contracts/${contractId}/releases/900502`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ amountMinorUnits: 1_000_000 });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Stage not found");
  });

  it("liberar una etapa que no está Completed da 409 STAGE_NOT_CERTIFIED", async () => {
    const { contractId } = await crearContratoConEtapa(900_601);

    const res = await request(app)
      .post(`/api/v1/developer/contracts/${contractId}/releases/900601`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ amountMinorUnits: 1_000_000 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("STAGE_NOT_CERTIFIED");
  });

  it("liberar dos veces la misma etapa es idempotente: la segunda da 200, sin anclar de nuevo", async () => {
    const sequenceOrder = 900_701;
    const { contractId, stageId } = await crearContratoConEtapa(sequenceOrder);

    for (const [estado, actor] of [
      ["InProgress", tokenDev],
      ["Completed", tokenAdmin]
    ] as const) {
      await request(app)
        .patch(`/api/v1/stages/${stageId}/state`)
        .set("Authorization", `Bearer ${actor}`)
        .send({ state: estado });
    }

    const primera = await request(app)
      .post(`/api/v1/developer/contracts/${contractId}/releases/${sequenceOrder}`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ amountMinorUnits: 1_000_000 });
    expect(primera.status).toBe(201);

    const segunda = await request(app)
      .post(`/api/v1/developer/contracts/${contractId}/releases/${sequenceOrder}`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ amountMinorUnits: 1_000_000 });
    expect(segunda.status).toBe(200);
    expect(segunda.body.id).toBe(primera.body.id);

    const eventos = await db
      .selectFrom("OnChainEvent")
      .select(["id"])
      .where("referenceId", "=", primera.body.id)
      .where("eventType", "=", "PAYMENT_RELEASE")
      .execute();
    // Un solo anclaje, no dos: el segundo `POST` no volvió a llamar a
    // `anchorCommitmentEvent`.
    expect(eventos).toHaveLength(1);
  });
});
