import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// SPEC-017 §Branches — ramas de `developer.routes.ts` sin ejercitar: crear un
// proyecto con `estimatedDelivery`, el atajo de "sin proyectos visibles" en
// progress/documents/kpis (un developer sin ninguna membresía, `FIXTURES.
// ajeno`), el filtro de categoría y de cursor del audit log, y el `?? 0`
// sobre `SUM(Contract.totalMinorUnits)` — que a diferencia de los `COUNT` de
// este mismo archivo, SÍ puede dar `NULL` (cero contratos) y necesita su
// propio caso.

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

let tokenDev: string;
let tokenAjeno: string;
let tokenSolo: string;

beforeAll(async () => {
  tokenDev = (await login(FIXTURES.activo)).body.token;
  tokenAjeno = (await login(FIXTURES.ajeno)).body.token;

  // Un developer nuevo, SIN ninguna membresía previa — a diferencia de
  // `FIXTURES.activo`, que ya es miembro de `torre-test` (con un contrato de
  // 12.000.000): para aislar el `SUM` en `NULL` de verdad, el único proyecto
  // visible tiene que ser el que este test crea.
  const tokenAdmin = (await login(FIXTURES.admin)).body.token;
  const email = `spec-017-solo-${Date.now()}@test.local`;
  await request(app)
    .post("/api/v1/users")
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({ email, password: "spec-017-password-larga", role: "developer", fullName: "Solo" });
  tokenSolo = (await login({ email, password: "spec-017-password-larga" })).body.token;
});

afterAll(async () => {
  await db.destroy();
});

describe("POST /developer/projects con estimatedDelivery", () => {
  it("guarda la fecha estimada, en vez del `null` del camino sin fecha", async () => {
    const res = await request(app)
      .post("/api/v1/developer/projects")
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({
        name: "Proyecto con fecha estimada",
        slug: `con-fecha-${Date.now()}`,
        estimatedDelivery: "2028-01-01T00:00:00.000Z"
      });

    expect(res.status).toBe(201);
    expect(new Date(res.body.estimatedDelivery).toISOString()).toBe("2028-01-01T00:00:00.000Z");
  });
});

describe("Sin ningún proyecto visible: progress, documents y kpis dan vacío, no un error", () => {
  it("GET /developer/progress da []", async () => {
    const res = await request(app)
      .get("/api/v1/developer/progress")
      .set("Authorization", `Bearer ${tokenAjeno}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("GET /developer/documents da []", async () => {
    const res = await request(app)
      .get("/api/v1/developer/documents")
      .set("Authorization", `Bearer ${tokenAjeno}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("GET /developer/kpis da los cinco en cero", async () => {
    const res = await request(app)
      .get("/api/v1/developer/kpis")
      .set("Authorization", `Bearer ${tokenAjeno}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      activeProjects: 0,
      totalUnits: 0,
      capitalRaisedMinorUnits: 0,
      averageProgress: 0,
      verifiedDocuments: 0
    });
  });
});

describe("GET /developer/kpis con proyectos reales", () => {
  it("calcula averageProgress sobre etapas reales, y 0 capital sin contratos (SUM nulo)", async () => {
    // Proyecto PROPIO y nuevo, sin ninguna unidad vendida: a diferencia de
    // `torre-test` (el fixture compartido, que ya trae un contrato de
    // 12.000.000), acá `SUM(Contract.totalMinorUnits)` no tiene ninguna fila
    // para sumar y da `NULL` — la rama que el `?? 0` existe para cubrir. Los
    // `COUNT` del mismo archivo nunca dan `NULL` (0 filas cuenta 0, no nulo),
    // así que no hace falta un caso aparte para esos.
    const nuevo = await request(app)
      .post("/api/v1/developer/projects")
      .set("Authorization", `Bearer ${tokenSolo}`)
      .send({ name: "SPEC-017 sin ventas", slug: `spec-017-sin-ventas-${Date.now()}` });
    expect(nuevo.status).toBe(201);

    const primeraEtapa = nuevo.body.stages[0].id as string;
    await db
      .updateTable("Stage")
      .set({ state: "Completed" })
      .where("id", "=", primeraEtapa)
      .execute();

    const res = await request(app)
      .get("/api/v1/developer/kpis")
      .set("Authorization", `Bearer ${tokenSolo}`);

    expect(res.status).toBe(200);
    expect(res.body.capitalRaisedMinorUnits).toBe(0);
    expect(res.body.averageProgress).toBeGreaterThan(0);
  });
});

describe("GET /developer/audit-log con category y cursor", () => {
  it("category filtra por entityType", async () => {
    const res = await request(app)
      .get("/api/v1/developer/audit-log")
      .query({ category: "Project" })
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    for (const item of res.body.items) expect(item.entityType).toBe("Project");
  });

  it("cursor pagina hacia atrás en el tiempo", async () => {
    const primera = await request(app)
      .get("/api/v1/developer/audit-log")
      .query({ limit: 1 })
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(primera.status).toBe(200);
    expect(primera.body.nextCursor).toBeTruthy();

    const siguiente = await request(app)
      .get("/api/v1/developer/audit-log")
      .query({ limit: 1, cursor: primera.body.nextCursor })
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(siguiente.status).toBe(200);
    if (siguiente.body.items.length > 0) {
      expect(new Date(siguiente.body.items[0].createdAt).getTime()).toBeLessThan(
        new Date(primera.body.items[0].createdAt).getTime()
      );
    }
  });
});
