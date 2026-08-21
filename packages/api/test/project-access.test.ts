import { MembershipRole, UserRole } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { ANY_MEMBERSHIP, canAccessProject } from "../src/middlewares/auth";
import { prisma } from "../src/lib/prisma";
import { FIXTURES } from "./global-setup";

let miembro: string;
let ajeno: string;
let proyecto: string;

beforeAll(async () => {
  // `activo` es developer y MIEMBRO del proyecto de prueba; `ajeno` es developer
  // sin membresía. La diferencia entre los dos es la segunda capa entera.
  miembro = (await prisma.user.findUniqueOrThrow({ where: { email: FIXTURES.activo.email } })).id;
  ajeno = (await prisma.user.findUniqueOrThrow({ where: { email: FIXTURES.ajeno.email } })).id;
  proyecto = (await prisma.project.findUniqueOrThrow({ where: { slug: FIXTURES.proyecto.slug } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

// specs/SPEC-010 §Casos borde · middlewares/auth.ts. Es la función 🔴 por
// excelencia: cada rama tiene su caso, ninguna se da por inferida.
describe("canAccessProject", () => {
  it("acepta al miembro cuando su membresía está en la lista", async () => {
    expect(await canAccessProject(miembro, UserRole.developer, proyecto, [MembershipRole.developer]))
      .toBe(true);
  });

  it("rechaza al miembro cuando su membresía NO está en la lista", async () => {
    // Este es el caso que el default fail-open silenciaba: quien pedía "solo
    // verifier" y se olvidaba del argumento recibía a este developer igual.
    expect(await canAccessProject(miembro, UserRole.developer, proyecto, [MembershipRole.verifier]))
      .toBe(false);
  });

  it("rechaza a un usuario sin membresía en el proyecto", async () => {
    expect(await canAccessProject(ajeno, UserRole.developer, proyecto, ANY_MEMBERSHIP)).toBe(false);
  });

  it("acepta al miembro con ANY_MEMBERSHIP", async () => {
    expect(await canAccessProject(miembro, UserRole.developer, proyecto, ANY_MEMBERSHIP)).toBe(true);
  });

  it("un admin sin membresía pasa igual — el bypass de la matriz de M2-D1 §4", async () => {
    expect(await canAccessProject(ajeno, UserRole.admin, proyecto, [MembershipRole.verifier]))
      .toBe(true);
  });

  it("una lista vacía no acepta a nadie", async () => {
    // `{ in: [] }` no matchea nada. Es el sentido correcto de "no permití
    // ninguna membresía", y es lo contrario de lo que hacía omitir el argumento.
    expect(await canAccessProject(miembro, UserRole.developer, proyecto, [])).toBe(false);
  });

  it("ANY_MEMBERSHIP cubre el enum entero", async () => {
    // La lista está escrita a mano y el `satisfies Record<MembershipRole, true>`
    // la obliga a estar completa: agregar una membresía al schema sin tocarla no
    // compila (verificado metiendo `notary` en el enum a propósito). Este test es
    // el segundo cerrojo, para el caso de que alguien saque el `satisfies`.
    expect([...ANY_MEMBERSHIP].sort()).toEqual([...Object.values(MembershipRole)].sort());
  });

  it("no compila si se omite qué membresías acepta", () => {
    // Lo verifica el TYPECHECK, no el runtime: si el 4º parámetro volviera a ser
    // opcional, tsc falla con "Unused '@ts-expect-error' directive". La llamada
    // está adentro de una función que nunca se invoca, a propósito.
    const nuncaSeLlama = () =>
      // @ts-expect-error — el 4º parámetro es obligatorio (D-042)
      canAccessProject(miembro, UserRole.developer, proyecto);

    expect(nuncaSeLlama).toBeTypeOf("function");
  });
});

// Los 7 call sites que antes omitían el parámetro son todos de LECTURA, y son
// los que este cambio tocó. La suite de evidencia ya cubre que el miembro sigue
// leyendo; falta el otro lado: que el que no es miembro siga afuera.
describe("los endpoints de lectura siguen exigiendo membresía", () => {
  const login = (email: string, password: string) =>
    request(app).post("/api/v1/auth/login").send({ email, password });

  const tokenDe = async (f: { email: string; password: string }) =>
    (await login(f.email, f.password)).body.token as string;

  it("un developer sin membresía no lee el detalle del proyecto", async () => {
    const token = await tokenDe(FIXTURES.ajeno);

    const res = await request(app)
      .get(`/api/v1/projects/${proyecto}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("un developer sin membresía no lista la evidencia del proyecto", async () => {
    const token = await tokenDe(FIXTURES.ajeno);

    const res = await request(app)
      .get(`/api/v1/projects/${proyecto}/evidence`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("el miembro sí lee el detalle del proyecto", async () => {
    // El control: sin esto, los dos de arriba pasarían igual si ANY_MEMBERSHIP
    // hubiera quedado cerrando de más y el endpoint devolviera 403 a todo el mundo.
    const token = await tokenDe(FIXTURES.activo);

    const res = await request(app)
      .get(`/api/v1/projects/${proyecto}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});
