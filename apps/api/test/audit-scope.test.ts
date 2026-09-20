import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { en } from "../src/lib/arrays";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// `GET /developer/audit-log` devolvía la tabla entera. El entregable dice lo
// contrario —M2-D1 §4 "developer sees project-scoped events", M2-D4 §P6 "all
// events scoped to that developer's projects"— y el agujero apareció al
// etiquetar la ruta, no por un reporte. Estos casos fijan las tres cosas que
// importan: se ve lo propio, NO se ve lo ajeno, y lo que no cuelga de un
// proyecto queda afuera.

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
    // El caso del join: el evento apunta a un Stage, y el Stage al proyecto.
    expect(await acciones(FIXTURES.activo)).toContain(deUnStagePropio);
  });

  it("NO ve los de un proyecto donde no es miembro", async () => {
    // El agujero, como test de regresión.
    expect(await acciones(FIXTURES.activo)).not.toContain(deOtroProyecto);
  });

  it("NO ve los que no cuelgan de ningún proyecto", async () => {
    // `User` no está en el mapeo a propósito: crear usuarios o cambiar roles no
    // pertenece a un proyecto. Fail-closed — un entityType que nadie mapeó no se
    // muestra, en vez de mostrarse a todos.
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
