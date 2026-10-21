import { NPS_MINIMUM_RESPONSES } from "@plataforma/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { sembrarMembresias, sembrarProyecto, sembrarUnidadVendida } from "../src/db/fixtures.js";
import { createId } from "../src/db/id.js";
import { db } from "../src/lib/db.js";
import * as casos from "../src/modules/encuestas/casos.js";
import * as q from "../src/modules/encuestas/queries.js";
import { categoria, resumen } from "../src/modules/encuestas/rules.js";
import { FIXTURES } from "./global-setup.js";
import { crearStageMinteado } from "./helpers/stages.js";

const login = async (f: { email: string; password: string }) =>
  (await request(app).post("/api/v1/auth/login").send(f)).body.token as string;

const idDe = async (email: string) =>
  (await db.selectFrom("User").select("id").where("email", "=", email).executeTakeFirstOrThrow())
    .id;

let tokenDev: string;
let tokenAdmin: string;
let investorId: string;
let projectId: string;
let contractId: string;
let unitId: string;

async function stageCompletado(sequenceOrder: number) {
  const stage = await crearStageMinteado({
    projectId,
    name: `Etapa ${sequenceOrder}`,
    sequenceOrder,
    validationCritical: false,
    actorUserId: await idDe(FIXTURES.activo.email)
  });
  for (const [state, token] of [
    ["InProgress", tokenDev],
    ["Completed", tokenAdmin]
  ] as const) {
    await request(app)
      .patch(`/api/v1/stages/${stage.id}/state`)
      .set("Authorization", `Bearer ${token}`)
      .send({ state });
  }
}

const liberar = (stageNum: number) =>
  request(app)
    .post(`/api/v1/developer/contracts/${contractId}/releases/${stageNum}`)
    .set("Authorization", `Bearer ${tokenDev}`)
    .send({ amountMinorUnits: 100_000 });

const encuestasDelProyecto = () =>
  db.selectFrom("NpsSurvey").selectAll().where("projectId", "=", projectId).execute();

const responder = (token: string, body: object) =>
  request(app).post(`/api/v1/investor/surveys/${token}/respond`).send(body);

beforeAll(async () => {
  tokenDev = await login(FIXTURES.activo);
  tokenAdmin = await login(FIXTURES.admin);
  investorId = await idDe(FIXTURES.investor.email);

  const slug = `spec-503-${createId()}`;
  projectId = await sembrarProyecto(db, {
    slug,
    name: slug,
    totalUnits: 1,
    status: "in_progress"
  });
  await sembrarMembresias(db, projectId, [
    { userId: await idDe(FIXTURES.activo.email), membershipRole: "developer" },
    { userId: investorId, membershipRole: "buyer" }
  ]);
  ({ contractId, unitId } = await sembrarUnidadVendida(db, {
    projectId,
    investorId,
    unitReference: "NPS-1",
    floor: 1,
    sizeM2: 50,
    priceMinorUnits: 1_000_000,
    currency: "USD"
  }));
  await stageCompletado(1);
  await stageCompletado(2);
});

afterAll(async () => {
  await db.destroy();
});

describe("el envío (D-104: la primera liberación)", () => {
  it("antes de liberar no hay encuesta", async () => {
    expect(await encuestasDelProyecto()).toEqual([]);
  });

  it("la primera liberación le manda la encuesta al investor, con su notificación", async () => {
    expect((await liberar(1)).status).toBe(201);

    const [encuesta, ...otras] = await encuestasDelProyecto();
    expect(otras).toEqual([]);
    expect(encuesta).toMatchObject({
      investorId,
      triggerEventType: "FIRST_RELEASE",
      score: null,
      respondedAt: null
    });
    expect(encuesta!.token).toMatch(/^[a-f0-9]{64}$/);

    const aviso = await db
      .selectFrom("Notification")
      .select(["titleKey", "paramsJson", "unitId"])
      .where("userId", "=", investorId)
      .where("titleKey", "=", "notifications.survey.nps")
      .where("unitId", "=", unitId)
      .execute();
    expect(aviso).toEqual([
      {
        titleKey: "notifications.survey.nps",
        paramsJson: JSON.stringify({ surveyToken: encuesta!.token }),
        unitId
      }
    ]);
  });

  it("la segunda liberación no vuelve a preguntar ni a avisar", async () => {
    expect((await liberar(2)).status).toBe(201);

    expect(await encuestasDelProyecto()).toHaveLength(1);
    const avisos = await db
      .selectFrom("Notification")
      .select("id")
      .where("titleKey", "=", "notifications.survey.nps")
      .where("unitId", "=", unitId)
      .execute();
    expect(avisos).toHaveLength(1);
  });
});

describe("POST /investor/surveys/:token/respond", () => {
  let token: string;
  beforeAll(async () => {
    token = (await encuestasDelProyecto())[0]!.token;
  });

  it("un score fuera de 0-10 es 400, también un decimal", async () => {
    expect((await responder(token, { score: 11 })).status).toBe(400);
    expect((await responder(token, { score: -1 })).status).toBe(400);
    expect((await responder(token, { score: 7.5 })).status).toBe(400);
  });

  it("un token que no existe es 404, y uno mal formado 400", async () => {
    expect((await responder("a".repeat(64), { score: 9 })).status).toBe(404);
    expect((await responder("no-es-un-token", { score: 9 })).status).toBe(400);
  });

  it("sin sesión y sin comentario, responde: 200 y queda en el audit sin el puntaje", async () => {
    const { status, body } = await responder(token, { score: 10 });

    expect(status).toBe(200);
    expect(body.respondedAt).toBeTruthy();
    const [encuesta] = await encuestasDelProyecto();
    expect(encuesta).toMatchObject({ score: 10, comment: null });
    const audit = await db
      .selectFrom("AuditLog")
      .select(["action", "actorUserId", "metadataJson"])
      .where("entityId", "=", encuesta!.id)
      .executeTakeFirstOrThrow();
    expect(audit).toEqual({
      action: "RESPOND_NPS_SURVEY",
      actorUserId: investorId,
      metadataJson: null
    });
  });

  it("responder otra vez con el mismo token es 409, y no sobrescribe", async () => {
    const { status, body } = await responder(token, { score: 0, comment: "Cambié de idea" });

    expect(status).toBe(409);
    expect(body.code).toBe("SURVEY_ALREADY_ANSWERED");
    expect((await encuestasDelProyecto())[0]).toMatchObject({ score: 10, comment: null });
  });

  it("si otra respuesta gana entre la lectura y el reclamo, la segunda es SURVEY_ALREADY_ANSWERED", async () => {
    const otro = await sembrarProyecto(db, {
      slug: `spec-503-carrera-${createId()}`,
      name: "carrera",
      totalUnits: 1,
      status: "in_progress"
    });
    await casos.enviarPorPrimeraLiberacion(
      { db, clock: () => new Date() },
      { investorId, projectId: otro, unitId }
    );
    const { token: t } = await db
      .selectFrom("NpsSurvey")
      .select("token")
      .where("projectId", "=", otro)
      .executeTakeFirstOrThrow();
    const leer = q.encuestaPorToken;
    const espia = vi.spyOn(q, "encuestaPorToken").mockImplementationOnce(async (e, tk) => {
      const fila = await leer(e, tk);
      await db
        .updateTable("NpsSurvey")
        .set({ score: 5, respondedAt: Date.now() })
        .where("token", "=", tk)
        .execute();
      return fila;
    });

    const resultado = await casos.responder(
      { db, clock: () => new Date() },
      { token: t, score: 9, comment: "Tarde" }
    );

    espia.mockRestore();
    expect(resultado).toEqual({ ok: false, code: "SURVEY_ALREADY_ANSWERED" });
  });
});

describe("el NPS agregado", () => {
  it("con el comentario opcional y vacío, también vale", async () => {
    const otro = await sembrarProyecto(db, {
      slug: `spec-503-vacio-${createId()}`,
      name: "vacío",
      totalUnits: 1,
      status: "in_progress"
    });
    await casos.enviarPorPrimeraLiberacion(
      { db, clock: () => new Date() },
      { investorId, projectId: otro, unitId }
    );
    const { token } = await db
      .selectFrom("NpsSurvey")
      .select("token")
      .where("projectId", "=", otro)
      .executeTakeFirstOrThrow();

    expect((await responder(token, { score: 3, comment: "" })).status).toBe(200);
    expect(await casos.resumen({ db }, [otro])).toMatchObject({
      detractors: 1,
      responseCount: 1,
      sentCount: 1,
      score: -100,
      belowMinimum: true
    });
  });

  it("un proyecto con encuestas sin responder: score null, no 0", async () => {
    const otro = await sembrarProyecto(db, {
      slug: `spec-503-sin-${createId()}`,
      name: "sin respuestas",
      totalUnits: 1,
      status: "in_progress"
    });
    await casos.enviarPorPrimeraLiberacion(
      { db, clock: () => new Date() },
      { investorId, projectId: otro, unitId }
    );

    expect(await casos.resumen({ db }, [otro])).toEqual({
      promoters: 0,
      passives: 0,
      detractors: 0,
      responseCount: 0,
      sentCount: 1,
      score: null,
      minimumResponses: NPS_MINIMUM_RESPONSES,
      belowMinimum: true
    });
  });

  it("GET /admin/nps es del admin: agrega todo, sin comentarios ni quién respondió", async () => {
    const { status, body } = await request(app)
      .get("/api/v1/admin/nps")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(status).toBe(200);
    expect(body.responseCount).toBeGreaterThanOrEqual(2);
    expect(Object.keys(body).sort()).toEqual(
      [
        "belowMinimum",
        "detractors",
        "minimumResponses",
        "passives",
        "promoters",
        "responseCount",
        "score",
        "sentCount"
      ].sort()
    );
    expect(
      (await request(app).get("/api/v1/admin/nps").set("Authorization", `Bearer ${tokenDev}`))
        .status
    ).toBe(403);
  });
});

describe("las reglas del NPS", () => {
  it("9-10 promueve, 7-8 es pasivo, 0-6 detracta", () => {
    expect([0, 6, 7, 8, 9, 10].map(categoria)).toEqual([
      "detractor",
      "detractor",
      "passive",
      "passive",
      "promoter",
      "promoter"
    ]);
  });

  it("% promotores − % detractores, con la advertencia de muestra chica hasta el mínimo", () => {
    const pocas = resumen([10, 9, 8, 3], 10);
    expect(pocas).toMatchObject({ score: 25, belowMinimum: true, sentCount: 10 });

    const suficientes = resumen(Array(NPS_MINIMUM_RESPONSES).fill(10), NPS_MINIMUM_RESPONSES);
    expect(suficientes).toMatchObject({ score: 100, belowMinimum: false });
  });
});
