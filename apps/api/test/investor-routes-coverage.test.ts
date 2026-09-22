import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// SPEC-017 §paso 4 — ramas de `investor.routes.ts` que ningún test HTTP
// ejercitaba: favoritos (alta, baja, y el 404 de proyecto inexistente),
// el detalle de unidad y sus novedades, el filtro por `unitId` de
// notificaciones, y el flujo entero de rechazar una invitación (hoy sin
// ningún test, ni el camino feliz ni el 409 de "ya respondida").

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

let tokenInvestor: string;
let unidadId: string;
let proyectoId: string;

beforeAll(async () => {
  tokenInvestor = (await login(FIXTURES.investor)).body.token;

  unidadId = (
    await db
      .selectFrom("Unit")
      .select("id")
      .where("unitReference", "=", FIXTURES.unidad.unitReference)
      .executeTakeFirstOrThrow()
  ).id;

  proyectoId = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
});

afterAll(async () => {
  await db.destroy();
});

describe("favoritos", () => {
  it("agregar contra un proyecto que no existe da 404", async () => {
    const res = await request(app)
      .post(`/api/v1/investor/favorites/${createId()}`)
      .set("Authorization", `Bearer ${tokenInvestor}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Project not found");
  });

  it("agregar, listar y quitar — el ciclo completo", async () => {
    const alta = await request(app)
      .post(`/api/v1/investor/favorites/${proyectoId}`)
      .set("Authorization", `Bearer ${tokenInvestor}`);
    expect(alta.status).toBe(204);

    const listado = await request(app)
      .get("/api/v1/investor/favorites")
      .set("Authorization", `Bearer ${tokenInvestor}`);
    expect(listado.body.map((p: { id: string }) => p.id)).toContain(proyectoId);

    // Idempotente (regla 8): agregar dos veces no es un error.
    const denuevo = await request(app)
      .post(`/api/v1/investor/favorites/${proyectoId}`)
      .set("Authorization", `Bearer ${tokenInvestor}`);
    expect(denuevo.status).toBe(204);

    const baja = await request(app)
      .delete(`/api/v1/investor/favorites/${proyectoId}`)
      .set("Authorization", `Bearer ${tokenInvestor}`);
    expect(baja.status).toBe(204);

    const listadoFinal = await request(app)
      .get("/api/v1/investor/favorites")
      .set("Authorization", `Bearer ${tokenInvestor}`);
    expect(listadoFinal.body.map((p: { id: string }) => p.id)).not.toContain(proyectoId);
  });
});

describe("GET /investor/units/:id", () => {
  it("trae la unidad con sus stages, cada uno con su estado de anclaje", async () => {
    const res = await request(app)
      .get(`/api/v1/investor/units/${unidadId}`)
      .set("Authorization", `Bearer ${tokenInvestor}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(unidadId);
    expect(Array.isArray(res.body.stages)).toBe(true);
  });
});

describe("GET /investor/units/:id/dossier/export.pdf", () => {
  it("con artefactos de verdad (no un dossier vacío), el PDF los lista", async () => {
    // `compileDossier` arma `artifacts` a partir de los Stage del proyecto,
    // sin filtrar por estado — pero `global-setup.ts` no siembra ningún
    // Stage, así que sin este insert el dossier de la unidad queda vacío y
    // el `flatMap` que arma el cuerpo del PDF nunca corre.
    await db
      .insertInto("Stage")
      .values({
        id: createId(),
        projectId: proyectoId,
        name: "Etapa para el dossier",
        sequenceOrder: 777,
        state: "Pending",
        validationCritical: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .execute();

    const res = await request(app)
      .get(`/api/v1/investor/units/${unidadId}/dossier/export.pdf`)
      .set("Authorization", `Bearer ${tokenInvestor}`)
      .buffer(true)
      .parse((res, cb) => {
        const trozos: Buffer[] = [];
        res.on("data", (t: Buffer) => trozos.push(t));
        res.on("end", () => cb(null, Buffer.concat(trozos)));
      });

    expect(res.status).toBe(200);
    const texto = (res.body as Buffer).toString("latin1");
    expect(texto).toContain("Etapa para el dossier");
  });
});

describe("GET /investor/units/:id/news", () => {
  it("trae los eventos on-chain del proyecto de la unidad", async () => {
    const res = await request(app)
      .get(`/api/v1/investor/units/${unidadId}/news`)
      .set("Authorization", `Bearer ${tokenInvestor}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("GET /investor/notifications?unitId=", () => {
  it("filtra por unitId cuando se pasa explícito", async () => {
    const notificacionId = createId();
    await db
      .insertInto("Notification")
      .values({
        id: notificacionId,
        userId: (
          await db
            .selectFrom("User")
            .select("id")
            .where("email", "=", FIXTURES.investor.email)
            .executeTakeFirstOrThrow()
        ).id,
        category: "stage",
        titleKey: "notifications.stage.completed",
        paramsJson: null,
        unitId: unidadId,
        readAt: null,
        createdAt: new Date()
      })
      .execute();

    const res = await request(app)
      .get(`/api/v1/investor/notifications?unitId=${unidadId}`)
      .set("Authorization", `Bearer ${tokenInvestor}`);

    expect(res.status).toBe(200);
    expect(res.body.every((n: { unitId: string | null }) => n.unitId === unidadId)).toBe(true);
    expect(res.body.some((n: { id: string }) => n.id === notificacionId)).toBe(true);
  });
});

describe("POST /investor/invitations/:id/decline", () => {
  async function crearInvitacionPendiente() {
    const ahora = new Date();
    const id = createId();
    await db
      .insertInto("Invitation")
      .values({
        id,
        projectId: proyectoId,
        unitId: unidadId,
        investorEmail: FIXTURES.investor.email,
        amountMinorUnits: 5_000_000,
        currency: "USD",
        status: "pending",
        createdById: null,
        createdAt: ahora,
        respondedAt: null
      })
      .execute();
    // La unidad tiene que estar reservada para que el rechazo tenga algo que
    // devolver a `available` — el mismo estado que deja `createInvitationProcedure`.
    await db.updateTable("Unit").set({ status: "reserved" }).where("id", "=", unidadId).execute();
    return id;
  }

  it("rechaza y devuelve la unidad a available", async () => {
    const invitacionId = await crearInvitacionPendiente();

    const res = await request(app)
      .post(`/api/v1/investor/invitations/${invitacionId}/decline`)
      .set("Authorization", `Bearer ${tokenInvestor}`);
    expect(res.status).toBe(204);

    const invitacion = await db
      .selectFrom("Invitation")
      .select(["status", "respondedAt"])
      .where("id", "=", invitacionId)
      .executeTakeFirstOrThrow();
    expect(invitacion.status).toBe("declined");
    expect(invitacion.respondedAt).not.toBeNull();

    const unidad = await db
      .selectFrom("Unit")
      .select("status")
      .where("id", "=", unidadId)
      .executeTakeFirstOrThrow();
    expect(unidad.status).toBe("available");
  });

  it("rechazar una invitación ya respondida da 409", async () => {
    const invitacionId = await crearInvitacionPendiente();

    const primera = await request(app)
      .post(`/api/v1/investor/invitations/${invitacionId}/decline`)
      .set("Authorization", `Bearer ${tokenInvestor}`);
    expect(primera.status).toBe(204);

    const segunda = await request(app)
      .post(`/api/v1/investor/invitations/${invitacionId}/decline`)
      .set("Authorization", `Bearer ${tokenInvestor}`);
    expect(segunda.status).toBe(409);
    expect(segunda.body.message).toBe("Invitation already declined");
  });
});
