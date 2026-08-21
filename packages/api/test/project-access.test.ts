import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { ANY_MEMBERSHIP, canAccessProject } from "../src/middlewares/auth";
import { MEMBERSHIP_ROLES } from "../src/db/types";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

let miembro: string;
let ajeno: string;
let proyecto: string;

beforeAll(async () => {
  // `activo` es developer y MIEMBRO del proyecto de prueba; `ajeno` es developer
  // sin membresía. La diferencia entre los dos es la segunda capa entera.
  miembro = (
    await db.selectFrom("User").selectAll().where("email", "=", FIXTURES.activo.email).executeTakeFirstOrThrow()
  ).id;
  ajeno = (
    await db.selectFrom("User").selectAll().where("email", "=", FIXTURES.ajeno.email).executeTakeFirstOrThrow()
  ).id;
  proyecto = (
    await db
      .selectFrom("Project")
      .selectAll()
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
});

afterAll(async () => {
  await db.destroy();
});

// specs/SPEC-010 §Casos borde · middlewares/auth.ts. Es la función 🔴 por
// excelencia: cada rama tiene su caso, ninguna se da por inferida.
describe("canAccessProject", () => {
  it("acepta al miembro cuando su membresía está en la lista", async () => {
    expect(await canAccessProject(miembro, "developer", proyecto, ["developer"]))
      .toBe(true);
  });

  it("rechaza al miembro cuando su membresía NO está en la lista", async () => {
    // Este es el caso que el default fail-open silenciaba: quien pedía "solo
    // verifier" y se olvidaba del argumento recibía a este developer igual.
    expect(await canAccessProject(miembro, "developer", proyecto, ["verifier"]))
      .toBe(false);
  });

  it("rechaza a un usuario sin membresía en el proyecto", async () => {
    expect(await canAccessProject(ajeno, "developer", proyecto, ANY_MEMBERSHIP)).toBe(false);
  });

  it("acepta al miembro con ANY_MEMBERSHIP", async () => {
    expect(await canAccessProject(miembro, "developer", proyecto, ANY_MEMBERSHIP)).toBe(true);
  });

  it("un admin sin membresía pasa igual — el bypass de la matriz de M2-D1 §4", async () => {
    expect(await canAccessProject(ajeno, "admin", proyecto, ["verifier"]))
      .toBe(true);
  });

  it("una lista vacía no acepta a nadie", async () => {
    // `{ in: [] }` no matchea nada. Es el sentido correcto de "no permití
    // ninguna membresía", y es lo contrario de lo que hacía omitir el argumento.
    expect(await canAccessProject(miembro, "developer", proyecto, [])).toBe(false);
  });

  it("ANY_MEMBERSHIP cubre el enum entero", async () => {
    // La lista está escrita a mano y el `satisfies Record<MembershipRole, true>`
    // la obliga a estar completa: agregar una membresía al schema sin tocarla no
    // compila (verificado metiendo `notary` en el enum a propósito). Este test es
    // el segundo cerrojo, para el caso de que alguien saque el `satisfies`.
    expect([...ANY_MEMBERSHIP].sort()).toEqual([...MEMBERSHIP_ROLES].sort());
  });

  it("no compila si se omite qué membresías acepta", () => {
    // Lo verifica el TYPECHECK, no el runtime: si el 4º parámetro volviera a ser
    // opcional, tsc falla con "Unused '@ts-expect-error' directive". La llamada
    // está adentro de una función que nunca se invoca, a propósito.
    const nuncaSeLlama = () =>
      // @ts-expect-error — el 4º parámetro es obligatorio (D-042)
      canAccessProject(miembro, "developer", proyecto);

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

// La otra mitad de "una sola regla": el listado. Antes tenía su propio query de
// membresías, así que estos casos no estaban cubiertos por ningún test.
describe("GET /api/v1/projects · el listado usa la misma regla", () => {
  const login = (email: string, password: string) =>
    request(app).post("/api/v1/auth/login").send({ email, password });

  const listar = async (f: { email: string; password: string }) => {
    const { body } = await login(f.email, f.password);
    return request(app).get("/api/v1/projects").set("Authorization", `Bearer ${body.token}`);
  };

  it("un miembro ve su proyecto y NO ve el ajeno", async () => {
    const res = await listar(FIXTURES.activo);

    expect(res.status).toBe(200);
    expect(res.body.map((p: { slug: string }) => p.slug)).toEqual([FIXTURES.proyecto.slug]);
  });

  it("un proyecto con dos membresías del mismo usuario aparece UNA vez", async () => {
    // `activo` es developer Y buyer del proyecto de prueba. El listado viejo
    // mapeaba membresías a proyectos, así que lo devolvía duplicado.
    const res = await listar(FIXTURES.activo);

    const torres = res.body.filter((p: { slug: string }) => p.slug === FIXTURES.proyecto.slug);
    expect(torres).toHaveLength(1);
  });

  it("un usuario sin ninguna membresía no ve nada", async () => {
    const res = await listar(FIXTURES.ajeno);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("un admin ve los dos proyectos, del más nuevo al más viejo", async () => {
    // El orden importa acá porque antes solo lo tenía la rama de admin: el
    // no-admin salía en orden de membresía, que no es un orden.
    const res = await listar(FIXTURES.admin);

    expect(res.status).toBe(200);
    expect(res.body.map((p: { slug: string }) => p.slug)).toEqual([
      FIXTURES.otroProyecto.slug,
      FIXTURES.proyecto.slug,
    ]);
  });
});

describe("canAccessProject · un proyecto que no existe", () => {
  it("no se lo concede ni a un admin", async () => {
    // Cambio de comportamiento deliberado: antes `admin` devolvía true sin mirar
    // si el proyecto existía, porque el bypass cortaba antes del query. Ahora el
    // bypass es un filtro vacío sobre la misma consulta, así que "no existe"
    // responde igual para todos: 403 y no un 403/404 según quién pregunte.
    expect(await canAccessProject("cualquiera", "admin", "no-existe", ANY_MEMBERSHIP))
      .toBe(false);
  });
});
