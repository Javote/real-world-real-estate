import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

  // SPEC-018 A1 — el `catch` de la transacción relanza lo que no es
  // `ReleaseExceedsContractError`. Sin este test, un `catch` que se tragara
  // cualquier error y devolviera un 409 seguiría pasando toda la suite.
  it("un error ajeno al tope dentro de la transacción no se disfraza de 409: es 500", async () => {
    const sequenceOrder = 900_801;
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

    const espia = vi.spyOn(db, "transaction").mockReturnValueOnce({
      execute: () => Promise.reject(new Error("la base se cayó a mitad de la transacción"))
    } as unknown as ReturnType<typeof db.transaction>);

    try {
      const res = await request(app)
        .post(`/api/v1/developer/contracts/${contractId}/releases/${sequenceOrder}`)
        .set("Authorization", `Bearer ${tokenDev}`)
        .send({ amountMinorUnits: 1_000_000 });

      expect(res.status).toBe(500);
      expect(res.body.code).not.toBe("RELEASE_EXCEEDS_CONTRACT");
    } finally {
      espia.mockRestore();
    }

    const liberaciones = await db
      .selectFrom("PaymentAttestation")
      .select("id")
      .where("contractId", "=", contractId)
      .execute();
    expect(liberaciones).toHaveLength(0);
  });
});

describe("GET /developer/projects/:id/contracts", () => {
  it("un proyecto sin contratos devuelve la lista vacía, sin buscar anclajes", async () => {
    const id = createId();
    const ahora = new Date();
    await db
      .insertInto("Project")
      .values({
        id,
        name: "Sin contratos",
        slug: `sin-contratos-${id}`,
        totalUnits: 0,
        status: "planning",
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();

    const res = await request(app)
      .get(`/api/v1/developer/projects/${id}/contracts`)
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // El desempate de anclajes (`contractsOfProjectProcedure`, el `reduce` sobre
  // `candidatos`). Por la API hoy una unidad tiene como mucho UNA invitación
  // aceptada: `Contract_unitId_key` admite un contrato por unidad y el accept
  // es atómico (SPEC-201), así que una segunda aceptación se rechaza entera.
  // Pero el esquema no lo impide —ni la unicidad de invitaciones aceptadas ni
  // `respondedAt`/`signedAt` no nulos—, y antes de SPEC-201 un accept que
  // chocaba en el `INSERT Contract` dejaba la invitación `accepted` igual.
  // Esas filas heredadas se arman a mano: son las que el desempate existe
  // para no confundir con la venta real.
  const COMMITMENT_HEREDADO = "b".repeat(64);

  async function venderUnidad(unitReference: string) {
    return aceptarVentaDe(await crearUnidad(unitReference));
  }

  async function aceptarVentaDe(unitId: string) {
    const tokenInvestor = (await login(FIXTURES.investor)).body.token;
    const invitacion = await request(app)
      .post(`/api/v1/developer/projects/${proyecto}/invitations`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({
        unitId,
        investorEmail: FIXTURES.investor.email,
        amountMinorUnits: 3_000_000,
        currency: "USD"
      });

    const aceptada = await request(app)
      .post(`/api/v1/investor/invitations/${invitacion.body.id}/accept`)
      .set("Authorization", `Bearer ${tokenInvestor}`);
    expect(aceptada.status).toBe(201);

    return {
      unitId,
      contractId: aceptada.body.contract.id as string,
      commitment: aceptada.body.anchor.commitment as string
    };
  }

  async function crearUnidad(unitReference: string) {
    const unidad = await request(app)
      .post(`/api/v1/developer/projects/${proyecto}/units`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ unitReference, priceMinorUnits: 3_000_000, currency: "USD" });
    return unidad.body.id as string;
  }

  /** Una invitación `accepted` con su evento, como las dejaba el accept pre-SPEC-201. */
  async function aceptacionHeredada(unitId: string, respondedAt: Date | null) {
    const invitacionId = createId();
    const ahora = new Date();
    await db
      .insertInto("Invitation")
      .values({
        id: invitacionId,
        projectId: proyecto,
        unitId,
        investorEmail: FIXTURES.investor.email,
        amountMinorUnits: 3_000_000,
        currency: "USD",
        status: "accepted",
        createdById: null,
        createdAt: ahora,
        respondedAt
      })
      .execute();
    await db
      .insertInto("OnChainEvent")
      .values({
        id: createId(),
        projectId: proyecto,
        stageId: null,
        evidenceId: null,
        referenceId: invitacionId,
        eventIndex: 0,
        eventType: "INVITATION_ACCEPTED",
        fromState: null,
        toState: null,
        commitment: COMMITMENT_HEREDADO,
        status: "Pending",
        txid: null,
        network: null,
        outputRef: null,
        blockTimestamp: null,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();
  }

  async function contratoDe(unitId: string) {
    const res = await request(app)
      .get(`/api/v1/developer/projects/${proyecto}/contracts`)
      .set("Authorization", `Bearer ${tokenDev}`);
    expect(res.status).toBe(200);
    const deLaUnidad = res.body.filter((c: { unitId: string }) => c.unitId === unitId);
    expect(deLaUnidad).toHaveLength(1);
    return deLaUnidad[0] as { commitment: string | null };
  }

  it("una aceptación heredada ANTERIOR a la venta no le roba el anclaje al contrato", async () => {
    const unitId = await crearUnidad("DS1");
    await aceptacionHeredada(unitId, new Date(Date.now() - 86_400_000));
    const venta = await aceptarVentaDe(unitId);

    const contrato = await contratoDe(unitId);
    expect(contrato.commitment).toBe(venta.commitment);
    expect(contrato.commitment).not.toBe(COMMITMENT_HEREDADO);
  });

  it("una aceptación heredada POSTERIOR y sin respondedAt tampoco: queda a distancia infinita", async () => {
    const venta = await venderUnidad("DS2");
    await aceptacionHeredada(venta.unitId, null);

    const contrato = await contratoDe(venta.unitId);
    expect(contrato.commitment).toBe(venta.commitment);
  });

  it("un contrato sin signedAt no tiene contra qué medir: se queda con un anclaje, no con ninguno", async () => {
    const venta = await venderUnidad("DS3");
    await aceptacionHeredada(venta.unitId, new Date());
    await db
      .updateTable("Contract")
      .set({ signedAt: null })
      .where("id", "=", venta.contractId)
      .execute();

    const contrato = await contratoDe(venta.unitId);
    expect([venta.commitment, COMMITMENT_HEREDADO]).toContain(contrato.commitment);
  });
});

describe("POST /investor/invitations/:id/accept — una unidad que ya tiene contrato", () => {
  // Vender, devolver la unidad a `available` con el PATCH del developer y
  // re-invitar: la unidad parece libre, pero `Contract_unitId_key` admite un
  // solo contrato. Antes de SPEC-018 este accept chocaba en el INSERT y
  // salía como un 500 no clasificado.
  it("aceptar la re-invitación da 409 UNIT_NOT_AVAILABLE y no toca nada", async () => {
    const tokenInvestor = (await login(FIXTURES.investor)).body.token;
    const unidad = await request(app)
      .post(`/api/v1/developer/projects/${proyecto}/units`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ unitReference: "RV1", priceMinorUnits: 3_000_000, currency: "USD" });

    const invitar = () =>
      request(app)
        .post(`/api/v1/developer/projects/${proyecto}/invitations`)
        .set("Authorization", `Bearer ${tokenDev}`)
        .send({
          unitId: unidad.body.id,
          investorEmail: FIXTURES.investor.email,
          amountMinorUnits: 3_000_000,
          currency: "USD"
        });

    const primera = await invitar();
    const vendida = await request(app)
      .post(`/api/v1/investor/invitations/${primera.body.id}/accept`)
      .set("Authorization", `Bearer ${tokenInvestor}`);
    expect(vendida.status).toBe(201);

    const reabierta = await request(app)
      .patch(`/api/v1/developer/units/${unidad.body.id}`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ status: "available" });
    expect(reabierta.status).toBe(200);

    const segunda = await invitar();
    expect(segunda.status).toBe(201);

    const res = await request(app)
      .post(`/api/v1/investor/invitations/${segunda.body.id}/accept`)
      .set("Authorization", `Bearer ${tokenInvestor}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("UNIT_NOT_AVAILABLE");

    // Rechazada entera (SPEC-201): la invitación sigue `pending` y la unidad
    // no volvió a `sold`.
    const invitacion = await db
      .selectFrom("Invitation")
      .select("status")
      .where("id", "=", segunda.body.id)
      .executeTakeFirstOrThrow();
    expect(invitacion.status).toBe("pending");
    const fila = await db
      .selectFrom("Unit")
      .select("status")
      .where("id", "=", unidad.body.id)
      .executeTakeFirstOrThrow();
    expect(fila.status).not.toBe("sold");
  });
});
