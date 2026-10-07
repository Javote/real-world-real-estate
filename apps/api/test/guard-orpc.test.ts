import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import app from "../src/app.js";
import { createId } from "../src/db/id.js";
import { db } from "../src/lib/db.js";
import { signToken } from "../src/lib/jwt.js";
import { call, os } from "../src/lib/orpc.js";
import { leerRouterOrpc, matrizViva, rutasConGuards } from "../src/lib/route-inventory.js";
import { ANY_MEMBERSHIP, CUALQUIER_ROL } from "../src/middlewares/auth.js";
import { guardOrpc, type MetaDeProcedimiento } from "../src/middlewares/guard-orpc.js";
import type { Contexto } from "../src/platform/contexto.js";
import { procedimiento } from "../src/platform/procedimiento.js";
import { montarRouter } from "../src/platform/router.js";
import { FIXTURES } from "./global-setup.js";

// El Paso 0 de SPEC-607: un router de prueba, que no se publica, para fijar cómo se comporta el guard
// de los procedimientos oRPC antes de mudar ninguna ruta.

const conProyecto = procedimiento({
  roles: ["admin", "developer"],
  acceso: { proyecto: { param: "id" }, membresias: ["developer"] }
})
  .route({ method: "POST", path: "/prueba/proyectos/{id}" })
  .input(z.object({ id: z.string(), nombre: z.string().min(3) }))
  .handler(({ context, input }) => ({
    usuario: context.usuario?.email ?? null,
    proyectoId: context.proyectoId,
    nombre: input.nombre
  }));

const porEtapa = procedimiento({
  roles: CUALQUIER_ROL,
  acceso: { proyecto: { via: "Stage", param: "stageId" }, membresias: ANY_MEMBERSHIP }
})
  .route({ method: "GET", path: "/prueba/etapas/{stageId}" })
  .input(z.object({ stageId: z.string() }))
  .handler(({ context }) => ({ proyectoId: context.proyectoId }));

const enElBody = procedimiento({
  roles: ["admin", "developer"],
  acceso: { proyecto: { via: "Stage", param: "stageId", en: "body" }, membresias: ["developer"] }
})
  .route({ method: "POST", path: "/prueba/en-body" })
  .input(z.object({ stageId: z.string() }))
  .handler(() => ({ ok: true }));

const publico = procedimiento({ sinSesion: true })
  .route({ method: "GET", path: "/prueba/publico" })
  .handler(({ context }) => ({ usuario: context.usuario, hora: context.clock().toISOString() }));

const sinGuard = os
  .$context<Contexto>()
  .$meta<MetaDeProcedimiento>({})
  .use(guardOrpc)
  .route({ method: "GET", path: "/prueba/sin-guard" })
  .handler(() => "no debería llegar");

const soloAdmin = procedimiento({ roles: ["admin"], acceso: "soloRol" })
  .route({ method: "GET", path: "/prueba/solo-admin" })
  .handler(({ context }) => ({ proyectoId: context.proyectoId }));

// La regla pide un param que la ruta no trae: el input llega vacío.
const sinInput = procedimiento({
  roles: ["admin"],
  acceso: { proyecto: { param: "id" }, membresias: ["developer"] }
})
  .route({ method: "GET", path: "/prueba/sin-input" })
  .handler(() => null);

const router = { prueba: { conProyecto, porEtapa, enElBody, publico } };

const servidor = express();
servidor.use(express.json());
servidor.use(montarRouter({ ...router, sinGuard, soloAdmin, sinInput }));
servidor.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

let proyecto: string;
let etapa: string;
let etapaAjena: string;
const token: Record<"activo" | "ajeno" | "investor" | "admin", string> = {
  activo: "",
  ajeno: "",
  investor: "",
  admin: ""
};

beforeAll(async () => {
  const idDe = async (slug: string) =>
    (await db.selectFrom("Project").select("id").where("slug", "=", slug).executeTakeFirstOrThrow())
      .id;
  proyecto = await idDe(FIXTURES.proyecto.slug);

  // Los proyectos del seed de test no tienen etapas: una en cada uno, para resolver por entidad.
  const crearEtapa = async (projectId: string) => {
    const id = createId();
    const ahora = new Date();
    await db
      .insertInto("Stage")
      .values({
        id,
        projectId,
        name: "Etapa del guard",
        sequenceOrder: 99,
        state: "Pending",
        validationCritical: false,
        certifiedAt: null,
        certifiedById: null,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();
    return id;
  };
  etapa = await crearEtapa(proyecto);
  etapaAjena = await crearEtapa(await idDe(FIXTURES.otroProyecto.slug));

  for (const quien of Object.keys(token) as (keyof typeof token)[]) {
    const { email, password } = FIXTURES[quien];
    token[quien] = (
      await request(app).post("/api/v1/auth/login").send({ email, password })
    ).body.token;
  }
});

afterAll(async () => {
  await db.destroy();
});

const post = (path: string, quien?: keyof typeof token) => {
  const r = request(servidor).post(`/api/v1${path}`);
  return quien ? r.set("Authorization", `Bearer ${token[quien]}`) : r;
};

describe("Paso 0 — el guard corre antes que la validación del input (SPEC-607 invariante 2)", () => {
  const invalido = { nombre: "x" };

  it("sin sesión, 401 aunque el body sea inválido", async () => {
    const r = await post(`/prueba/proyectos/${proyecto}`).send(invalido);
    expect(r.status).toBe(401);
    expect(r.body.message).toBe("Missing or invalid token");
  });

  it("con un token que no verifica, 401 Invalid token", async () => {
    const r = await request(servidor)
      .post(`/api/v1/prueba/proyectos/${proyecto}`)
      .set("Authorization", "Bearer basura")
      .send(invalido);
    expect(r.status).toBe(401);
    expect(r.body.message).toBe("Invalid token");
  });

  it("con un usuario inactivo, 401 User not active", async () => {
    const inactivo = await db
      .selectFrom("User")
      .select(["id", "email", "role"])
      .where("email", "=", FIXTURES.inactivo.email)
      .executeTakeFirstOrThrow();
    const r = await request(servidor)
      .post(`/api/v1/prueba/proyectos/${proyecto}`)
      .set(
        "Authorization",
        `Bearer ${signToken({ userId: inactivo.id, role: inactivo.role, email: inactivo.email })}`
      )
      .send(invalido);
    expect(r.status).toBe(401);
    expect(r.body.message).toBe("User not active");
  });

  it("con un rol sin permiso, 403 antes que el 400", async () => {
    const r = await post(`/prueba/proyectos/${proyecto}`, "investor").send(invalido);
    expect(r.status).toBe(403);
    expect(r.body.message).toBe("Forbidden");
  });

  it("con el rol pero sin membresía en el proyecto, 403 antes que el 400", async () => {
    const r = await post(`/prueba/proyectos/${proyecto}`, "ajeno").send(invalido);
    expect(r.status).toBe(403);
  });

  it("con permiso, recién ahí el 400 del schema", async () => {
    const r = await post(`/prueba/proyectos/${proyecto}`, "activo").send(invalido);
    expect(r.status).toBe(400);
  });

  it("con permiso y body válido, el handler recibe al usuario y el proyecto en el contexto", async () => {
    const r = await post(`/prueba/proyectos/${proyecto}`, "activo").send({ nombre: "torre" });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      usuario: FIXTURES.activo.email,
      proyectoId: proyecto,
      nombre: "torre"
    });
  });
});

describe("guardOrpc — los mismos veredictos que authorize", () => {
  it("una entidad que no existe es 404 con su nombre", async () => {
    const r = await request(servidor)
      .get("/api/v1/prueba/etapas/no-existe")
      .set("Authorization", `Bearer ${token.activo}`);
    expect(r.status).toBe(404);
    expect(r.body.message).toBe("Stage not found");
  });

  it("por la entidad, deja en el contexto el proyecto al que pertenece", async () => {
    const r = await request(servidor)
      .get(`/api/v1/prueba/etapas/${etapa}`)
      .set("Authorization", `Bearer ${token.activo}`);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ proyectoId: proyecto });
  });

  it("una entidad de un proyecto ajeno es 403", async () => {
    const r = await request(servidor)
      .get(`/api/v1/prueba/etapas/${etapaAjena}`)
      .set("Authorization", `Bearer ${token.activo}`);
    expect(r.status).toBe(403);
  });

  it("un param que falta en el body es 400 con su nombre, antes de validar", async () => {
    const r = await post("/prueba/en-body", "activo").send({});
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('Missing or invalid "stageId"');
  });

  it("el admin pasa por un param del body sin membresía", async () => {
    const r = await post("/prueba/en-body", "admin").send({ stageId: etapa });
    expect(r.status).toBe(200);
  });

  it("una regla sin proyecto deja el proyecto del contexto en null", async () => {
    const r = await request(servidor)
      .get("/api/v1/prueba/solo-admin")
      .set("Authorization", `Bearer ${token.admin}`);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ proyectoId: null });
  });

  it("sin input, el param de la regla falta: 400 con su nombre", async () => {
    const r = await request(servidor)
      .get("/api/v1/prueba/sin-input")
      .set("Authorization", `Bearer ${token.admin}`);
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('Missing or invalid "id"');
  });

  it("una ruta sinSesion no pide token, y el usuario es null", async () => {
    const r = await request(servidor).get("/api/v1/prueba/publico");
    expect(r.status).toBe(200);
    expect(r.body.usuario).toBeNull();
  });

  it("un procedimiento sin guard no pasa: 500, cerrado", async () => {
    const r = await request(servidor).get("/api/v1/prueba/sin-guard");
    expect(r.status).toBe(500);
    expect(r.body.message).toBe("Route misconfiguration: procedure without guard");
  });

  it("lo que el router no conoce sigue a Express", async () => {
    const r = await request(servidor).get("/api/v1/no-es-de-orpc");
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ message: "Not found" });
  });
});

describe("el contexto se inyecta: un test llama al procedimiento sin HTTP", () => {
  it("con call() y un reloj propio", async () => {
    const contexto = { clock: () => new Date(0), authorization: undefined } as unknown as Contexto;
    expect(await call(publico, undefined, { context: contexto })).toEqual({
      usuario: null,
      hora: "1970-01-01T00:00:00.000Z"
    });
  });
});

describe("el inventario lee el router oRPC con la forma de Express", () => {
  it("cada procedimiento con su método, su path y su guard", () => {
    const matriz = Object.fromEntries(
      [...leerRouterOrpc(router)].map(([clave, guards]) => [clave, guards.length])
    );
    expect(matriz).toEqual({
      "POST /api/v1/prueba/proyectos/:id": 2,
      "GET /api/v1/prueba/etapas/:stageId": 2,
      "POST /api/v1/prueba/en-body": 2,
      "GET /api/v1/prueba/publico": 0
    });
  });

  it("y la matriz los describe como a las rutas de Express", () => {
    const viva = matrizViva(router);
    expect(viva["POST /api/v1/prueba/proyectos/:id"]).toBe(
      "auth + autoriza(rol(admin|developer) · proyecto(id → developer))"
    );
    expect(viva["POST /api/v1/prueba/en-body"]).toBe(
      "auth + autoriza(rol(admin|developer) · proyecto(Stage:stageId@body → developer))"
    );
    expect(viva["GET /api/v1/prueba/publico"]).toBe("—");
  });

  it("sin `.route()`, oRPC lo atiende como POST en la raíz del prefijo", () => {
    const sinRuta = procedimiento({ sinSesion: true }).handler(() => null);
    expect([...leerRouterOrpc({ sinRuta }).keys()]).toEqual(["POST /api/v1"]);
  });

  it("un procedimiento sin guard no entra a la matriz", () => {
    expect(() => leerRouterOrpc({ sinGuard })).toThrow(
      "GET /api/v1/prueba/sin-guard no declara guard"
    );
  });

  it("una ruta en Express y en oRPC a la vez es un error", () => {
    const duplicada = procedimiento({ sinSesion: true })
      .route({ method: "POST", path: "/auth/login" })
      .handler(() => null);
    expect(() => rutasConGuards({ duplicada })).toThrow(
      "POST /api/v1/auth/login está en Express y en el router oRPC"
    );
  });
});
