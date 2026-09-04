import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// La tercera capa de la regla 5: el recurso es de quien lo pide (M2-D1
// §Cross-role data isolation). Vivió como un `if` copiado en nueve handlers
// hasta el 2026-09-04; acá se prueba una vez, en el middleware, con un caso por
// cada código de respuesta y por cada forma de `OwnerSource`.

let unidadPropia: string;
let unidadAjena: string;
let unidadSinDueño: string;
let invitacionAjena: string;
let invitacionPropia: string;

const tokenDe = async (f: { email: string; password: string }) =>
  (await request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password }))
    .body.token as string;

const idDe = async (email: string) =>
  (await db.selectFrom("User").select("id").where("email", "=", email).executeTakeFirstOrThrow())
    .id;

beforeAll(async () => {
  const ahora = new Date();
  const proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;

  unidadPropia = (
    await db
      .selectFrom("Unit")
      .select("id")
      .where("unitReference", "=", FIXTURES.unidad.unitReference)
      .executeTakeFirstOrThrow()
  ).id;

  // El dueño de la unidad ajena es un usuario cualquiera que NO es el investor
  // del elenco. Sirve el developer: la columna guarda un id de usuario y lo que
  // se prueba es la comparación, no el rol de quien figura como dueño.
  const otroDueño = await idDe(FIXTURES.activo.email);

  const unidad = (ref: string, investorId: string | null) => ({
    id: createId(),
    projectId: proyecto,
    unitReference: ref,
    status: investorId ? "sold" : "available",
    priceMinorUnits: 9_000_000,
    currency: "USD",
    investorId,
    createdAt: ahora,
    updatedAt: ahora
  });

  const ajena = unidad("OWN-AJENA", otroDueño);
  const sinDueño = unidad("OWN-LIBRE", null);
  unidadAjena = ajena.id;
  unidadSinDueño = sinDueño.id;
  await db.insertInto("Unit").values([ajena, sinDueño]).execute();

  // El contrato de la unidad ajena: `ContractOfUnit` resuelve la fila por
  // `unitId` y no por su clave primaria, así que el caso tiene que existir.
  await db
    .insertInto("Contract")
    .values({
      id: createId(),
      unitId: unidadAjena,
      investorId: otroDueño,
      totalMinorUnits: 9_000_000,
      currency: "USD",
      signedAt: ahora,
      createdAt: ahora
    })
    .execute();

  const invitacion = (email: string) => ({
    id: createId(),
    projectId: proyecto,
    unitId: unidadSinDueño,
    investorEmail: email,
    amountMinorUnits: 9_000_000,
    currency: "USD",
    status: "pending",
    createdAt: ahora
  });

  const ajenaInv = invitacion("nadie@test.local");
  const propiaInv = invitacion(FIXTURES.investor.email);
  invitacionAjena = ajenaInv.id;
  invitacionPropia = propiaInv.id;
  await db.insertInto("Invitation").values([ajenaInv, propiaInv]).execute();
});

afterAll(async () => {
  await db.destroy();
});

describe("requireOwnership · via Unit", () => {
  it("el dueño entra", async () => {
    const res = await request(app)
      .get(`/api/v1/investor/units/${unidadPropia}`)
      .set("Authorization", `Bearer ${await tokenDe(FIXTURES.investor)}`);

    expect(res.status).toBe(200);
    expect(res.body.unitReference).toBe(FIXTURES.unidad.unitReference);
  });

  it("un buyer que no es el dueño recibe 403", async () => {
    const res = await request(app)
      .get(`/api/v1/investor/units/${unidadAjena}`)
      .set("Authorization", `Bearer ${await tokenDe(FIXTURES.investor)}`);

    expect(res.status).toBe(403);
  });

  it("una unidad SIN dueño también es 403, no un pase libre", async () => {
    // `investorId` null es una unidad sin vender. La comparación suelta daba 403
    // por cómo se comporta `!==` con null; el middleware lo dice explícito, y
    // este test es lo que impide que alguien lo "simplifique" a `?? user.id`.
    const res = await request(app)
      .get(`/api/v1/investor/units/${unidadSinDueño}`)
      .set("Authorization", `Bearer ${await tokenDe(FIXTURES.investor)}`);

    expect(res.status).toBe(403);
  });

  it("una unidad inexistente es 404, con el mismo mensaje de antes", async () => {
    const res = await request(app)
      .get(`/api/v1/investor/units/${createId()}`)
      .set("Authorization", `Bearer ${await tokenDe(FIXTURES.investor)}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Unit not found");
  });

  it("el admin pasa por encima de la pertenencia", async () => {
    const res = await request(app)
      .get(`/api/v1/investor/units/${unidadAjena}`)
      .set("Authorization", `Bearer ${await tokenDe(FIXTURES.admin)}`);

    expect(res.status).toBe(200);
  });

  it("cubre las tres rutas del dossier, que autorizaban adentro de un helper", async () => {
    const token = `Bearer ${await tokenDe(FIXTURES.investor)}`;

    for (const ruta of [
      `/api/v1/investor/units/${unidadAjena}/dossier`,
      `/api/v1/investor/units/${unidadAjena}/dossier/export.pdf`
    ]) {
      expect((await request(app).get(ruta).set("Authorization", token)).status).toBe(403);
    }

    const share = await request(app)
      .post(`/api/v1/investor/units/${unidadAjena}/dossier/share`)
      .set("Authorization", token);
    expect(share.status).toBe(403);
  });

  it("y la de novedades", async () => {
    const res = await request(app)
      .get(`/api/v1/investor/units/${unidadAjena}/news`)
      .set("Authorization", `Bearer ${await tokenDe(FIXTURES.investor)}`);

    expect(res.status).toBe(403);
  });
});

describe("requireOwnership · via Invitation", () => {
  it("compara contra el EMAIL, no contra el id", async () => {
    // La invitación existe antes de que el investor tenga cuenta: se emite a un
    // email. Si esto comparara ids, ninguna invitación sería de nadie.
    const res = await request(app)
      .get(`/api/v1/investor/invitations/${invitacionPropia}`)
      .set("Authorization", `Bearer ${await tokenDe(FIXTURES.investor)}`);

    expect(res.status).toBe(200);
    expect(res.body.investorEmail).toBe(FIXTURES.investor.email);
  });

  it("la invitación de otro email es 403 en las tres rutas", async () => {
    const token = `Bearer ${await tokenDe(FIXTURES.investor)}`;

    const ver = await request(app)
      .get(`/api/v1/investor/invitations/${invitacionAjena}`)
      .set("Authorization", token);
    const acepta = await request(app)
      .post(`/api/v1/investor/invitations/${invitacionAjena}/accept`)
      .set("Authorization", token);
    const rechaza = await request(app)
      .post(`/api/v1/investor/invitations/${invitacionAjena}/decline`)
      .set("Authorization", token);

    expect([ver.status, acepta.status, rechaza.status]).toEqual([403, 403, 403]);
  });

  it("una invitación inexistente es 404", async () => {
    const res = await request(app)
      .get(`/api/v1/investor/invitations/${createId()}`)
      .set("Authorization", `Bearer ${await tokenDe(FIXTURES.investor)}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Invitation not found");
  });
});

describe("requireOwnership · via ContractOfUnit", () => {
  it("resuelve el contrato por unitId y deja pasar al dueño", async () => {
    const res = await request(app)
      .get(`/api/v1/investor/contracts/${unidadPropia}`)
      .set("Authorization", `Bearer ${await tokenDe(FIXTURES.investor)}`);

    expect(res.status).toBe(200);
  });

  it("el contrato de la unidad de otro es 403", async () => {
    const res = await request(app)
      .get(`/api/v1/investor/contracts/${unidadAjena}`)
      .set("Authorization", `Bearer ${await tokenDe(FIXTURES.investor)}`);

    expect(res.status).toBe(403);
  });

  it("una unidad sin contrato es 404 y dice Contract, no Unit", async () => {
    const res = await request(app)
      .get(`/api/v1/investor/contracts/${unidadSinDueño}`)
      .set("Authorization", `Bearer ${await tokenDe(FIXTURES.investor)}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Contract not found");
  });
});
