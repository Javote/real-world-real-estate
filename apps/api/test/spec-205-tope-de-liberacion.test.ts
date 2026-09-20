import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";
import { crearStageMinteado } from "./helpers/stages";

// SPEC-205 (B-07) — nada comparaba la suma de `PaymentAttestation` contra
// `Contract.totalMinorUnits`. Un release que superaba lo contratado entraba,
// se registraba y se anclaba su commitment en Cardano: un registro que
// admite una afirmación falsa, y encima probada on-chain.

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

let tokenDev: string;
let tokenInvestor: string;
let tokenAdmin: string;
let projectId: string;
let actorId: string;

beforeAll(async () => {
  tokenDev = (await login(FIXTURES.activo)).body.token;
  tokenInvestor = (await login(FIXTURES.investor)).body.token;
  tokenAdmin = (await login(FIXTURES.admin)).body.token;

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

afterAll(async () => {
  await db.destroy();
});

/** Un contrato nuevo de `totalMinorUnits` dado, con dos etapas certificadas listas para liberar. */
async function contratoConDosEtapas(totalMinorUnits: number, sequenceOrderBase: number) {
  const unidad = await request(app)
    .post(`/api/v1/developer/projects/${projectId}/units`)
    .set("Authorization", `Bearer ${tokenDev}`)
    .send({
      unitReference: `T${sequenceOrderBase}`,
      priceMinorUnits: totalMinorUnits,
      currency: "USD"
    });

  await request(app)
    .post(`/api/v1/developer/projects/${projectId}/invitations`)
    .set("Authorization", `Bearer ${tokenDev}`)
    .send({
      unitId: unidad.body.id,
      investorEmail: FIXTURES.investor.email,
      amountMinorUnits: totalMinorUnits,
      currency: "USD"
    });

  const invitacionRow = await db
    .selectFrom("Invitation")
    .select("id")
    .where("unitId", "=", unidad.body.id)
    .executeTakeFirstOrThrow();

  const aceptada = await request(app)
    .post(`/api/v1/investor/invitations/${invitacionRow.id}/accept`)
    .set("Authorization", `Bearer ${tokenInvestor}`);

  const contractId: string = aceptada.body.contract.id;

  const stages = [];
  for (const offset of [0, 1]) {
    const stage = await crearStageMinteado({
      projectId,
      name: `Etapa ${sequenceOrderBase + offset}`,
      sequenceOrder: sequenceOrderBase + offset,
      validationCritical: false,
      actorUserId: actorId
    });
    for (const [estado, actor] of [
      ["InProgress", tokenDev],
      ["Completed", tokenAdmin]
    ] as const) {
      await request(app)
        .patch(`/api/v1/stages/${stage.id}/state`)
        .set("Authorization", `Bearer ${actor}`)
        .send({ state: estado });
    }
    stages.push(stage);
  }

  return { contractId, stages };
}

describe("POST /developer/contracts/:id/releases/:stageNum — el tope del total del contrato", () => {
  it("un release que iguala exacto el total restante entra (el techo es >, no >=)", async () => {
    const { contractId } = await contratoConDosEtapas(1_000_000, 900_001);

    const release = await request(app)
      .post(`/api/v1/developer/contracts/${contractId}/releases/${900_001}`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ amountMinorUnits: 1_000_000 });

    expect(release.status).toBe(201);
  });

  it("un release que supera el total por 1 unidad mínima: 409, sin release registrado", async () => {
    const { contractId } = await contratoConDosEtapas(1_000_000, 900_101);

    const release = await request(app)
      .post(`/api/v1/developer/contracts/${contractId}/releases/${900_101}`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ amountMinorUnits: 1_000_001 });

    expect(release.status).toBe(409);
    expect(release.body.code).toBe("RELEASE_EXCEEDS_CONTRACT");

    const filas = await db
      .selectFrom("PaymentAttestation")
      .select(["id"])
      .where("contractId", "=", contractId)
      .execute();
    expect(filas).toHaveLength(0);
  });

  it("dos releases sobre etapas distintas que juntos superan el total: uno entra, el otro no", async () => {
    const { contractId } = await contratoConDosEtapas(1_000_000, 900_201);

    const primero = await request(app)
      .post(`/api/v1/developer/contracts/${contractId}/releases/${900_201}`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ amountMinorUnits: 600_000 });
    expect(primero.status).toBe(201);

    const segundo = await request(app)
      .post(`/api/v1/developer/contracts/${contractId}/releases/${900_202}`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ amountMinorUnits: 500_000 });
    expect(segundo.status).toBe(409);
    expect(segundo.body.code).toBe("RELEASE_EXCEEDS_CONTRACT");
  });

  it("dos releases CONCURRENTES sobre etapas distintas que juntos superan el total: a lo sumo uno entra", async () => {
    const { contractId } = await contratoConDosEtapas(1_000_000, 900_301);

    const [a, b] = await Promise.all([
      request(app)
        .post(`/api/v1/developer/contracts/${contractId}/releases/${900_301}`)
        .set("Authorization", `Bearer ${tokenDev}`)
        .send({ amountMinorUnits: 700_000 }),
      request(app)
        .post(`/api/v1/developer/contracts/${contractId}/releases/${900_302}`)
        .set("Authorization", `Bearer ${tokenDev}`)
        .send({ amountMinorUnits: 700_000 })
    ]);

    const estados = [a.status, b.status].sort();
    expect(estados).toEqual([201, 409]);

    const suma = await db
      .selectFrom("PaymentAttestation")
      .select((eb) => eb.fn.sum<number>("amountMinorUnits").as("total"))
      .where("contractId", "=", contractId)
      .executeTakeFirst();
    expect(Number(suma?.total ?? 0)).toBeLessThanOrEqual(1_000_000);
  });

  it("contrato sin releases previos: el techo es el total entero", async () => {
    const { contractId } = await contratoConDosEtapas(500_000, 900_401);

    const release = await request(app)
      .post(`/api/v1/developer/contracts/${contractId}/releases/${900_401}`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ amountMinorUnits: 500_000 });

    expect(release.status).toBe(201);
  });
});
