import { canTransition, STAGE_STATES, type StageState } from "@plataforma/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// D-059. La tabla de transiciones vivía SOLO en Aiken y esta ruta aceptaba
// cualquier estado desde cualquier estado — incluido salir de `Completed`, que
// la regla 9 declara terminal. Estos tests son el espejo, del lado de la API,
// de los 16 pares que `contracts/lib/propnexus/fsm.ak` prueba uno por uno.

let proyecto: string;
let token: string;

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
      // `sequenceOrder` es único por proyecto: uno distinto por stage creado.
      sequenceOrder: Math.floor(Math.random() * 1_000_000) + 100,
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
      // Por defecto viene atribuida: D-028 (a) la exige cuando es autoritativa,
      // así que una evidencia sin `issuingAuthority` es el caso raro, no el normal.
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

beforeAll(async () => {
  proyecto = (
    await db
      .selectFrom("Project")
      .selectAll()
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
  token = (await login(FIXTURES.activo)).body.token;
});

afterAll(async () => {
  await db.destroy();
});

describe("PATCH /stages/:id/state · la tabla de transiciones", () => {
  // Los 16 pares, generados igual que en el validador: ninguno queda sin caso.
  for (const from of STAGE_STATES) {
    for (const to of STAGE_STATES) {
      const permitido = canTransition(from, to);
      it(`${permitido ? "200" : "409"} para ${from} → ${to}`, async () => {
        const id = await crearStage({ state: from });
        const res = await patchState(id, to);
        expect(res.status).toBe(permitido ? 200 : 409);
        if (!permitido) {
          expect(res.body.code).toBe("STAGE_TRANSITION_INVALID");
          // Y el estado no se movió: un rechazo que igual escribe no es un rechazo.
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

describe("PATCH /stages/:id/state · evidencia en stages críticos", () => {
  it("409 al completar un stage validation-critical sin evidencia", async () => {
    const id = await crearStage({ state: "InProgress", validationCritical: true });
    const res = await patchState(id, "Completed");
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("STAGE_EVIDENCE_REQUIRED");
  });

  it("200 cuando el stage crítico tiene evidencia", async () => {
    const id = await crearStage({ state: "InProgress", validationCritical: true });
    await agregarEvidencia(id);
    const res = await patchState(id, "Completed");
    expect(res.status).toBe(200);
  });

  it("200 para un stage no crítico sin evidencia", async () => {
    const id = await crearStage({ state: "InProgress", validationCritical: false });
    expect((await patchState(id, "Completed")).status).toBe(200);
  });

  // D-028 (a), acotada por D-084. Lo que se exige NO es que la autoridad sea
  // válida —la plataforma no valida (D-026)— sino que la declaración esté
  // completa: si decís que es autoritativa, decís de quién viene.
  it("409 al completar con una evidencia autoritativa sin decir quién la emitió", async () => {
    const id = await crearStage({ state: "InProgress", validationCritical: true });
    await agregarEvidencia(id, { authoritative: true, issuingAuthority: null });
    const res = await patchState(id, "Completed");
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("STAGE_EVIDENCE_UNATTRIBUTED");
  });

  it("409 también si `issuingAuthority` es espacios en blanco", async () => {
    const id = await crearStage({ state: "InProgress", validationCritical: true });
    await agregarEvidencia(id, { authoritative: true, issuingAuthority: "   " });
    expect((await patchState(id, "Completed")).body.code).toBe("STAGE_EVIDENCE_UNATTRIBUTED");
  });

  // El developer sube fotos de obra desde el teléfono y eso no puede pedir
  // atribución: es exactamente la alternativa que D-028 descartó.
  it("200 con evidencia NO autoritativa y sin atribución", async () => {
    const id = await crearStage({ state: "InProgress", validationCritical: true });
    await agregarEvidencia(id, { authoritative: false, issuingAuthority: null });
    expect((await patchState(id, "Completed")).status).toBe(200);
  });
});

describe("OnChainEvent · el aterrizaje del anclaje", () => {
  // D-080. El CHECK de la tabla ya vuelve imposible un TXID sin red; esto
  // asegura lo otro: que la red que se guarda sea la que el PUERTO declara y no
  // `CARDANO_NETWORK`. La suite corre en `simulated`, así que un "Preprod" acá
  // significaría que alguien está leyendo el entorno en vez del adaptador.
  it("persiste la red del puerto junto al TXID, no la del entorno", async () => {
    const anterior = process.env.CARDANO_NETWORK;
    process.env.CARDANO_NETWORK = "Preprod";

    try {
      const creado = await request(app)
        .post(`/api/v1/projects/${proyecto}/stages`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Stage con red", sequenceOrder: 999_401 });

      const evento = await db
        .selectFrom("OnChainEvent")
        .select(["txid", "network"])
        .where("id", "=", creado.body.anchor.id)
        .executeTakeFirstOrThrow();

      expect(evento.txid).not.toBeNull();
      expect(evento.network).toBe("Simulated");
    } finally {
      if (anterior === undefined) delete process.env.CARDANO_NETWORK;
      else process.env.CARDANO_NETWORK = anterior;
    }
  });

  it("ancla la transición de un stage con hilo abierto", async () => {
    // El stage se crea por la API para que su hilo exista: el `mint` pasa por
    // `POST`, igual que en la cadena. Con `ANCHOR_MODE=simulated` la
    // confirmación es inmediata.
    const creado = await request(app)
      .post(`/api/v1/projects/${proyecto}/stages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Stage con hilo", sequenceOrder: 999_101 });

    expect(creado.body.anchor.status).toBe("Confirmed");
    expect(creado.body.anchor.outputRef).toBe(`${creado.body.anchor.txid}#0`);

    const res = await patchState(creado.body.id, "InProgress");

    expect(res.body.anchor.status).toBe("Confirmed");
    expect(res.body.anchor.fromState).toBe("Pending");
    expect(res.body.anchor.toState).toBe("InProgress");
    // El hilo se movió: el UTxO nuevo no es el que abrió el `mint`.
    expect(res.body.anchor.outputRef).not.toBe(creado.body.anchor.outputRef);
  });

  it("deja el evento en Failed —y la declaración escrita— si el stage no tiene hilo", async () => {
    // Es la invariante 2 de SPEC-013: el registro nunca depende del anclaje.
    // Un stage insertado a mano (o sembrado antes de que existiera el puerto)
    // no tiene hilo abierto, así que no se puede gastar nada.
    const id = await crearStage({ state: "Pending" });
    const res = await patchState(id, "InProgress");

    expect(res.status).toBe(200);
    expect(res.body.state).toBe("InProgress");
    expect(res.body.anchor.status).toBe("Failed");
    expect(res.body.anchor.txid).toBeNull();
  });

  it("un stage crítico se completa Y se ancla, con el Merkle root del bundle", async () => {
    // Este test documentaba un hueco: hasta que existió `EvidenceBundle`, el
    // datum viajaba con `evidenceRoot` vacío y el anclaje quedaba en `Failed`
    // porque el validador exige 32 bytes para completar un stage crítico. Con
    // el bundle, el circuito cierra entero.
    const creado = await request(app)
      .post(`/api/v1/projects/${proyecto}/stages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Stage crítico", sequenceOrder: 999_102, validationCritical: true });

    await patchState(creado.body.id, "InProgress");
    await agregarEvidencia(creado.body.id);
    const res = await patchState(creado.body.id, "Completed");

    expect(res.status).toBe(200);
    expect(res.body.state).toBe("Completed");
    expect(res.body.anchor.status).toBe("Confirmed");
    // El commitment anclado es el root del bundle, no un hash cualquiera.
    expect(res.body.anchor.commitment).toMatch(/^[0-9a-f]{64}$/);
  });

  it("numera los eventos en orden dentro del hilo", async () => {
    const id = await crearStage({ state: "Pending" });
    await patchState(id, "InProgress");
    await patchState(id, "Observed");
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
});

describe("POST /projects/:id/stages · el stage nace en Pending", () => {
  it("ignora el estado que venga por body y abre el hilo en el índice 0", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${proyecto}/stages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Stage nuevo", sequenceOrder: 999_001, state: "Completed" });

    expect(res.status).toBe(201);
    expect(res.body.state).toBe("Pending");
    expect(res.body.anchor.eventIndex).toBe(0);
    expect(res.body.anchor.eventType).toBe("STAGE_CREATED");
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
    // El escenario que un openThread caído en producción deja: la declaración
    // ya existe (STAGE_CREATED, Failed, sin outputRef) y el stage sigue
    // Pending — nunca hubo hilo que gastar.
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

    // El hilo ya existe: una transición normal ahora ancla de verdad, en vez
    // de repetir el Failed que la prueba de arriba documenta.
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
    const creado = await request(app)
      .post(`/api/v1/projects/${proyecto}/stages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Stage con hilo ya abierto", sequenceOrder: 999_103 });

    const res = await retry(creado.body.id);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("THREAD_ALREADY_OPEN");
  });

  it("404 si el stage nunca tuvo un evento de creación que reintentar", async () => {
    // El caso de un stage sembrado directo (torre-a en producción): Pending,
    // sin hilo, y sin ningún STAGE_CREATED que retomar.
    const id = await crearStage({ state: "Pending" });
    const res = await retry(id);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("STAGE_CREATED_EVENT_NOT_FOUND");
  });
});

describe("hasOnChainThread · visible sin tener que saber que existe cabezaDelHilo", () => {
  it("false en un stage sembrado directo, true en uno creado por la API", async () => {
    const sinHilo = await crearStage({ state: "Pending" });
    const conHilo = (
      await request(app)
        .post(`/api/v1/projects/${proyecto}/stages`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Stage con hilo, para el flag", sequenceOrder: 999_104 })
    ).body.id;

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
        txid: `${"f".repeat(63)}${Math.floor(Math.random() * 10)}`,
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
    // El bug que esto cierra: `tieneHiloAnclado` miraba CUALQUIER OnChainEvent
    // con txid, y un EVIDENCE_ANCHOR (D-006) tiene txid pero nunca outputRef —
    // no toca el validador ni la identidad del stage. Un stage con evidencia
    // anclada pero sin hilo real quedaba con `sequenceOrder`/`validationCritical`
    // bloqueados por error.
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
        txid: `${"f".repeat(63)}${Math.floor(Math.random() * 10)}`,
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
    const res = await request(app)
      .post(`/api/v1/projects/${proyecto}/stages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Stage por default", sequenceOrder: 999_201 });

    expect(res.body.validationCritical).toBe(true);
  });

  it("y por lo tanto no se completa sin evidencia", async () => {
    // Antes de D-061 este mismo stage se completaba sin nada: el default era
    // `false` y nadie lo marcaba. Ese era el agujero.
    const creado = await request(app)
      .post(`/api/v1/projects/${proyecto}/stages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Stage por default 2", sequenceOrder: 999_202 });

    await patchState(creado.body.id, "InProgress");
    const res = await patchState(creado.body.id, "Completed");

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("STAGE_EVIDENCE_REQUIRED");
  });

  it("desmarcarlo sigue siendo posible, pero ahora es explícito", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${proyecto}/stages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Stage no crítico", sequenceOrder: 999_203, validationCritical: false });

    expect(res.body.validationCritical).toBe(false);
  });
});
