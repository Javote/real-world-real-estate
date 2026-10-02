import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";
import { crearStageMinteado } from "./helpers/stages";

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

let tokenDev: string;
let tokenInvestor: string;
let tokenAdmin: string;
let projectId: string;
let unitId: string;
let contractId: string;
let actorId: string;

const ETAPA = 1;

beforeAll(async () => {
  tokenDev = (await login(FIXTURES.activo)).body.token;
  tokenInvestor = (await login(FIXTURES.investor)).body.token;
  tokenAdmin = (await login(FIXTURES.admin)).body.token;

  const proyecto = await db
    .selectFrom("Project")
    .select("id")
    .where("slug", "=", FIXTURES.proyecto.slug)
    .executeTakeFirstOrThrow();
  projectId = proyecto.id;
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

    const novedades = await request(app)
      .get("/api/v1/investor/notifications")
      .set("Authorization", `Bearer ${tokenInvestor}`);
    expect(novedades.status).toBe(200);
    const aviso = novedades.body.find(
      (n: { params: { invitationId?: string } }) => n.params.invitationId === res.body.id
    );
    expect(aviso).toMatchObject({
      category: "stage",
      titleKey: "notifications.invitation.received",
      params: { invitationId: res.body.id },
      unitId: null,
      readAt: null
    });
  });

  it("invitar a un email sin cuenta no deja notificación: no hay a quién avisar", async () => {
    const otraUnidad = await request(app)
      .post(`/api/v1/developer/projects/${projectId}/units`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({
        unitReference: "7D",
        floor: 7,
        sizeM2: 60,
        priceMinorUnits: 9_500_000,
        currency: "USD"
      });
    expect(otraUnidad.status).toBe(201);

    const antes = await db
      .selectFrom("Notification")
      .select((eb) => eb.fn.countAll<number>().as("total"))
      .executeTakeFirstOrThrow();

    const res = await request(app)
      .post(`/api/v1/developer/projects/${projectId}/invitations`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({
        unitId: otraUnidad.body.id,
        investorEmail: "sin-cuenta@example.com",
        amountMinorUnits: 9_500_000,
        currency: "USD"
      });
    expect(res.status).toBe(201);

    const despues = await db
      .selectFrom("Notification")
      .select((eb) => eb.fn.countAll<number>().as("total"))
      .executeTakeFirstOrThrow();
    expect(Number(despues.total)).toBe(Number(antes.total));
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
    expect(res.body.anchor.commitment).toMatch(/^[0-9a-f]{64}$/);
    contractId = res.body.contract.id;

    const invitacionYaUsada = await request(app)
      .post(`/api/v1/investor/invitations/${invitacion.id}/accept`)
      .set("Authorization", `Bearer ${tokenInvestor}`);
    expect(invitacionYaUsada.status).toBe(409);
  });

  it("liberar una etapa ancla, y su TXID se puede volver a encontrar (P10)", async () => {
    const stage = await crearStageMinteado({
      projectId,
      name: "Cimientos",
      sequenceOrder: ETAPA,
      validationCritical: false,
      actorUserId: actorId
    });

    for (const [estado, actor] of [
      ["InProgress", tokenDev],
      ["Completed", tokenAdmin]
    ] as const) {
      const paso = await request(app)
        .patch(`/api/v1/stages/${stage.id}/state`)
        .set("Authorization", `Bearer ${actor}`)
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
    expect(uno.txid).toBe(release.body.anchor.txid);
    expect(uno.commitment).toMatch(/^[0-9a-f]{64}$/);
  });

  it("un miembro del proyecto que no es el dueño también ve las releases", async () => {
    const res = await request(app)
      .get(`/api/v1/contracts/${contractId}/releases`)
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    expect(res.body.some((r: { stageNumber: number }) => r.stageNumber === ETAPA)).toBe(true);
  });

  it("ni dueño ni miembro del proyecto: 403", async () => {
    const tokenAjeno = (await login(FIXTURES.ajeno)).body.token;

    const res = await request(app)
      .get(`/api/v1/contracts/${contractId}/releases`)
      .set("Authorization", `Bearer ${tokenAjeno}`);

    expect(res.status).toBe(403);
  });

  it("un contrato inexistente da 404 en las dos ramas", async () => {
    const res = await request(app)
      .get(`/api/v1/contracts/${createId()}/releases`)
      .set("Authorization", `Bearer ${tokenInvestor}`);

    expect(res.status).toBe(404);
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
    expect(contrato.unitStatus).toBe("sold");
    expect(contrato.investorName).toBeTruthy();
    expect(contrato.signedAt).not.toBeNull();
    expect(contrato.txid).toBeTruthy();
    expect(contrato.commitment).toMatch(/^[0-9a-f]{64}$/);

    expect(contrato.releases).toBeUndefined();
    expect(contrato.stagesReleased).toBeUndefined();
  });

  it("una segunda invitación aceptada sobre la unidad no duplica ni cruza el anclaje", async () => {
    const propio = await request(app)
      .get(`/api/v1/developer/projects/${projectId}/contracts`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .expect(200);
    const txidPropio = propio.body.find((c: { id: string }) => c.id === contractId).txid;

    const ahora = new Date();
    const invitacionAjena = createId();

    await db
      .insertInto("Invitation")
      .values({
        id: invitacionAjena,
        projectId,
        unitId,
        investorEmail: "otro@test.local",
        amountMinorUnits: 9_000_000,
        currency: "USD",
        status: "accepted",
        createdById: null,
        createdAt: ahora,
        respondedAt: ahora
      })
      .execute();

    await db
      .insertInto("OnChainEvent")
      .values({
        id: createId(),
        projectId,
        stageId: null,
        evidenceId: null,
        referenceId: invitacionAjena,
        eventIndex: 0,
        eventType: "INVITATION_ACCEPTED",
        fromState: null,
        toState: null,
        commitment: "f".repeat(64),
        status: "Confirmed",
        txid: "ajeno".padEnd(64, "0"),
        network: "Simulated",
        outputRef: null,
        blockTimestamp: null,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();

    const res = await request(app)
      .get(`/api/v1/developer/projects/${projectId}/contracts`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .expect(200);

    const delContrato = res.body.filter((c: { id: string }) => c.id === contractId);
    expect(delContrato).toHaveLength(1);
    expect(delContrato[0].txid).toBe(txidPropio);
    expect(delContrato[0].txid).not.toContain("ajeno");

    expect(delContrato[0].investorEmail).toBeUndefined();

    await db.deleteFrom("OnChainEvent").where("referenceId", "=", invitacionAjena).execute();
    await db.deleteFrom("Invitation").where("id", "=", invitacionAjena).execute();
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

  it("cada unidad trae la versión de la portada de su proyecto, como fecha ISO (D-099)", async () => {
    const version = new Date("2026-09-30T12:00:00.000Z");
    await db
      .updateTable("Project")
      .set({ coverUpdatedAt: version })
      .where("id", "=", projectId)
      .execute();

    const res = await request(app)
      .get("/api/v1/investor/units")
      .set("Authorization", `Bearer ${tokenInvestor}`);

    const unidad = res.body.find((u: { unitReference: string }) => u.unitReference === "7C");
    expect(unidad.coverUpdatedAt).toBe(version.toISOString());
  });
});

describe("GET /developer/projects — el precio 'desde'", () => {
  it("es el mínimo de las unidades del proyecto, no la primera ni la última", async () => {
    await request(app)
      .post(`/api/v1/developer/projects/${projectId}/units`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({
        unitReference: "9D",
        floor: 9,
        sizeM2: 80,
        priceMinorUnits: 14_000_000,
        currency: "USD"
      })
      .expect(201);

    await request(app)
      .post(`/api/v1/developer/projects/${projectId}/units`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({
        unitReference: "1A",
        floor: 1,
        sizeM2: 40,
        priceMinorUnits: 6_500_000,
        currency: "USD"
      })
      .expect(201);

    const res = await request(app)
      .get("/api/v1/developer/projects")
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    const proyecto = res.body.find((p: { id: string }) => p.id === projectId);
    expect(proyecto.priceFromMinorUnits).toBe(6_500_000);
    expect(proyecto.priceCurrency).toBe("USD");
  });

  it("un proyecto sin unidades con precio no inventa un 'desde'", async () => {
    const vacio = await request(app)
      .post("/api/v1/developer/projects")
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({
        latitude: -34.6,
        longitude: -58.4,
        name: "Sin unidades",
        slug: `sin-unidades-${Date.now()}`,
        totalUnits: 0
      })
      .expect(201);

    const res = await request(app)
      .get("/api/v1/developer/projects")
      .set("Authorization", `Bearer ${tokenDev}`);

    const proyecto = res.body.find((p: { id: string }) => p.id === vacio.body.id);
    expect(proyecto.priceFromMinorUnits).toBeNull();
    expect(proyecto.priceCurrency).toBeNull();
  });
});
