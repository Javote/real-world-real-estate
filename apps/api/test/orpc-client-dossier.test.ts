import type http from "node:http";
import type { AddressInfo } from "node:net";
import { type ApiClient, contrato } from "@plataforma/shared/contract";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { db } from "../src/lib/db.js";
import { FIXTURES } from "./global-setup.js";
import { createORPCClient, OpenAPILink } from "./helpers/orpc.js";

// El cliente que la web arma desde el contrato de `shared` (SPEC-609), contra el servidor real.
function cliente(token?: string) {
  const link = new OpenAPILink(contrato, {
    url: baseUrl,
    headers: () => (token ? { Authorization: `Bearer ${token}` } : {})
  });
  return createORPCClient<ApiClient>(link);
}

let servidor: http.Server;
let baseUrl: string;
let tokenNotario: string;
let shareToken: string;

beforeAll(async () => {
  servidor = app.listen(0);
  const { port } = servidor.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1`;

  const login = (f: { email: string; password: string }) =>
    request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });
  tokenNotario = (await login(FIXTURES.notario)).body.token;

  const unidad = await db
    .selectFrom("Unit")
    .select("id")
    .where("unitReference", "=", FIXTURES.unidad.unitReference)
    .executeTakeFirstOrThrow();
  const compartido = await request(app)
    .post(`/api/v1/investor/units/${unidad.id}/dossier/share`)
    .set("Authorization", `Bearer ${(await login(FIXTURES.investor)).body.token}`);
  shareToken = compartido.body.shareToken;
});

afterAll(async () => {
  servidor.close();
  await db.destroy();
});

describe("el cliente del contrato de dossier, contra el servidor real", () => {
  it("notary.kpis: recibe la misma forma que devuelve el handler", async () => {
    const kpis = await cliente(tokenNotario).dossier.notary.kpis();

    expect(typeof kpis.pendingDossiers).toBe("number");
    expect(typeof kpis.verified).toBe("number");
    expect(typeof kpis.signed).toBe("number");
    expect(typeof kpis.unitsUnderReview).toBe("number");
  });

  it("notary.porId: un id inexistente llega como el mismo 404 que ve `supertest`", async () => {
    await expect(
      cliente(tokenNotario).dossier.notary.porId({ id: "aaaaaaaaaaaaaaaaaaaaaaaa" })
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("sin token, el guard rechaza antes de que el handler conteste", async () => {
    await expect(cliente().dossier.notary.kpis()).rejects.toMatchObject({ status: 401 });
  });

  it("publico.dossier: sin ningún header, devuelve el dossier recortado", async () => {
    const dossier = await cliente().dossier.publico.dossier({ shareToken });

    expect(dossier.unitReference).toBe(FIXTURES.unidad.unitReference);
    expect(dossier).not.toHaveProperty("investorId");
    expect(dossier).not.toHaveProperty("unitId");
  });

  it("publico.dossier: un token bien formado que no existe es NOT_FOUND", async () => {
    await expect(
      cliente().dossier.publico.dossier({ shareToken: "a".repeat(64) })
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});
