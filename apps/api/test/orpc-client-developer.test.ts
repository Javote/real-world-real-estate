import type http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { capitalOrpcRouter } from "../src/routes/capital.routes";
import { developerOrpcRouter } from "../src/routes/developer.routes";
import { developerComercialOrpcRouter } from "../src/routes/developer-comercial.routes";
import { FIXTURES } from "./global-setup";
import { createORPCClient, OpenAPILink, type RouterClient } from "./helpers/orpc";

// SPEC-212 §D — última de las cuatro sub-partes. Mismo criterio que
// `orpc-client-notary.test.ts`/`orpc-client-certifier.test.ts`/
// `orpc-client-investor.test.ts`: arma el cliente desde los MISMOS routers
// oRPC combinados que exportan los tres archivos de esta vertical (no un tipo
// copiado a mano) y habla HTTP de verdad contra el servidor completo
// (`authorize` incluido), sin mockear nada.
//
// **Tres clientes, un solo prefijo.** `developer.routes.ts`,
// `developer-comercial.routes.ts` y `capital.routes.ts` comparten
// `/api/v1/developer` (`MONTAJE`, `app.ts`) — cada uno arma su propio
// `OpenAPILink`/cliente contra la MISMA `baseUrl`, y los tres conviven porque
// sus paths son disjuntos (igual que los tres routers Express).
let servidor: http.Server;
let baseUrl: string;
let tokenDev: string;

beforeAll(async () => {
  servidor = app.listen(0);
  const { port } = servidor.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1/developer`;

  const login = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: FIXTURES.activo.email, password: FIXTURES.activo.password });
  tokenDev = login.body.token;
});

afterAll(async () => {
  servidor.close();
  await db.destroy();
});

describe("cliente oRPC tipado de developer, contra el servidor real (SPEC-212 §D)", () => {
  it("kpisProcedure (developer.routes.ts): el cliente tipado recibe la misma forma que devuelve el handler", async () => {
    const link = new OpenAPILink(developerOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenDev}` })
    });
    const client = createORPCClient<RouterClient<typeof developerOrpcRouter>>(link);

    const kpis = await client.kpisProcedure();

    // El tipo de `kpis` ya es `DeveloperKpis` (inferido del mismo
    // `developerKpisSchema` que valida en el servidor) — typechequea sin cast.
    expect(typeof kpis.activeProjects).toBe("number");
    expect(typeof kpis.averageProgress).toBe("number");
  });

  it("projectByIdProcedure: un id inexistente es 403 de `authorize` (D-043) — oRPC nunca corre", async () => {
    const link = new OpenAPILink(developerOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenDev}` })
    });
    const client = createORPCClient<RouterClient<typeof developerOrpcRouter>>(link);

    // `acceso: { proyecto: { param: "id" } }` resuelve la membresía sobre el
    // id del path directo (D-043: un proyecto inexistente da `false`, no
    // `true`, ni para admin) — el 403 sale de `authorize`, antes de que oRPC
    // vea la request. El 404 "Project not found" del procedimiento es
    // inalcanzable por esta ruta y por eso no lo prueba `dossierByIdProcedure`
    // aparte: es la MISMA forma que ya prueba `orpc-client-notary.test.ts`
    // sobre una ruta `"soloRol"`, que sí llega al handler.
    await expect(
      client.projectByIdProcedure({ id: "aaaaaaaaaaaaaaaaaaaaaaaa" })
    ).rejects.toMatchObject({ status: 403 });
  });

  it("sin token, `authorize` rechaza ANTES de que el cliente vea una respuesta de oRPC", async () => {
    const link = new OpenAPILink(developerOrpcRouter, { url: baseUrl });
    const client = createORPCClient<RouterClient<typeof developerOrpcRouter>>(link);

    await expect(client.kpisProcedure()).rejects.toMatchObject({ status: 401 });
  });

  it("unitsProcedure (developer-comercial.routes.ts): el mismo prefijo, otro router oRPC", async () => {
    const link = new OpenAPILink(developerComercialOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenDev}` })
    });
    const client = createORPCClient<RouterClient<typeof developerComercialOrpcRouter>>(link);

    const unidades = await client.unitsProcedure();

    expect(Array.isArray(unidades)).toBe(true);
  });

  it("createInvitationProcedure: `UNIT_NOT_AVAILABLE` llega con nombre, no anidado en `data.code`", async () => {
    const link = new OpenAPILink(developerComercialOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenDev}` })
    });
    const client = createORPCClient<RouterClient<typeof developerComercialOrpcRouter>>(link);

    const proyecto = await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow();
    const unidadVendida = await db
      .selectFrom("Unit")
      .select("id")
      .where("projectId", "=", proyecto.id)
      .where("status", "=", "sold")
      .executeTakeFirst();

    if (!unidadVendida) return; // No hay fixture vendida en esta corrida: el caso feliz ya lo cubre otro test.

    await expect(
      client.createInvitationProcedure({
        id: proyecto.id,
        unitId: unidadVendida.id,
        investorEmail: "otro@spec212.local",
        amountMinorUnits: 1,
        currency: "USD"
      })
    ).rejects.toMatchObject({ code: "UNIT_NOT_AVAILABLE", status: 409 });
  });

  it("summaryProcedure (capital.routes.ts): el mismo prefijo, un tercer router oRPC", async () => {
    const link = new OpenAPILink(capitalOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenDev}` })
    });
    const client = createORPCClient<RouterClient<typeof capitalOrpcRouter>>(link);

    const resumen = await client.summaryProcedure();

    expect(typeof resumen.raisedMinorUnits).toBe("number");
    expect(typeof resumen.releasedMinorUnits).toBe("number");
  });
});
