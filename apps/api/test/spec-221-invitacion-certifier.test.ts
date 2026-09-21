import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// SPEC-221 · el admin invita a un certifier a un proyecto y el certifier
// decide (D-095). Hasta hoy, sumar un certifier era `POST /projects/:id/members`
// por consola; esto lo vuelve un flujo con pantalla, como el del buyer.
//
// Se usa `torre-ajena`, el proyecto SIN miembros: es justo el caso real — un
// proyecto nuevo cuyo certifier todavía no ve nada.

const login = async (cred: { email: string; password: string }) =>
  (await request(app).post("/api/v1/auth/login").send(cred)).body.token as string;

let admin: string;
let certifier: string;
let developer: string;
let proyecto: string;
let certifierId: string;
let developerId: string;

beforeAll(async () => {
  admin = await login(FIXTURES.admin);
  certifier = await login(FIXTURES.certificador);
  developer = await login(FIXTURES.activo);

  proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.otroProyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
  certifierId = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.certificador.email)
      .executeTakeFirstOrThrow()
  ).id;
  developerId = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow()
  ).id;
});

const invitar = (token: string, userId: string) =>
  request(app)
    .post(`/api/v1/projects/${proyecto}/certifier-invitations`)
    .set("Authorization", `Bearer ${token}`)
    .send({ certifierId: userId });

const esMiembro = async () =>
  Boolean(
    await db
      .selectFrom("ProjectMember")
      .select("id")
      .where("projectId", "=", proyecto)
      .where("userId", "=", certifierId)
      .where("membershipRole", "=", "verifier")
      .executeTakeFirst()
  );

describe("SPEC-221 · invitar a un certifier", () => {
  it("solo el admin invita: un developer recibe 403", async () => {
    const res = await invitar(developer, certifierId);
    expect(res.status).toBe(403);
  });

  it("un usuario que no es certifier no se puede invitar a certificar", async () => {
    const res = await invitar(admin, developerId);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("CERTIFIER_NOT_ELIGIBLE");
  });

  it("rechazar no crea membresía, y después se puede volver a invitar", async () => {
    const creada = await invitar(admin, certifierId);
    expect(creada.status).toBe(201);
    expect(creada.body).toMatchObject({ status: "pending", certifierId, projectId: proyecto });

    const rechazo = await request(app)
      .post(`/api/v1/certifier/invitations/${creada.body.id}/decline`)
      .set("Authorization", `Bearer ${certifier}`);
    expect(rechazo.status).toBe(200);
    expect(rechazo.body.status).toBe("declined");
    expect(await esMiembro()).toBe(false);
  });

  it("aceptar crea la membresía verifier y las etapas del proyecto entran en su cola", async () => {
    const creada = await invitar(admin, certifierId);
    expect(creada.status).toBe(201);

    // Una segunda invitación pendiente al mismo certifier y proyecto, no.
    const duplicada = await invitar(admin, certifierId);
    expect(duplicada.status).toBe(409);
    expect(duplicada.body.code).toBe("INVITATION_ALREADY_PENDING");

    const pendientes = await request(app)
      .get("/api/v1/certifier/invitations")
      .set("Authorization", `Bearer ${certifier}`);
    expect(pendientes.status).toBe(200);
    expect(pendientes.body.map((i: { id: string }) => i.id)).toContain(creada.body.id);

    const acepta = await request(app)
      .post(`/api/v1/certifier/invitations/${creada.body.id}/accept`)
      .set("Authorization", `Bearer ${certifier}`);
    expect(acepta.status).toBe(200);
    expect(acepta.body.status).toBe("accepted");
    expect(await esMiembro()).toBe(true);

    // Responder dos veces no vale: la guarda es atómica.
    const otraVez = await request(app)
      .post(`/api/v1/certifier/invitations/${creada.body.id}/accept`)
      .set("Authorization", `Bearer ${certifier}`);
    expect(otraVez.status).toBe(409);
    expect(otraVez.body.code).toBe("INVITATION_NOT_PENDING");

    // Ya es miembro: invitarlo de nuevo es un error con nombre, no un duplicado.
    const yaMiembro = await invitar(admin, certifierId);
    expect(yaMiembro.status).toBe(409);
    expect(yaMiembro.body.code).toBe("ALREADY_MEMBER");

    // Y el admin ve el historial del proyecto: la rechazada y la aceptada.
    const historial = await request(app)
      .get(`/api/v1/projects/${proyecto}/certifier-invitations`)
      .set("Authorization", `Bearer ${admin}`);
    expect(historial.status).toBe(200);
    expect(historial.body.map((i: { status: string }) => i.status).sort()).toEqual([
      "accepted",
      "declined"
    ]);
  });

  it("otro usuario no puede responder la invitación de un certifier", async () => {
    const invitacion = await db
      .selectFrom("CertifierInvitation")
      .select("id")
      .where("projectId", "=", proyecto)
      .executeTakeFirstOrThrow();

    const res = await request(app)
      .post(`/api/v1/certifier/invitations/${invitacion.id}/accept`)
      .set("Authorization", `Bearer ${developer}`);
    expect(res.status).toBe(403);
  });

  it("cada paso queda en el audit log", async () => {
    const acciones = (
      await db
        .selectFrom("AuditLog")
        .select("action")
        .where("entityType", "=", "CertifierInvitation")
        .execute()
    ).map((f) => f.action);
    expect(acciones).toEqual(
      expect.arrayContaining([
        "INVITE_CERTIFIER",
        "ACCEPT_CERTIFIER_INVITATION",
        "DECLINE_CERTIFIER_INVITATION"
      ])
    );
  });
});
