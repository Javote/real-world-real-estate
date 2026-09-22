import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// SPEC-017 §paso 4 — `certifier.routes.ts` tenía dos rutas sin NINGÚN test por
// HTTP (`/stages/:id/certify` y `/stages/:id/observe`, ver el comentario del
// propio archivo), y otras tres con solo su rama de error probada, nunca el
// camino feliz: `kpisProcedure` (los tres `.filter()` de estado nunca corrían
// con stages de verdad), `assignmentsProcedure` (el caso sin proyectos
// visibles) y `stageViewProcedure`/`certificatesProcedure` (200 real, no solo
// el 404 con un id inexistente — que además lo bloquea `authorize` antes de
// llegar al handler, así que ese 404 nunca ejercitaba el cuerpo).

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

let tokenCertificador: string;
let tokenAdmin: string;
let proyecto: string;

/** Mismo patrón que `test/stage-transitions.test.ts`: contador con offset
 * aleatorio, no `Math.random()` puro — dos llamadas pueden coincidir sobre el
 * mismo proyecto fixture. */
let siguienteSequenceOrder = Math.floor(Math.random() * 1_000_000) + 500_000;
const proximoSequenceOrder = () => siguienteSequenceOrder++;

async function crearStage(opts: { state: "Pending" | "InProgress"; validationCritical?: boolean }) {
  const ahora = new Date();
  const id = createId();
  await db
    .insertInto("Stage")
    .values({
      id,
      projectId: proyecto,
      name: "Stage de cobertura certifier",
      sequenceOrder: proximoSequenceOrder(),
      state: opts.state,
      validationCritical: opts.validationCritical ?? false,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

beforeAll(async () => {
  tokenCertificador = (await login(FIXTURES.certificador)).body.token;
  tokenAdmin = (await login(FIXTURES.admin)).body.token;

  proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
});

afterAll(async () => {
  await db.destroy();
});

describe("GET /certifier/kpis", () => {
  it("cuenta stages de verdad en los tres estados que reporta", async () => {
    await crearStage({ state: "InProgress" });
    await crearStage({ state: "InProgress" });
    const observado = await crearStage({ state: "InProgress" });
    await db.updateTable("Stage").set({ state: "Observed" }).where("id", "=", observado).execute();
    const completado = await crearStage({ state: "InProgress" });
    await db
      .updateTable("Stage")
      .set({ state: "Completed", certifiedAt: new Date() })
      .where("id", "=", completado)
      .execute();

    const res = await request(app)
      .get("/api/v1/certifier/kpis")
      .set("Authorization", `Bearer ${tokenCertificador}`);

    expect(res.status).toBe(200);
    expect(res.body.assigned).toBeGreaterThanOrEqual(1);
    expect(res.body.certified).toBeGreaterThanOrEqual(1);
    expect(res.body.observed).toBeGreaterThanOrEqual(1);
  });

  it("un verifier sin ningún proyecto visible da los cuatro contadores en 0, sin consultar Stage", async () => {
    const email = `verifier-sin-proyecto-kpis-${createId()}@test.local`;
    await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ email, password: "sinproyecto123", role: "verifier", fullName: "Sin Proyecto" });
    const tokenNuevo = (await login({ email, password: "sinproyecto123" })).body.token;

    const res = await request(app)
      .get("/api/v1/certifier/kpis")
      .set("Authorization", `Bearer ${tokenNuevo}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ assigned: 0, certified: 0, observed: 0, totalStages: 0 });
  });
});

describe("GET /certifier/assignments", () => {
  it("un verifier sin ningún proyecto visible recibe la lista vacía, no un error", async () => {
    const email = `verifier-sin-proyecto-${createId()}@test.local`;
    await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ email, password: "sinproyecto123", role: "verifier", fullName: "Sin Proyecto" });

    const tokenNuevo = (await login({ email, password: "sinproyecto123" })).body.token;

    const res = await request(app)
      .get("/api/v1/certifier/assignments")
      .set("Authorization", `Bearer ${tokenNuevo}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("GET /certifier/stages/:id", () => {
  it("trae el stage con su evidencia (vacía, si no subió nada)", async () => {
    const stageId = await crearStage({ state: "Pending" });

    const res = await request(app)
      .get(`/api/v1/certifier/stages/${stageId}`)
      .set("Authorization", `Bearer ${tokenCertificador}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(stageId);
    expect(res.body.evidence).toEqual([]);
  });
});

describe("POST /certifier/stages/:id/certify", () => {
  it("certifica un stage no crítico en InProgress y ancla su bundle", async () => {
    const stageId = await crearStage({ state: "InProgress", validationCritical: false });

    const res = await request(app)
      .post(`/api/v1/certifier/stages/${stageId}/certify`)
      .set("Authorization", `Bearer ${tokenCertificador}`);

    expect(res.status).toBe(201);
    expect(res.body.state).toBe("Completed");
    expect(res.body.anchor).toBeDefined();
  });

  it("certificar un stage que no está en InProgress da 409, no 404", async () => {
    const stageId = await crearStage({ state: "Pending" });

    const res = await request(app)
      .post(`/api/v1/certifier/stages/${stageId}/certify`)
      .set("Authorization", `Bearer ${tokenCertificador}`);

    expect(res.status).toBe(409);
  });
});

describe("POST /certifier/stages/:id/observe", () => {
  it("observa un stage en InProgress y lo devuelve al developer con una nota", async () => {
    const stageId = await crearStage({ state: "InProgress" });

    const res = await request(app)
      .post(`/api/v1/certifier/stages/${stageId}/observe`)
      .set("Authorization", `Bearer ${tokenCertificador}`)
      .send({ note: "Falta el acta de replanteo" });

    expect(res.status).toBe(201);
    expect(res.body.state).toBe("Observed");
  });

  it("observar un stage que no está en InProgress da 409, no 404", async () => {
    const stageId = await crearStage({ state: "Pending" });

    const res = await request(app)
      .post(`/api/v1/certifier/stages/${stageId}/observe`)
      .set("Authorization", `Bearer ${tokenCertificador}`)
      .send({ note: "Falta el acta de replanteo" });

    expect(res.status).toBe(409);
  });
});

describe("GET /certifier/certificates", () => {
  it("pagina por cursor sobre lo ya certificado", async () => {
    const stageId = await crearStage({ state: "InProgress", validationCritical: false });
    await request(app)
      .post(`/api/v1/certifier/stages/${stageId}/certify`)
      .set("Authorization", `Bearer ${tokenCertificador}`);

    const primera = await request(app)
      .get("/api/v1/certifier/certificates?limit=1")
      .set("Authorization", `Bearer ${tokenCertificador}`);
    expect(primera.status).toBe(200);
    expect(primera.body.items.length).toBeLessThanOrEqual(1);

    if (primera.body.nextCursor) {
      const segunda = await request(app)
        .get(`/api/v1/certifier/certificates?limit=1&cursor=${primera.body.nextCursor}`)
        .set("Authorization", `Bearer ${tokenCertificador}`);
      expect(segunda.status).toBe(200);
    }
  });

  it("un verifier sin ningún proyecto visible recibe la lista vacía, sin reconciliar nada", async () => {
    const email = `verifier-sin-proyecto-certs-${createId()}@test.local`;
    await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ email, password: "sinproyecto123", role: "verifier", fullName: "Sin Proyecto" });
    const tokenNuevo = (await login({ email, password: "sinproyecto123" })).body.token;

    const res = await request(app)
      .get("/api/v1/certifier/certificates")
      .set("Authorization", `Bearer ${tokenNuevo}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.nextCursor).toBeNull();
  });
});
