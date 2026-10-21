import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import {
  sembrarMembresias,
  sembrarProyecto,
  sembrarStages,
  sembrarUnidadVendida
} from "../src/db/fixtures.js";
import { createId } from "../src/db/id.js";
import { db } from "../src/lib/db.js";
import * as casos from "../src/modules/disputas/casos.js";
import * as q from "../src/modules/disputas/queries.js";
import { FIXTURES } from "./global-setup.js";

const login = async (f: { email: string; password: string }) =>
  (await request(app).post("/api/v1/auth/login").send(f)).body.token as string;

const idDe = async (email: string) =>
  (await db.selectFrom("User").select("id").where("email", "=", email).executeTakeFirstOrThrow())
    .id;

const token: Record<"admin" | "developer" | "investor" | "certificador" | "ajeno", string> = {
  admin: "",
  developer: "",
  investor: "",
  certificador: "",
  ajeno: ""
};
let projectId: string;
let completado: string;
let enObra: string;
let contractId: string;

beforeAll(async () => {
  token.admin = await login(FIXTURES.admin);
  token.developer = await login(FIXTURES.activo);
  token.investor = await login(FIXTURES.investor);
  token.certificador = await login(FIXTURES.certificador);
  token.ajeno = await login(FIXTURES.ajeno);

  const slug = `spec-502-${createId()}`;
  projectId = await sembrarProyecto(db, {
    slug,
    name: slug,
    totalUnits: 2,
    status: "in_progress"
  });
  await sembrarMembresias(db, projectId, [
    { userId: await idDe(FIXTURES.activo.email), membershipRole: "developer" },
    { userId: await idDe(FIXTURES.investor.email), membershipRole: "buyer" },
    { userId: await idDe(FIXTURES.certificador.email), membershipRole: "verifier" }
  ]);
  await sembrarStages(db, projectId, [
    { name: "Fundaciones", sequenceOrder: 1, state: "Completed" },
    { name: "Estructura", sequenceOrder: 2, state: "InProgress" }
  ]);
  const stages = await db
    .selectFrom("Stage")
    .select(["id", "sequenceOrder"])
    .where("projectId", "=", projectId)
    .orderBy("sequenceOrder")
    .execute();
  completado = stages[0]!.id;
  enObra = stages[1]!.id;

  ({ contractId } = await sembrarUnidadVendida(db, {
    projectId,
    investorId: await idDe(FIXTURES.investor.email),
    unitReference: "D-1",
    floor: 1,
    sizeM2: 60,
    priceMinorUnits: 9_000_000,
    currency: "USD"
  }));
  await db
    .insertInto("PaymentAttestation")
    .values({
      id: createId(),
      contractId,
      stageNumber: 1,
      amountMinorUnits: 1_000_000,
      releasedById: null,
      releasedAt: Date.now()
    })
    .execute();
});

afterAll(async () => {
  await db.destroy();
});

const abrir = (quien: keyof typeof token, body: object) =>
  request(app).post("/api/v1/disputes").set("Authorization", `Bearer ${token[quien]}`).send(body);

const resolver = (quien: keyof typeof token, id: string, body: object) =>
  request(app)
    .post(`/api/v1/disputes/${id}/resolve`)
    .set("Authorization", `Bearer ${token[quien]}`)
    .send(body);

const listar = (quien: keyof typeof token, query: object) =>
  request(app).get("/api/v1/disputes").query(query).set("Authorization", `Bearer ${token[quien]}`);

describe("POST /disputes (SPEC-502)", () => {
  it("el investor abre una disputa sobre un stage Completed: 201, Open, y queda en el audit", async () => {
    const { status, body } = await abrir("investor", {
      stageId: completado,
      reason: "La liberación no corresponde"
    });

    expect(status).toBe(201);
    expect(body).toMatchObject({
      stageId: completado,
      projectId,
      status: "Open",
      outcome: null,
      resolution: null,
      resolvedAt: null
    });
    const fila = await db
      .selectFrom("AuditLog")
      .select(["action", "metadataJson"])
      .where("entityId", "=", body.id)
      .executeTakeFirstOrThrow();
    expect(fila.action).toBe("OPEN_DISPUTE");
    expect(fila.metadataJson).not.toContain("liberación");
  });

  it("dos disputas abiertas sobre el mismo stage a la vez son independientes", async () => {
    const [a, b] = await Promise.all([
      abrir("developer", { stageId: enObra, reason: "Uno" }),
      abrir("investor", { stageId: enObra, reason: "Otro" })
    ]);

    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body.id).not.toBe(b.body.id);
  });

  it("ninguna disputa produce un OnChainEvent", async () => {
    const { body } = await abrir("investor", { stageId: enObra, reason: "Sin cadena" });

    const eventos = await db
      .selectFrom("OnChainEvent")
      .select("id")
      .where("referenceId", "=", body.id)
      .execute();
    expect(eventos).toEqual([]);
  });

  it("quien no es parte del proyecto recibe 403, y el certifier también: no abre", async () => {
    expect((await abrir("ajeno", { stageId: completado, reason: "x" })).status).toBe(403);
    expect((await abrir("certificador", { stageId: completado, reason: "x" })).status).toBe(403);
  });

  it("un stage que no existe es 404 y un reason vacío es 400", async () => {
    expect((await abrir("investor", { stageId: createId(), reason: "x" })).status).toBe(404);
    expect((await abrir("investor", { stageId: completado, reason: "   " })).status).toBe(400);
  });
});

describe("POST /disputes/:id/resolve", () => {
  const nueva = async (stageId = completado) =>
    (await abrir("investor", { stageId, reason: "Reclamo" })).body.id as string;

  it("el certifier del proyecto resuelve: Resolved, con outcome, quién y cuándo", async () => {
    const id = await nueva();

    const { status, body } = await resolver("certificador", id, {
      outcome: "ReInspectionAgreed",
      resolution: "Se reinspecciona"
    });

    expect(status).toBe(200);
    expect(body).toMatchObject({
      status: "Resolved",
      outcome: "ReInspectionAgreed",
      resolution: "Se reinspecciona",
      resolvedById: await idDe(FIXTURES.certificador.email)
    });
    expect(body.resolvedAt).not.toBeNull();
  });

  it("Resolved es terminal: resolverla otra vez es 409", async () => {
    const id = await nueva();
    await resolver("admin", id, { outcome: "Dismissed", resolution: "No procede" });

    const otra = await resolver("admin", id, { outcome: "Dismissed", resolution: "Otra vez" });

    expect(otra.status).toBe(409);
    expect(otra.body.code).toBe("DISPUTE_ALREADY_RESOLVED");
  });

  it("RefundAgreed sin ninguna liberación en ese stage es 409", async () => {
    const id = await nueva(enObra);

    const { status, body } = await resolver("certificador", id, {
      outcome: "RefundAgreed",
      resolution: "Reembolso"
    });

    expect(status).toBe(409);
    expect(body.code).toBe("REFUND_WITHOUT_RELEASE");
  });

  it("RefundAgreed sobre un stage con liberación se registra", async () => {
    const id = await nueva(completado);

    const { status, body } = await resolver("certificador", id, {
      outcome: "RefundAgreed",
      resolution: "Reembolso acordado fuera de la plataforma"
    });

    expect(status).toBe(200);
    expect(body.outcome).toBe("RefundAgreed");
  });

  it("el investor no resuelve su propia disputa, ni el developer: 403", async () => {
    const id = await nueva();

    expect((await resolver("investor", id, { outcome: "Dismissed", resolution: "x" })).status).toBe(
      403
    );
    expect(
      (await resolver("developer", id, { outcome: "Dismissed", resolution: "x" })).status
    ).toBe(403);
  });

  it("una disputa que no existe es 404 y un outcome fuera del enum es 400", async () => {
    expect(
      (await resolver("admin", createId(), { outcome: "Dismissed", resolution: "x" })).status
    ).toBe(404);
    const id = await nueva();
    expect((await resolver("admin", id, { outcome: "Ganó", resolution: "x" })).status).toBe(400);
  });

  it("si otra resolución gana entre la lectura y el reclamo, la segunda es DISPUTE_ALREADY_RESOLVED", async () => {
    const id = await nueva();
    const leer = q.disputaPorId;
    const espia = vi.spyOn(q, "disputaPorId").mockImplementationOnce(async (e, i) => {
      const fila = await leer(e, i);
      await db.updateTable("Dispute").set({ status: "Resolved" }).where("id", "=", id).execute();
      return fila;
    });

    const resultado = await casos.resolver(
      { db, clock: () => new Date() },
      { id, outcome: "Dismissed", resolution: "Tarde", actorId: await idDe(FIXTURES.admin.email) }
    );

    espia.mockRestore();
    expect(resultado).toEqual({ ok: false, code: "DISPUTE_ALREADY_RESOLVED" });
  });
});

describe("GET /disputes", () => {
  it("lista las del proyecto, filtrables por status", async () => {
    const abiertas = await listar("developer", { projectId, status: "Open" });
    const todas = await listar("certificador", { projectId });

    expect(abiertas.status).toBe(200);
    expect(abiertas.body.every((d: { status: string }) => d.status === "Open")).toBe(true);
    expect(todas.body.length).toBeGreaterThan(abiertas.body.length);
    expect(todas.body.every((d: { projectId: string }) => d.projectId === projectId)).toBe(true);
  });

  it("el comprador no lista, ni quien no es del proyecto", async () => {
    expect((await listar("investor", { projectId })).status).toBe(403);
    expect((await listar("ajeno", { projectId })).status).toBe(403);
  });

  it("sin projectId es 400", async () => {
    expect((await listar("admin", {})).status).toBe(400);
  });
});

describe("disputeRate: disputas sobre liberaciones", () => {
  it("cuenta toda disputa del proyecto sobre sus liberaciones", async () => {
    const { disputes, releases, rate } = await casos.tasaDeDisputas({ db }, [projectId]);

    expect(releases).toBe(1);
    expect(disputes).toBeGreaterThan(1);
    expect(rate).toBe(disputes);
  });

  it("sin liberaciones la tasa es null, no 0 ni división por cero", async () => {
    const vacio = await sembrarProyecto(db, {
      slug: `spec-502-vacio-${createId()}`,
      name: "vacío",
      totalUnits: 1,
      status: "planning"
    });

    expect(await casos.tasaDeDisputas({ db }, [vacio])).toEqual({
      disputes: 0,
      releases: 0,
      rate: null
    });
  });

  it("sin filtro agrega todos los proyectos", async () => {
    const global = await casos.tasaDeDisputas({ db }, undefined);
    const propio = await casos.tasaDeDisputas({ db }, [projectId]);

    expect(global.disputes).toBeGreaterThanOrEqual(propio.disputes);
    expect(global.releases).toBeGreaterThanOrEqual(propio.releases);
  });
});
