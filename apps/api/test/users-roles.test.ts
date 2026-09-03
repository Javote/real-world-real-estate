import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

let adminToken: string;

beforeAll(async () => {
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: FIXTURES.admin.email, password: FIXTURES.admin.password });
  adminToken = res.body.token;
});

afterAll(async () => {
  await db.destroy();
});

// El schema local de esta ruta había quedado con los tres roles viejos y se
// olvidó "notary" cuando el dominio pasó a cuatro (packages/shared/src/auth.ts
// ya lo tenía). Sin este test, un admin no podía dar de alta un notary real
// aunque el rol existiera en la base y en el resto de la API.
describe("POST /api/v1/users acepta los cinco roles de userRoleSchema", () => {
  it("puede crear un usuario con role notary", async () => {
    const res = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "nuevo-notary@test.local",
        password: "una password larga y valida",
        role: "notary",
        fullName: "Notary Nuevo"
      });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe("notary");
  });

  it("PATCH también puede promover a notary", async () => {
    const buyer = await db
      .selectFrom("User")
      .selectAll()
      .where("email", "=", FIXTURES.investor.email)
      .executeTakeFirstOrThrow();

    const res = await request(app)
      .patch(`/api/v1/users/${buyer.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "notary" });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe("notary");

    // No dejar el fixture mutado para el resto de la suite.
    await db
      .updateTable("User")
      .set({ role: "buyer", updatedAt: new Date() })
      .where("id", "=", buyer.id)
      .execute();
  });
});
