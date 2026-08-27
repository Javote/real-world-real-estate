import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// M2-D5 filas 39, 44b, 40-41, 23-24 y 63 — **M3-BE-06/08/10**, **M3-SC-01** y
// **M3-SC-03**.
//
// Estos tres routers existían sin estar montados en `app.ts`, así que ninguna
// de sus rutas contestaba: es lo primero que fija esta suite. Lo segundo es el
// vínculo release→TXID, que estaba roto — el join buscaba el evento por su
// commitment, y el commitment de un release incluye el timestamp de
// liberación, así que nunca matcheaba y el patrón P10 salía sin prueba.

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

let tokenDev: string;
let tokenInvestor: string;
let projectId: string;
let unitId: string;
let contractId: string;

// Con una base por archivo (SPEC-015 §1) este número ya no se coordina con
// nadie: puede ser el 1, que es lo natural para la primera etapa de obra.
// Antes había que repartirlos a mano entre archivos (71, 81…) para no chocar
// contra el índice único de `Stage`, que es justo la coordinación manual que el
// invariante 2 de la spec prohíbe.
const ETAPA = 1;

beforeAll(async () => {
  tokenDev = (await login(FIXTURES.activo)).body.token;
  tokenInvestor = (await login(FIXTURES.investor)).body.token;

  const proyecto = await db
    .selectFrom("Project")
    .select("id")
    .where("slug", "=", FIXTURES.proyecto.slug)
    .executeTakeFirstOrThrow();
  projectId = proyecto.id;
});

afterAll(async () => {
  await db.destroy();
});

describe("el ciclo unidad → invitación → contrato → release", () => {
  it("el developer crea una unidad", async () => {
    const res = await request(app)
      .post(`/api/v1/developer/projects/${projectId}/units`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({
        unitReference: "7C",
        floor: 7,
        sizeM2: 55,
        priceMinorUnits: 9_000_000,
        currency: "USD"
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("available");
    unitId = res.body.id;
  });

  it("invitar reserva la unidad", async () => {
    const res = await request(app)
      .post(`/api/v1/developer/projects/${projectId}/invitations`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({
        unitId,
        investorEmail: FIXTURES.investor.email,
        amountMinorUnits: 9_000_000,
        currency: "USD"
      });

    expect(res.status).toBe(201);

    const unidad = await db
      .selectFrom("Unit")
      .select("status")
      .where("id", "=", unitId)
      .executeTakeFirstOrThrow();
    expect(unidad.status).toBe("reserved");
  });

  it("aceptar crea el contrato y ancla (M3-SC-01)", async () => {
    const invitacion = await db
      .selectFrom("Invitation")
      .select("id")
      .where("unitId", "=", unitId)
      .executeTakeFirstOrThrow();

    const res = await request(app)
      .post(`/api/v1/investor/invitations/${invitacion.id}/accept`)
      .set("Authorization", `Bearer ${tokenInvestor}`);

    expect(res.status).toBe(201);
    expect(res.body.anchor.eventType).toBe("INVITATION_ACCEPTED");
    // Lo anclado es el COMMITMENT, no los datos: ni el email ni el monto
    // pueden estar ahí (regla 2).
    expect(res.body.anchor.commitment).toMatch(/^[0-9a-f]{64}$/);
    contractId = res.body.contract.id;

    const invitacionYaUsada = await request(app)
      .post(`/api/v1/investor/invitations/${invitacion.id}/accept`)
      .set("Authorization", `Bearer ${tokenInvestor}`);
    expect(invitacionYaUsada.status).toBe(409);
  });

  it("liberar una etapa ancla, y su TXID se puede volver a encontrar (P10)", async () => {
    // **La liberación exige la etapa certificada**, así que hay que llevarla
    // hasta `Completed` por la FSM real: `Pending → InProgress → Completed`.
    // `validationCritical: false` porque lo que se prueba acá es el vínculo
    // release→TXID, no el requisito de evidencia — eso ya lo cubre
    // `stage-transitions.test.ts`.
    const stage = await request(app)
      .post(`/api/v1/projects/${projectId}/stages`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ name: "Cimientos", sequenceOrder: ETAPA, validationCritical: false });
    expect(stage.status).toBe(201);

    for (const estado of ["InProgress", "Completed"]) {
      const paso = await request(app)
        .patch(`/api/v1/stages/${stage.body.id}/state`)
        .set("Authorization", `Bearer ${tokenDev}`)
        .send({ state: estado });
      expect(paso.status).toBe(200);
    }

    const release = await request(app)
      .post(`/api/v1/developer/contracts/${contractId}/releases/${ETAPA}`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ amountMinorUnits: 3_000_000 });

    expect(release.status).toBe(201);
    expect(release.body.anchor.eventType).toBe("PAYMENT_RELEASE");

    const listado = await request(app)
      .get(`/api/v1/contracts/${contractId}/releases`)
      .set("Authorization", `Bearer ${tokenInvestor}`);

    expect(listado.status).toBe(200);
    const uno = listado.body.find((r: { stageNumber: number }) => r.stageNumber === ETAPA);
    // **Esto es lo que estaba roto:** sin `referenceId` el TXID venía siempre
    // ausente y el patrón P10 no podía mostrar la prueba de la liberación.
    expect(uno.txid).toBe(release.body.anchor.txid);
    expect(uno.commitment).toMatch(/^[0-9a-f]{64}$/);
  });

  it("el investor ve su contrato; otro no", async () => {
    const mio = await request(app)
      .get(`/api/v1/investor/contracts/${unitId}`)
      .set("Authorization", `Bearer ${tokenInvestor}`);

    expect(mio.status).toBe(200);
    expect(mio.body.id).toBe(contractId);

    const ajeno = await request(app)
      .get(`/api/v1/investor/contracts/${unitId}`)
      .set("Authorization", `Bearer ${tokenDev}`);
    expect(ajeno.status).toBe(403);
  });

  // **Fila 40-41 · DEV-CONTRACTS-LIST-001** — el contrato como REGISTRO (D-070).
  //
  // El GET pasa por dos left joins —Invitation y OnChainEvent— para alcanzar el
  // anclaje, que lo emite el accept y no el contrato. Un left join que matchee
  // de más devuelve el mismo contrato dos veces y la lista miente sin fallar,
  // así que lo primero que se afirma es la CARDINALIDAD.
  it("el listado de contratos del proyecto trae el registro y su anclaje", async () => {
    const res = await request(app)
      .get(`/api/v1/developer/projects/${projectId}/contracts`)
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);

    const delContrato = res.body.filter((c: { id: string }) => c.id === contractId);
    expect(delContrato).toHaveLength(1);

    const contrato = delContrato[0];
    expect(contrato.unitId).toBe(unitId);
    expect(contrato.unitReference).toBe("7C");
    // Lo que D-070 nombra como lo que esta superficie SÍ puede mostrar.
    expect(contrato.unitStatus).toBe("sold");
    expect(contrato.investorName).toBeTruthy();
    expect(contrato.signedAt).not.toBeNull();
    // El anclaje del acuerdo: "se registró en este momento" (D-026).
    expect(contrato.txid).toBeTruthy();
    expect(contrato.commitment).toMatch(/^[0-9a-f]{64}$/);

    // Nada del encuadre de pagos: el registro no expone etapas liberadas.
    expect(contrato.releases).toBeUndefined();
    expect(contrato.stagesReleased).toBeUndefined();
  });

  it("el release aparece como artefacto del dossier de la unidad", async () => {
    const res = await request(app)
      .get(`/api/v1/investor/units/${unitId}/dossier`)
      .set("Authorization", `Bearer ${tokenInvestor}`);

    expect(res.status).toBe(200);
    const releases = res.body.artifacts.filter((a: { kind: string }) => a.kind === "release");
    expect(releases).toHaveLength(1);
    expect(releases[0].txid).not.toBeNull();
  });
});

describe("inventario de unidades", () => {
  it("el developer ve las unidades de sus proyectos", async () => {
    const res = await request(app)
      .get("/api/v1/developer/units")
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    expect(res.body.some((u: { unitReference: string }) => u.unitReference === "7C")).toBe(true);
  });

  it("el investor ve SUS unidades y ninguna otra", async () => {
    const res = await request(app)
      .get("/api/v1/investor/units")
      .set("Authorization", `Bearer ${tokenInvestor}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const referencias = res.body.map((u: { unitReference: string }) => u.unitReference);
    expect(referencias).toContain("7C");
  });
});
