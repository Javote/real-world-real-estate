import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { db } from "../src/lib/db.js";
import { crearGeocodificador, NOMINATIM_URL, USER_AGENT } from "../src/lib/geocode.js";
import { FIXTURES } from "./global-setup.js";

const LIBERTADOR = [
  { lat: "-34.5470", lon: "-58.4600", display_name: "Avenida del Libertador 7200, Núñez, CABA" }
];
const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

describe("crearGeocodificador", () => {
  it("devuelve el primer punto, con User-Agent propio y sesgo a CABA", async () => {
    const fetch = vi.fn(async () => respuesta(LIBERTADOR));
    const g = crearGeocodificador({ fetch, espaciado: 0 });

    expect(await g.buscar("  Av. del Libertador 7200 ")).toEqual({
      match: { latitude: -34.547, longitude: -58.46, label: LIBERTADOR[0]?.display_name }
    });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.startsWith(NOMINATIM_URL)).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get("q")).toBe("Av. del Libertador 7200");
    expect(params.get("countrycodes")).toBe("ar");
    expect(params.get("viewbox")).toBeTruthy();
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(USER_AGENT);
  });

  it("sin resultados es { match: null }, no un error", async () => {
    const g = crearGeocodificador({ fetch: async () => respuesta([]), espaciado: 0 });
    expect(await g.buscar("calle que no existe 99999")).toEqual({ match: null });
  });

  it("un HTTP de error, la red caída o un cuerpo ilegible son 'no disponible'", async () => {
    const http = crearGeocodificador({ fetch: async () => respuesta([], 429), espaciado: 0 });
    await expect(http.buscar("Corrientes 1234")).rejects.toThrow("HTTP 429");

    const red = crearGeocodificador({
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
      espaciado: 0
    });
    await expect(red.buscar("Corrientes 1234")).rejects.toThrow("sin respuesta (TypeError)");

    const raro = crearGeocodificador({
      fetch: async () => {
        throw "no es un Error";
      },
      espaciado: 0
    });
    await expect(raro.buscar("Corrientes 1234")).rejects.toThrow("sin respuesta (desconocido)");

    const ilegible = crearGeocodificador({
      fetch: async () => new Response("<html>", { status: 200 }),
      espaciado: 0
    });
    await expect(ilegible.buscar("Corrientes 1234")).rejects.toThrow("respuesta ilegible");
  });

  it("la misma dirección sale de la caché (sin distinguir mayúsculas), y un error no se cachea", async () => {
    let falla = true;
    const fetch = vi.fn(async () => {
      if (falla) {
        falla = false;
        return respuesta([], 500);
      }
      return respuesta(LIBERTADOR);
    });
    const g = crearGeocodificador({ fetch, espaciado: 0 });

    await expect(g.buscar("Libertador 7200")).rejects.toThrow();
    await g.buscar("Libertador 7200");
    await g.buscar("LIBERTADOR 7200");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("encola los pedidos: nunca dos a Nominatim con menos de `espaciado` entre sí", async () => {
    const momentos: number[] = [];
    const fetch = vi.fn(async () => {
      momentos.push(Date.now());
      return respuesta(LIBERTADOR);
    });
    const g = crearGeocodificador({ fetch, espaciado: 120 });

    await Promise.all([g.buscar("uno 111"), g.buscar("dos 222"), g.buscar("tres 333")]);
    expect(momentos).toHaveLength(3);
    expect((momentos[1] ?? 0) - (momentos[0] ?? 0)).toBeGreaterThanOrEqual(110);
    expect((momentos[2] ?? 0) - (momentos[1] ?? 0)).toBeGreaterThanOrEqual(110);
  });

  it("la caché tiene tope: al llenarse, sale la más vieja", async () => {
    const fetch = vi.fn(async () => respuesta(LIBERTADOR));
    const g = crearGeocodificador({ fetch, espaciado: 0, tamanoCache: 1 });

    await g.buscar("primera 111");
    await g.buscar("segunda 222");
    await g.buscar("primera 111");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

describe("GET /api/v1/developer/geocode", () => {
  const login = (f: { email: string; password: string }) =>
    request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });
  let tokenDev: string;
  let tokenInvestor: string;

  beforeAll(async () => {
    tokenDev = (await login(FIXTURES.activo)).body.token;
    tokenInvestor = (await login(FIXTURES.investor)).body.token;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  afterAll(async () => {
    await db.destroy();
  });

  const pedir = (q: string, token = tokenDev) =>
    request(app)
      .get("/api/v1/developer/geocode")
      .query({ q })
      .set("Authorization", `Bearer ${token}`);

  it("200 con el punto encontrado", async () => {
    vi.stubGlobal("fetch", async () => respuesta(LIBERTADOR));
    const res = await pedir("Av. del Libertador 7200, CABA");
    expect(res.status).toBe(200);
    expect(res.body.match).toMatchObject({ latitude: -34.547, longitude: -58.46 });
  });

  it("503 con nombre si Nominatim no responde", async () => {
    vi.stubGlobal("fetch", async () => respuesta([], 503));
    const res = await pedir("Florida 100, CABA");
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("GEOCODER_UNAVAILABLE");
  });

  it("400 si la dirección es demasiado corta", async () => {
    const res = await pedir("ab");
    expect(res.status).toBe(400);
  });

  it("403 para un rol que no crea proyectos", async () => {
    const res = await pedir("Florida 200, CABA", tokenInvestor);
    expect(res.status).toBe(403);
  });
});
