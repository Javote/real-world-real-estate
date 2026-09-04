import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// `GET /contracts/:contractId/releases` es la única regla disyuntiva de la API:
// la ve el dueño del contrato **o** cualquiera con membresía en el proyecto. Una
// cadena de middlewares es un AND, así que hasta el 2026-09-04 esto vivía adentro
// del handler. Cada rama tiene su caso acá, y el punto de los dos primeros es que
// pasan por caminos DISTINTOS: uno sin membresía, el otro sin ser dueño.

let contratoDeAjeno: string;

const tokenDe = async (f: { email: string; password: string }) =>
  (await request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password }))
    .body.token as string;

const releases = async (contrato: string, f: { email: string; password: string }) =>
  request(app)
    .get(`/api/v1/contracts/${contrato}/releases`)
    .set("Authorization", `Bearer ${await tokenDe(f)}`);

beforeAll(async () => {
  const ahora = new Date();
  const proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;

  const dueñoSinMembresia = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.ajeno.email)
      .executeTakeFirstOrThrow()
  ).id;

  const unidad = createId();
  await db
    .insertInto("Unit")
    .values({
      id: unidad,
      projectId: proyecto,
      unitReference: "ALG-1",
      status: "sold",
      priceMinorUnits: 5_000_000,
      currency: "USD",
      investorId: dueñoSinMembresia,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();

  contratoDeAjeno = createId();
  await db
    .insertInto("Contract")
    .values({
      id: contratoDeAjeno,
      unitId: unidad,
      investorId: dueñoSinMembresia,
      totalMinorUnits: 5_000_000,
      currency: "USD",
      signedAt: ahora,
      createdAt: ahora
    })
    .execute();
});

afterAll(async () => {
  await db.destroy();
});

describe("authorize · acceso disyuntivo (alguna)", () => {
  it("pasa el DUEÑO aunque no tenga membresía en el proyecto", async () => {
    // `ajeno` no es miembro de ningún proyecto: si pasa, pasó por la rama del
    // dueño y por ninguna otra.
    expect((await releases(contratoDeAjeno, FIXTURES.ajeno)).status).toBe(200);
  });

  it("pasa el MIEMBRO aunque no sea el dueño", async () => {
    // `activo` es miembro del proyecto y el contrato es de otro: la rama
    // complementaria.
    expect((await releases(contratoDeAjeno, FIXTURES.activo)).status).toBe(200);
  });

  it("rechaza a quien no es ninguna de las dos cosas", async () => {
    // El notary no tiene membresía por proyecto (M2-D1 §4) y no es dueño: es el
    // control de que las dos ramas de arriba prueban algo.
    expect((await releases(contratoDeAjeno, FIXTURES.notario)).status).toBe(403);
  });

  it("el admin pasa", async () => {
    expect((await releases(contratoDeAjeno, FIXTURES.admin)).status).toBe(200);
  });

  it("un contrato inexistente da 404, no 403 — las dos ramas coinciden", async () => {
    const res = await releases(createId(), FIXTURES.notario);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Contract not found");
  });
});
