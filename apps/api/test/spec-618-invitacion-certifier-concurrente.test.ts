import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { createId } from "../src/db/id.js";
import { db } from "../src/lib/db.js";
import { FIXTURES } from "./global-setup.js";

// SPEC-618: responder una invitación de certifier es un solo lote condicional. Dos respuestas a la
// vez dan un ganador y un 409, nunca un 500 por `SQLITE_BUSY`, y nada queda a medias.

let certifier: string;
let certifierId: string;

beforeAll(async () => {
  certifier = (await request(app).post("/api/v1/auth/login").send(FIXTURES.certificador)).body
    .token as string;
  certifierId = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.certificador.email)
      .executeTakeFirstOrThrow()
  ).id;
});

async function invitacionPendiente() {
  const projectId = createId();
  const ahora = new Date();
  await db
    .insertInto("Project")
    .values({
      id: projectId,
      name: "Torre concurrente",
      slug: `torre-${projectId}`,
      latitude: -34.6,
      longitude: -58.4,
      totalUnits: 0,
      status: "planning",
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  const id = createId();
  await db
    .insertInto("CertifierInvitation")
    .values({ id, projectId, certifierId, status: "pending", createdAt: ahora })
    .execute();
  return { id, projectId };
}

const responder = (id: string, respuesta: "accept" | "decline") =>
  request(app)
    .post(`/api/v1/certifier/invitations/${id}/${respuesta}`)
    .set("Authorization", `Bearer ${certifier}`);

const membresias = (projectId: string) =>
  db
    .selectFrom("ProjectMember")
    .select("id")
    .where("projectId", "=", projectId)
    .where("userId", "=", certifierId)
    .execute();

const auditsDe = (id: string) =>
  db.selectFrom("AuditLog").select("action").where("entityId", "=", id).execute();

describe("responder la misma invitación de certifier dos veces a la vez", () => {
  it("dos `accept`: uno 200 y otro 409; una sola membresía y un solo audit", async () => {
    const { id, projectId } = await invitacionPendiente();

    const respuestas = await Promise.all([responder(id, "accept"), responder(id, "accept")]);

    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(respuestas.find((r) => r.status === 409)!.body.code).toBe("INVITATION_NOT_PENDING");
    expect(await membresias(projectId)).toHaveLength(1);
    expect(await auditsDe(id)).toEqual([{ action: "ACCEPT_CERTIFIER_INVITATION" }]);
  });

  it("`accept` contra `decline`: gana uno, y la membresía y el audit son los de ese", async () => {
    const { id, projectId } = await invitacionPendiente();

    const [aceptar, rechazar] = await Promise.all([
      responder(id, "accept"),
      responder(id, "decline")
    ]);

    expect([aceptar.status, rechazar.status].sort()).toEqual([200, 409]);
    const aceptada = aceptar.status === 200;
    const { status } = await db
      .selectFrom("CertifierInvitation")
      .select("status")
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    expect(status).toBe(aceptada ? "accepted" : "declined");
    expect(await membresias(projectId)).toHaveLength(aceptada ? 1 : 0);
    expect(await auditsDe(id)).toEqual([
      { action: aceptada ? "ACCEPT_CERTIFIER_INVITATION" : "DECLINE_CERTIFIER_INVITATION" }
    ]);
  });
});
