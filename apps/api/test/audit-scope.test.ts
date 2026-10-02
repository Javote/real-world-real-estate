import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { en } from "../src/lib/arrays";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

const ACCION = "TEST_AUDIT_SCOPE";

let deLoMio: string;
let deOtroProyecto: string;
let deUnUsuario: string;
let deUnStagePropio: string;

const tokenDe = async (f: { email: string; password: string }) =>
  (await request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password }))
    .body.token as string;

const acciones = async (f: { email: string; password: string }) => {
  const res = await request(app)
    .get("/api/v1/developer/audit-log?limit=100")
    .set("Authorization", `Bearer ${await tokenDe(f)}`);

  expect(res.status).toBe(200);
  return (res.body.items as { id: string }[]).map((i) => i.id);
};

beforeAll(async () => {
  const ahora = new Date();
  const idDe = async (slug: string) =>
    (await db.selectFrom("Project").select("id").where("slug", "=", slug).executeTakeFirstOrThrow())
      .id;

  const mio = await idDe(FIXTURES.proyecto.slug);
  const ajeno = await idDe(FIXTURES.otroProyecto.slug);

  const stagePropio = createId();
  await db
    .insertInto("Stage")
    .values({
      id: stagePropio,
      projectId: mio,
      name: "Stage de auditoría",
      sequenceOrder: 900,
      state: "Pending",
      validationCritical: false,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();

  const unUsuario = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.admin.email)
      .executeTakeFirstOrThrow()
  ).id;

  const fila = (entityType: string, entityId: string) => ({
    id: createId(),
    actorUserId: null,
    action: ACCION,
    entityType,
    entityId,
    metadataJson: null,
    createdAt: ahora
  });

  const filas = [
    fila("Project", mio),
    fila("Project", ajeno),
    fila("User", unUsuario),
    fila("Stage", stagePropio)
  ];
  [deLoMio, deOtroProyecto, deUnUsuario, deUnStagePropio] = [
    en(filas, 0).id,
    en(filas, 1).id,
    en(filas, 2).id,
    en(filas, 3).id
  ];

  await db.insertInto("AuditLog").values(filas).execute();
});

afterAll(async () => {
  await db.destroy();
});

describe("GET /developer/audit-log · scope por proyecto", () => {
  it("el developer ve los eventos de SU proyecto", async () => {
    expect(await acciones(FIXTURES.activo)).toContain(deLoMio);
  });

  it("y también los de una entidad que cuelga de su proyecto", async () => {
    expect(await acciones(FIXTURES.activo)).toContain(deUnStagePropio);
  });

  it("NO ve los de un proyecto donde no es miembro", async () => {
    expect(await acciones(FIXTURES.activo)).not.toContain(deOtroProyecto);
  });

  it("NO ve los que no cuelgan de ningún proyecto", async () => {
    expect(await acciones(FIXTURES.activo)).not.toContain(deUnUsuario);
  });

  it("un developer sin ninguna membresía no ve ninguno de los cuatro", async () => {
    const vistos = await acciones(FIXTURES.ajeno);

    expect(vistos).not.toContain(deLoMio);
    expect(vistos).not.toContain(deOtroProyecto);
    expect(vistos).not.toContain(deUnStagePropio);
  });

  it("el admin los ve todos, incluidos los que no son de un proyecto", async () => {
    const vistos = await acciones(FIXTURES.admin);

    expect(vistos).toEqual(
      expect.arrayContaining([deLoMio, deOtroProyecto, deUnUsuario, deUnStagePropio])
    );
  });
});
