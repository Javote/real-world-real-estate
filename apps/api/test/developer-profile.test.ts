import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// SPEC-220 · `GET /projects/:id/developer` — el perfil de la organización
// desarrolladora (capturas 59-60 de M2-D2).
//
// Lo que estos tests fijan, y por qué cada uno:
//
//   - Las estadísticas se **derivan** del registro. Si alguna vez alguien las
//     guarda en columnas, estos tests siguen pasando solo si las mantiene
//     coherentes — que es justamente lo que no queremos tener que mantener.
//   - **No hay `rating`** (D-094). El test lo asienta explícitamente: un campo
//     que reaparece en el schema rompe acá antes de llegar a una pantalla.
//   - La segunda capa de autorización vale para esta ruta como para toda otra
//     (regla 5): un usuario sin membresía en el proyecto recibe 403.

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

let organizacion: string;
let proyectoEntregado: string;
let proyectoActivo: string;
let tokenDev: string;
let tokenAjeno: string;
/** El proyecto compartido de la suite, que NO tiene organización. */
let proyectoSinOrg: string;

beforeAll(async () => {
  tokenDev = (await login(FIXTURES.activo)).body.token;
  tokenAjeno = (await login(FIXTURES.ajeno)).body.token;

  const ahora = new Date();
  organizacion = createId();
  await db
    .insertInto("Organization")
    .values({
      id: organizacion,
      name: "Grupo Perfil",
      slug: `grupo-perfil-${organizacion}`,
      bio: "Una bio cualquiera.",
      foundedYear: ahora.getUTCFullYear() - 12,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();

  const developer = await db
    .selectFrom("User")
    .select("id")
    .where("email", "=", FIXTURES.activo.email)
    .executeTakeFirstOrThrow();

  const crearProyecto = async (slug: string, status: "completed" | "in_progress") => {
    const id = createId();
    await db
      .insertInto("Project")
      .values({
        id,
        name: slug,
        slug,
        address: null,
        city: "Buenos Aires",
        country: "Argentina",
        latitude: null,
        longitude: null,
        totalUnits: 2,
        estimatedDelivery: null,
        status,
        organizationId: organizacion,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();
    await db
      .insertInto("ProjectMember")
      .values({
        id: createId(),
        userId: developer.id,
        projectId: id,
        membershipRole: "developer",
        createdAt: ahora
      })
      .execute();
    return id;
  };

  proyectoEntregado = await crearProyecto(`perfil-entregado-${organizacion}`, "completed");
  proyectoActivo = await crearProyecto(`perfil-activo-${organizacion}`, "in_progress");

  const inversor = await db
    .selectFrom("User")
    .select("id")
    .where("email", "=", FIXTURES.investor.email)
    .executeTakeFirstOrThrow();

  // Dos unidades vendidas al MISMO inversor en el proyecto entregado, más una
  // disponible: así "unitsSold" y "investors" no pueden salir del mismo conteo
  // por casualidad — son 2 y 1.
  const crearUnidad = async (
    projectId: string,
    ref: string,
    status: "sold" | "available",
    precio: number,
    metros: number
  ) => {
    await db
      .insertInto("Unit")
      .values({
        id: createId(),
        projectId,
        unitReference: ref,
        status,
        floor: 1,
        sizeM2: metros,
        priceMinorUnits: precio,
        currency: "USD",
        investorId: status === "sold" ? inversor.id : null,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();
  };

  await crearUnidad(proyectoEntregado, "A-1", "sold", 30_000_000, 60);
  await crearUnidad(proyectoEntregado, "A-2", "sold", 45_000_000, 150);
  await crearUnidad(proyectoActivo, "B-1", "available", 31_000_000, 80);

  proyectoSinOrg = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
});

afterAll(async () => {
  await db
    .deleteFrom("Unit")
    .where("projectId", "in", [proyectoEntregado, proyectoActivo])
    .execute();
  await db
    .deleteFrom("ProjectMember")
    .where("projectId", "in", [proyectoEntregado, proyectoActivo])
    .execute();
  await db.deleteFrom("Project").where("organizationId", "=", organizacion).execute();
  await db.deleteFrom("Organization").where("id", "=", organizacion).execute();
});

describe("GET /projects/:id/developer", () => {
  it("devuelve la organización con sus estadísticas derivadas", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${proyectoEntregado}/developer`)
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    expect(res.body.organization.name).toBe("Grupo Perfil");
    expect(res.body.stats).toMatchObject({
      projectsDelivered: 1,
      unitsSold: 2,
      // Dos unidades, un solo comprador: el conteo es de personas, no de ventas.
      investors: 1,
      yearsInBusiness: 12
    });
  });

  it("parte las obras en previas y activas por su estado", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${proyectoActivo}/developer`)
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    expect(res.body.previousProjects).toHaveLength(1);
    expect(res.body.activeProjects).toHaveLength(1);
    expect(res.body.previousProjects[0].id).toBe(proyectoEntregado);
    expect(res.body.activeProjects[0].id).toBe(proyectoActivo);
  });

  it("agrega el precio desde y el rango de metros de cada obra", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${proyectoEntregado}/developer`)
      .set("Authorization", `Bearer ${tokenDev}`);

    const entregado = res.body.previousProjects[0];
    expect(entregado.priceFromMinorUnits).toBe(30_000_000);
    expect(entregado.priceCurrency).toBe("USD");
    expect(entregado.sizeMinM2).toBe(60);
    expect(entregado.sizeMaxM2).toBe(150);
  });

  it("**no** devuelve rating ni conteo de inversores como reputación (D-094)", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${proyectoEntregado}/developer`)
      .set("Authorization", `Bearer ${tokenDev}`);

    // El schema es estricto, así que un `rating` que reaparezca rompe el
    // `.parse()` antes que esta aserción — este test existe para que el
    // motivo quede escrito al lado, no solo en una migración.
    expect(res.body.organization).not.toHaveProperty("rating");
    expect(res.body.stats).not.toHaveProperty("rating");
  });

  it("404 si el proyecto no tiene organización", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${proyectoSinOrg}/developer`)
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(404);
  });

  it("403 si quien pide no es miembro del proyecto", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${proyectoEntregado}/developer`)
      .set("Authorization", `Bearer ${tokenAjeno}`);

    expect(res.status).toBe(403);
  });

  it("401 sin sesión", async () => {
    const res = await request(app).get(`/api/v1/projects/${proyectoEntregado}/developer`);
    expect(res.status).toBe(401);
  });
});
