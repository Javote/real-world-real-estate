import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { createId } from "../src/db/id.js";
import { db } from "../src/lib/db.js";
import { FIXTURES } from "./global-setup.js";

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

let tokenDev: string;
let tokenAjeno: string;
let tokenSolo: string;

beforeAll(async () => {
  tokenDev = (await login(FIXTURES.activo)).body.token;
  tokenAjeno = (await login(FIXTURES.ajeno)).body.token;

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
        latitude: -34.6,
        longitude: -58.4,
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
    const nuevo = await request(app)
      .post("/api/v1/developer/projects")
      .set("Authorization", `Bearer ${tokenSolo}`)
      .send({
        latitude: -34.6,
        longitude: -58.4,
        name: "SPEC-017 sin ventas",
        slug: `spec-017-sin-ventas-${Date.now()}`
      });
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

describe("GET /developer/audit-log — el txid de las transiciones de etapa", () => {
  it("una transición nueva trae su txid, y una vieja sin txid lo recupera", async () => {
    const alta = await request(app)
      .post("/api/v1/developer/projects")
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({
        latitude: -34.6,
        longitude: -58.4,
        name: "Audit txid",
        slug: `audit-txid-${Date.now()}`
      });
    expect(alta.status).toBe(201);
    const etapa = alta.body.stages[0].id as string;

    const avance = await request(app)
      .patch(`/api/v1/stages/${etapa}/state`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .send({ state: "InProgress" });
    expect(avance.status).toBe(200);
    const txid = avance.body.anchor.txid as string;
    expect(txid).toBeTruthy();

    const despues = new Date(Date.now() + 1000);
    const viejas = [
      { from: "Pending", to: "InProgress" },
      { from: "InProgress", to: "Completed" },
      { nota: "sin to" },
      null
    ];
    const ids: string[] = [];
    for (const meta of viejas) {
      const id = createId();
      ids.push(id);
      await db
        .insertInto("AuditLog")
        .values({
          id,
          actorUserId: null,
          action: "CHANGE_STAGE_STATE",
          entityType: "Stage",
          entityId: etapa,
          metadataJson: meta ? JSON.stringify(meta) : null,
          createdAt: despues
        })
        .execute();
    }

    const res = await request(app)
      .get("/api/v1/developer/audit-log")
      .query({ category: "Stage", limit: 100 })
      .set("Authorization", `Bearer ${tokenDev}`);
    expect(res.status).toBe(200);

    type Fila = { id: string; entityId: string; metadataJson: string | null };
    const filas = res.body.items as Fila[];
    const meta = (f?: Fila) => (f?.metadataJson ? JSON.parse(f.metadataJson) : null);
    const porId = (id: string) => filas.find((f) => f.id === id);

    const nueva = filas.find((f) => f.entityId === etapa && !ids.includes(f.id));
    expect(meta(nueva).txid).toBe(txid);
    expect(meta(porId(ids[0] as string)).txid).toBe(txid);
    expect(meta(porId(ids[1] as string))).toEqual({ from: "InProgress", to: "Completed" });
    expect(meta(porId(ids[2] as string))).toEqual({ nota: "sin to" });
    expect(porId(ids[3] as string)?.metadataJson).toBeNull();
  });
});
