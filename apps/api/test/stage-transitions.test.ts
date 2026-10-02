import { randomBytes } from "node:crypto";
import { canTransition, STAGE_STATES, type StageState } from "@plataforma/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { anchorPort } from "../src/lib/anchor";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";
import { crearStageMinteado } from "./helpers/stages";

const txidDeFixture = () => randomBytes(32).toString("hex");

let proyecto: string;
let token: string;
let tokenAdmin: string;
let actorId: string;

let siguienteSequenceOrder = Math.floor(Math.random() * 1_000_000) + 100;
const proximoSequenceOrder = () => siguienteSequenceOrder++;

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

async function crearStage(opts: { state?: StageState; validationCritical?: boolean } = {}) {
  const ahora = new Date();
  const id = createId();
  await db
    .insertInto("Stage")
    .values({
      id,
      projectId: proyecto,
      name: "Stage de transiciones",
      sequenceOrder: proximoSequenceOrder(),
      state: opts.state ?? "Pending",
      validationCritical: opts.validationCritical ?? false,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

async function agregarEvidencia(
  stageId: string,
  opciones: { authoritative?: boolean; issuingAuthority?: string | null } = {}
) {
  const ahora = new Date();
  const usuario = (
    await db
      .selectFrom("User")
      .selectAll()
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow()
  ).id;

  await db
    .insertInto("Evidence")
    .values({
      id: createId(),
      projectId: proyecto,
      stageId,
      uploadedById: usuario,
      evidenceType: "certificate",
      category: "permits",
      authoritative: opciones.authoritative ?? true,
      issuingAuthority:
        opciones.issuingAuthority === undefined
          ? "Municipalidad de Córdoba"
          : opciones.issuingAuthority,
      originalFilename: "acta.pdf",
      storedFilename: "acta-guardada.pdf",
      storagePath: "/tmp/no-existe/acta.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1,
      sha256Hash: "a".repeat(64),
      uploadedAt: ahora,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
}

const patchState = (id: string, state: string) =>
  request(app)
    .patch(`/api/v1/stages/${id}/state`)
    .set("Authorization", `Bearer ${token}`)
    .send({ state });

const patchStateAdmin = (id: string, state: string) =>
  request(app)
    .patch(`/api/v1/stages/${id}/state`)
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({ state });

beforeAll(async () => {
  proyecto = (
    await db
      .selectFrom("Project")
      .selectAll()
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
  token = (await login(FIXTURES.activo)).body.token;
  tokenAdmin = (await login(FIXTURES.admin)).body.token;
  actorId = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow()
  ).id;
});

const crearStageConHilo = (opts: { validationCritical?: boolean } = {}) =>
  crearStageMinteado({
    projectId: proyecto,
    name: "Stage con hilo",
    sequenceOrder: proximoSequenceOrder(),
    actorUserId: actorId,
    ...opts
  });

afterAll(async () => {
  await db.destroy();
});

describe("PATCH /stages/:id/state · la tabla de transiciones", () => {
  for (const from of STAGE_STATES) {
    for (const to of STAGE_STATES) {
      const permitido = canTransition(from, to);
      it(`${permitido ? "200" : "409"} para ${from} → ${to}`, async () => {
        const id = await crearStage({ state: from });
        const res = await patchStateAdmin(id, to);
        expect(res.status).toBe(permitido ? 200 : 409);
        if (!permitido) {
          expect(res.body.code).toBe("STAGE_TRANSITION_INVALID");
          const fila = await db
            .selectFrom("Stage")
            .selectAll()
            .where("id", "=", id)
            .executeTakeFirstOrThrow();
          expect(fila.state).toBe(from);
        }
      });
    }
  }

  it("rechaza un estado que no existe con 400, no con 409", async () => {
    const id = await crearStage();
    const res = await patchState(id, "Certified");
    expect(res.status).toBe(400);
  });
});

describe("PATCH /stages/:id/state · el developer no puede saltear al certifier", () => {
  it("403 al pedir Completed", async () => {
    const id = await crearStage({ state: "InProgress" });
    const res = await patchState(id, "Completed");

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("STAGE_TRANSITION_FORBIDDEN");

    const fila = await db
      .selectFrom("Stage")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    expect(fila.state).toBe("InProgress");
  });

  it("403 al pedir Observed", async () => {
    const id = await crearStage({ state: "InProgress" });
    const res = await patchState(id, "Observed");

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("STAGE_TRANSITION_FORBIDDEN");
  });

  it("el 403 gana aunque la transición también sería inválida por la FSM", async () => {
    const id = await crearStage({ state: "Pending" });
    const res = await patchState(id, "Completed");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("STAGE_TRANSITION_FORBIDDEN");
  });

  it("200 al pedir InProgress desde Pending — sigue permitido", async () => {
    const id = await crearStage({ state: "Pending" });
    expect((await patchState(id, "InProgress")).status).toBe(200);
  });

  it("200 al pedir InProgress desde Observed — reanudar tras una observación sigue permitido", async () => {
    const id = await crearStage({ state: "Observed" });
    expect((await patchState(id, "InProgress")).status).toBe(200);
  });

  it("admin no tiene esta restricción", async () => {
    const id = await crearStage({ state: "InProgress" });
    const res = await patchStateAdmin(id, "Completed");
    expect(res.status).toBe(200);
  });
});

describe("PATCH /stages/:id/state · evidencia en stages críticos", () => {
  it("409 al completar un stage validation-critical sin evidencia", async () => {
    const id = await crearStage({ state: "InProgress", validationCritical: true });
    const res = await patchStateAdmin(id, "Completed");
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("STAGE_EVIDENCE_REQUIRED");
  });

  it("200 cuando el stage crítico tiene evidencia", async () => {
    const id = await crearStage({ state: "InProgress", validationCritical: true });
    await agregarEvidencia(id);
    const res = await patchStateAdmin(id, "Completed");
    expect(res.status).toBe(200);
  });

  it("200 para un stage no crítico sin evidencia", async () => {
    const id = await crearStage({ state: "InProgress", validationCritical: false });
    expect((await patchStateAdmin(id, "Completed")).status).toBe(200);
  });

  it("409 al completar con una evidencia autoritativa sin decir quién la emitió", async () => {
    const id = await crearStage({ state: "InProgress", validationCritical: true });
    await agregarEvidencia(id, { authoritative: true, issuingAuthority: null });
    const res = await patchStateAdmin(id, "Completed");
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("STAGE_EVIDENCE_UNATTRIBUTED");
  });

  it("409 también si `issuingAuthority` es espacios en blanco", async () => {
    const id = await crearStage({ state: "InProgress", validationCritical: true });
    await agregarEvidencia(id, { authoritative: true, issuingAuthority: "   " });
    expect((await patchStateAdmin(id, "Completed")).body.code).toBe("STAGE_EVIDENCE_UNATTRIBUTED");
  });

  it("200 con evidencia NO autoritativa y sin atribución", async () => {
    const id = await crearStage({ state: "InProgress", validationCritical: true });
    await agregarEvidencia(id, { authoritative: false, issuingAuthority: null });
    expect((await patchStateAdmin(id, "Completed")).status).toBe(200);
  });
});

describe("OnChainEvent · el aterrizaje del anclaje", () => {
  it("persiste la red del puerto junto al TXID, no la del entorno", async () => {
    const anterior = process.env.CARDANO_NETWORK;
    process.env.CARDANO_NETWORK = "Preprod";

    try {
      const creado = await crearStageConHilo();

      const evento = await db
        .selectFrom("OnChainEvent")
        .select(["txid", "network"])
        .where("id", "=", creado.anchor.id)
        .executeTakeFirstOrThrow();

      expect(evento.txid).not.toBeNull();
      expect(evento.network).toBe("Simulated");
    } finally {
      if (anterior === undefined) delete process.env.CARDANO_NETWORK;
      else process.env.CARDANO_NETWORK = anterior;
    }
  });

  it("ancla la transición de un stage con hilo abierto", async () => {
    const creado = await crearStageConHilo();

    expect(creado.anchor.status).toBe("Confirmed");
    expect(creado.anchor.outputRef).toBe(`${creado.anchor.txid}#0`);

    const res = await patchState(creado.id, "InProgress");

    expect(res.body.anchor.status).toBe("Confirmed");
    expect(res.body.anchor.fromState).toBe("Pending");
    expect(res.body.anchor.toState).toBe("InProgress");
    expect(res.body.anchor.outputRef).not.toBe(creado.anchor.outputRef);
  });

  it("guarda el TXID real aunque la confirmación falle después — Pending, nunca Failed", async () => {
    const creado = await crearStageConHilo();
    const puerto = anchorPort();
    const original = puerto.confirmedAt;
    puerto.confirmedAt = async () => {
      throw new Error("Blockfrost caído");
    };

    try {
      const res = await patchState(creado.id, "InProgress");

      expect(res.status).toBe(200);
      expect(res.body.state).toBe("InProgress");
      expect(res.body.anchor.status).toBe("Pending");
      expect(res.body.anchor.txid).not.toBeNull();
      expect(res.body.anchor.outputRef).not.toBeNull();

      const evento = await db
        .selectFrom("OnChainEvent")
        .selectAll()
        .where("id", "=", res.body.anchor.id)
        .executeTakeFirstOrThrow();
      expect(evento.txid).toBe(res.body.anchor.txid);
      expect(evento.outputRef).toBe(res.body.anchor.outputRef);
      expect(evento.status).toBe("Pending");
    } finally {
      puerto.confirmedAt = original;
    }
  });

  it("deja el evento en Failed —y la declaración escrita— si el stage no tiene hilo", async () => {
    const id = await crearStage({ state: "Pending" });
    const res = await patchState(id, "InProgress");

    expect(res.status).toBe(200);
    expect(res.body.state).toBe("InProgress");
    expect(res.body.anchor.status).toBe("Failed");
    expect(res.body.anchor.txid).toBeNull();
  });

  it("un stage crítico se completa Y se ancla, con el Merkle root del bundle", async () => {
    const creado = await crearStageConHilo({ validationCritical: true });

    await patchState(creado.id, "InProgress");
    await agregarEvidencia(creado.id);
    const res = await patchStateAdmin(creado.id, "Completed");

    expect(res.status).toBe(200);
    expect(res.body.state).toBe("Completed");
    expect(res.body.anchor.status).toBe("Confirmed");
    expect(res.body.anchor.commitment).toMatch(/^[0-9a-f]{64}$/);
  });

  it("un stage no crítico que se completa sin evidencia ancla con commitment null, nunca ''", async () => {
    const creado = await crearStageConHilo({ validationCritical: false });

    await patchState(creado.id, "InProgress");
    const res = await patchStateAdmin(creado.id, "Completed");

    expect(res.status).toBe(200);
    expect(res.body.anchor.status).toBe("Confirmed");
    expect(res.body.anchor.commitment).toBeNull();
  });

  it("numera los eventos en orden dentro del hilo", async () => {
    const id = await crearStage({ state: "Pending" });
    await patchState(id, "InProgress");
    await patchStateAdmin(id, "Observed");
    await patchState(id, "InProgress");

    const eventos = await db
      .selectFrom("OnChainEvent")
      .selectAll()
      .where("stageId", "=", id)
      .orderBy("eventIndex", "asc")
      .execute();

    expect(eventos.map((e) => e.eventIndex)).toEqual([0, 1, 2]);
    expect(eventos.map((e) => e.toState)).toEqual(["InProgress", "Observed", "InProgress"]);
  });

  it("no registra evento cuando la transición se rechaza", async () => {
    const id = await crearStage({ state: "Completed" });
    await patchState(id, "InProgress");

    const eventos = await db
      .selectFrom("OnChainEvent")
      .selectAll()
      .where("stageId", "=", id)
      .execute();

    expect(eventos).toHaveLength(0);
  });

  it("todo stage nace en Pending y su mint abre el hilo en el índice 0", async () => {
    const creado = await crearStageConHilo();

    expect(creado.state).toBe("Pending");
    expect(creado.anchor.eventIndex).toBe(0);
    expect(creado.anchor.eventType).toBe("STAGE_CREATED");
  });
});

describe("POST /projects/:id/stages/:stageId/retry-anchor", () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = (await login(FIXTURES.admin)).body.token;
  });

  const retry = (stageId: string) =>
    request(app)
      .post(`/api/v1/projects/${proyecto}/stages/${stageId}/retry-anchor`)
      .set("Authorization", `Bearer ${adminToken}`);

  it("reintenta un mint que falló y deja el hilo abierto", async () => {
    const id = await crearStage({ state: "Pending" });
    await db
      .insertInto("OnChainEvent")
      .values({
        id: createId(),
        projectId: proyecto,
        stageId: id,
        eventIndex: 0,
        eventType: "STAGE_CREATED",
        fromState: null,
        toState: "Pending",
        commitment: null,
        status: "Failed",
        txid: null,
        network: null,
        outputRef: null,
        blockTimestamp: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .execute();

    const res = await retry(id);

    expect(res.status).toBe(200);
    expect(res.body.anchor.status).toBe("Confirmed");
    expect(res.body.anchor.eventType).toBe("STAGE_CREATED");
    expect(res.body.anchor.outputRef).toBe(`${res.body.anchor.txid}#0`);

    const avance = await patchState(id, "InProgress");
    expect(avance.body.anchor.status).toBe("Confirmed");
  });

  it("409 si el stage ya avanzó sin hilo — no hay mint retroactivo honesto", async () => {
    const id = await crearStage({ state: "InProgress" });
    const res = await retry(id);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("STAGE_ALREADY_ADVANCED");
  });

  it("409 si el hilo ya está abierto", async () => {
    const creado = await crearStageConHilo();

    const res = await retry(creado.id);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("THREAD_ALREADY_OPEN");
  });

  it("404 si el stage nunca tuvo un evento de creación que reintentar", async () => {
    const id = await crearStage({ state: "Pending" });
    const res = await retry(id);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("STAGE_CREATED_EVENT_NOT_FOUND");
  });

  it("404 si el stage existe pero es de otro proyecto — sin mint", async () => {
    const ahora = new Date();
    const otroProyecto = createId();
    await db
      .insertInto("Project")
      .values({
        id: otroProyecto,
        name: "Otro proyecto",
        slug: `otro-proyecto-${otroProyecto}`,
        address: null,
        city: null,
        country: null,
        latitude: null,
        longitude: null,
        totalUnits: 1,
        estimatedDelivery: null,
        status: "planning",
        organizationId: null,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();
    const id = await crearStage({ state: "Pending" });
    const openThread = vi.spyOn(anchorPort(), "openThread");

    const res = await request(app)
      .post(`/api/v1/projects/${otroProyecto}/stages/${id}/retry-anchor`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Stage does not belong to project");
    expect(openThread).not.toHaveBeenCalled();
    openThread.mockRestore();
  });

  describe("la cadena manda sobre la base (SPEC-301)", () => {
    async function conAsimetria() {
      const creado = await crearStageConHilo();
      await db
        .updateTable("OnChainEvent")
        .set({ outputRef: null })
        .where("stageId", "=", creado.id)
        .execute();
      return creado.id;
    }

    it("409 THREAD_ALREADY_ON_CHAIN si la cadena ya tiene el hilo y la base no — cero transacciones nuevas", async () => {
      const id = await conAsimetria();
      const openThread = vi.spyOn(anchorPort(), "openThread");

      const res = await retry(id);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("THREAD_ALREADY_ON_CHAIN");
      expect(openThread).not.toHaveBeenCalled();
      openThread.mockRestore();
    });

    it("sin asimetría, mintea normal (el caso legítimo de hoy)", async () => {
      const id = await crearStage({ state: "Pending" });
      await db
        .insertInto("OnChainEvent")
        .values({
          id: createId(),
          projectId: proyecto,
          stageId: id,
          eventIndex: 0,
          eventType: "STAGE_CREATED",
          fromState: null,
          toState: "Pending",
          commitment: null,
          status: "Failed",
          txid: null,
          network: null,
          outputRef: null,
          blockTimestamp: null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .execute();

      const res = await retry(id);

      expect(res.status).toBe(200);
      expect(res.body.anchor.status).toBe("Confirmed");
    });

    it("no mintea si `findLiveThread` tira — fail-closed", async () => {
      const id = await conAsimetria();
      const openThread = vi.spyOn(anchorPort(), "openThread");
      const findLiveThread = vi
        .spyOn(anchorPort(), "findLiveThread")
        .mockRejectedValueOnce(new Error("el proveedor no contesta"));

      const res = await retry(id);

      expect(res.status).toBe(500);
      expect(openThread).not.toHaveBeenCalled();

      findLiveThread.mockRestore();
      openThread.mockRestore();
    });

    it("dos retry-anchor concurrentes sobre el mismo stage mintean a lo sumo una vez", async () => {
      const id = await conAsimetria();
      const openThread = vi.spyOn(anchorPort(), "openThread");

      const [a, b] = await Promise.all([retry(id), retry(id)]);

      for (const res of [a, b]) {
        expect(res.status).toBe(409);
        expect(res.body.code).toBe("THREAD_ALREADY_ON_CHAIN");
      }
      expect(openThread).not.toHaveBeenCalled();
      openThread.mockRestore();
    });
  });
});

describe("hasOnChainThread · visible sin tener que saber que existe cabezaDelHilo", () => {
  it("false en un stage sembrado directo, true en uno creado por la API", async () => {
    const sinHilo = await crearStage({ state: "Pending" });
    const conHilo = (await crearStageConHilo()).id;

    const [detalleSinHilo, detalleConHilo, anidadoSinHilo, lista] = await Promise.all([
      request(app).get(`/api/v1/stages/${sinHilo}`).set("Authorization", `Bearer ${token}`),
      request(app).get(`/api/v1/stages/${conHilo}`).set("Authorization", `Bearer ${token}`),
      request(app)
        .get(`/api/v1/projects/${proyecto}/stages/${sinHilo}`)
        .set("Authorization", `Bearer ${token}`),
      request(app)
        .get(`/api/v1/projects/${proyecto}/stages`)
        .set("Authorization", `Bearer ${token}`)
    ]);

    expect(detalleSinHilo.body.hasOnChainThread).toBe(false);
    expect(detalleConHilo.body.hasOnChainThread).toBe(true);
    expect(anidadoSinHilo.body.hasOnChainThread).toBe(false);

    const enLista = (id: string) => lista.body.find((s: { id: string }) => s.id === id);
    expect(enLista(sinHilo).hasOnChainThread).toBe(false);
    expect(enLista(conHilo).hasOnChainThread).toBe(true);
  });
});

describe("GET /stages/:id · storagePath nunca sale (D-011)", () => {
  it("la evidencia embebida no trae storagePath — encontrado en la Tanda 2 de documentación de la API", async () => {
    const id = await crearStage();
    await agregarEvidencia(id);

    const res = await request(app)
      .get(`/api/v1/stages/${id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.evidences.length).toBeGreaterThanOrEqual(1);
    for (const evidencia of res.body.evidences) {
      expect(evidencia).not.toHaveProperty("storagePath");
    }
  });
});

describe("PATCH /stages/:id · la identidad on-chain", () => {
  it("deja cambiar orden y criticidad mientras no haya hilo anclado", async () => {
    const id = await crearStage();
    const res = await request(app)
      .patch(`/api/v1/stages/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ validationCritical: true });

    expect(res.status).toBe(200);
  });

  it("409 una vez que el hilo tiene TXID", async () => {
    const id = await crearStage();
    const ahora = new Date();
    await db
      .insertInto("OnChainEvent")
      .values({
        id: createId(),
        projectId: proyecto,
        stageId: id,
        eventIndex: 0,
        eventType: "STAGE_CREATED",
        fromState: null,
        toState: "Pending",
        commitment: null,
        status: "Confirmed",
        txid: txidDeFixture(),
        network: "Simulated",
        outputRef: `${"f".repeat(64)}#0`,
        blockTimestamp: ahora,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();

    const res = await request(app)
      .patch(`/api/v1/stages/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sequenceOrder: 12 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("STAGE_IDENTITY_IMMUTABLE");
  });

  it("un anclaje de metadata (evidencia) no bloquea la identidad — no es hilo", async () => {
    const id = await crearStage();
    const ahora = new Date();
    await db
      .insertInto("OnChainEvent")
      .values({
        id: createId(),
        projectId: proyecto,
        stageId: id,
        eventIndex: 0,
        eventType: "EVIDENCE_ANCHOR",
        fromState: null,
        toState: null,
        commitment: "a".repeat(64),
        status: "Confirmed",
        txid: txidDeFixture(),
        network: "Simulated",
        outputRef: null,
        blockTimestamp: ahora,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();

    const res = await request(app)
      .patch(`/api/v1/stages/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sequenceOrder: 13 });

    expect(res.status).toBe(200);
  });
});

describe("D-061 · todo stage es validation-critical", () => {
  it("un stage creado sin decir nada nace crítico", async () => {
    const creado = await crearStageConHilo();
    expect(creado.validationCritical).toBe(true);
  });

  it("y por lo tanto no se completa sin evidencia", async () => {
    const creado = await crearStageConHilo();

    await patchState(creado.id, "InProgress");
    const res = await patchStateAdmin(creado.id, "Completed");

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("STAGE_EVIDENCE_REQUIRED");
  });

  it("desmarcarlo sigue siendo posible, pero ahora es explícito", async () => {
    const creado = await crearStageConHilo({ validationCritical: false });
    expect(creado.validationCritical).toBe(false);
  });
});

describe("eventIndex es el log del stage, no el hilo", () => {
  it("un EVIDENCE_ANCHOR con índice mayor no corre la cabeza del hilo", async () => {
    const { cabezaDelHilo } = await import("../src/domain/stage-transition.js");

    const stage = await crearStageMinteado({
      projectId: proyecto,
      name: "Stage con evidencia intercalada",
      sequenceOrder: 999_801,
      actorUserId: actorId
    });

    const cabezaDelMint = await cabezaDelHilo(stage.id);
    expect(cabezaDelMint).not.toBeNull();

    const ahora = new Date();
    await db
      .insertInto("OnChainEvent")
      .values({
        id: createId(),
        projectId: proyecto,
        stageId: stage.id,
        eventIndex: 1,
        eventType: "EVIDENCE_ANCHOR",
        fromState: null,
        toState: null,
        commitment: "b".repeat(64),
        status: "Confirmed",
        txid: txidDeFixture(),
        network: "Simulated",
        outputRef: null,
        blockTimestamp: ahora,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();

    const ultimo = await db
      .selectFrom("OnChainEvent")
      .select(["eventIndex", "eventType"])
      .where("stageId", "=", stage.id)
      .orderBy("eventIndex", "desc")
      .limit(1)
      .executeTakeFirstOrThrow();
    expect(ultimo.eventType).toBe("EVIDENCE_ANCHOR");

    expect(await cabezaDelHilo(stage.id)).toBe(cabezaDelMint);
  });
});
