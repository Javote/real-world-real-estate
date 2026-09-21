import { buildStageDatum } from "@plataforma/shared";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import {
  hilosSospechosos,
  reconciliarAnclajes,
  reconciliarParaLectura,
  repararHilosSospechosos
} from "../src/domain/reconcile";
import { anchorPort } from "../src/lib/anchor";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// SPEC-013 §C · la parte mínima: promover a `Confirmed` lo que ya está en la
// cadena. Corre con el adaptador `simulated`, que desde el 2026-08-31 **solo
// confirma los txid que él mismo produjo**: un hash inventado le da `null`,
// igual que se lo daría Blockfrost.
//
// Por eso los eventos de esta suite anclan de verdad contra el puerto para
// obtener su txid, en vez de inventarlo. Antes no hacía falta —el simulador
// confirmaba cualquier cosa— y eso era justamente lo que había que arreglar:
// un test que pasa contra un puerto que miente no prueba la promoción, prueba
// la mentira.

let proyecto: string;
let tokenAdmin: string;
let tokenDev: string;

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

/**
 * Un txid que el simulador reconoce como suyo. El simulador es determinístico,
 * así que dos `reference` distintas dan dos txid distintos.
 */
async function txidReal(reference: string): Promise<string> {
  const recibo = await anchorPort().anchorCommitment({ sha256: "a".repeat(64), reference });
  return recibo.txid;
}

async function evento(campos: {
  txid: string | null;
  status: "Pending" | "Confirmed";
  projectId?: string;
  referenceId?: string;
}) {
  const id = createId();
  const ahora = new Date();
  await db
    .insertInto("OnChainEvent")
    .values({
      id,
      projectId: campos.projectId ?? proyecto,
      stageId: null,
      evidenceId: null,
      referenceId: campos.referenceId ?? createId(),
      eventIndex: 0,
      eventType: "EVIDENCE_ANCHOR",
      fromState: null,
      toState: null,
      commitment: "a".repeat(64),
      status: campos.status,
      txid: campos.txid,
      // El CHECK de la tabla no deja un TXID sin red (D-080): el fixture tiene
      // que construir filas posibles, no filas cómodas.
      network: campos.txid === null ? null : "Simulated",
      outputRef: null,
      blockTimestamp: null,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

const leer = (id: string) =>
  db.selectFrom("OnChainEvent").selectAll().where("id", "=", id).executeTakeFirstOrThrow();

beforeAll(async () => {
  proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
  tokenAdmin = (await login(FIXTURES.admin)).body.token;
  tokenDev = (await login(FIXTURES.activo)).body.token;
});

describe("reconciliarAnclajes", () => {
  it("promueve a Confirmed un Pending que ya está en la cadena, y le pone el timestamp", async () => {
    const id = await evento({ txid: await txidReal("barrido-1"), status: "Pending" });

    const resultado = await reconciliarAnclajes();
    expect(resultado.confirmados).toBeGreaterThanOrEqual(1);

    const fila = await leer(id);
    expect(fila.status).toBe("Confirmed");
    // El timestamp es el del bloque, no el del anclaje: es lo que se puede
    // sustanciar contra la cadena (regla 17).
    expect(fila.blockTimestamp).toBeInstanceOf(Date);
  });

  it("NO toca un evento sin txid: no hay nada que consultar", async () => {
    // Es el caso de un anclaje que falló al enviarse. Confirmarlo sería
    // inventar una prueba que no existe.
    const id = await evento({ txid: null, status: "Pending" });
    await reconciliarAnclajes();
    expect((await leer(id)).status).toBe("Pending");
  });

  it("es idempotente: la segunda pasada no vuelve a contar lo ya confirmado", async () => {
    await evento({ txid: await txidReal("idempotencia-1"), status: "Pending" });
    await reconciliarAnclajes();
    const segunda = await reconciliarAnclajes();
    expect(segunda.confirmados).toBe(0);
  });
});

describe("POST /evidence/reconcile", () => {
  it("lo dispara el admin", async () => {
    await evento({ txid: "d".repeat(64), status: "Pending" });
    const res = await request(app)
      .post("/api/v1/evidence/reconcile")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ revisados: expect.any(Number) });
  });

  it("un developer no puede", async () => {
    const res = await request(app)
      .post("/api/v1/evidence/reconcile")
      .set("Authorization", `Bearer ${tokenDev}`);
    expect(res.status).toBe(403);
  });

  it("la ruta no la come `/:id/anchor`: 'reconcile' no se lee como un id", async () => {
    // Si `/reconcile` se declarara DESPUÉS de `/:id/anchor`, esto daría 404
    // buscando una evidencia llamada "reconcile".
    const res = await request(app)
      .post("/api/v1/evidence/reconcile")
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(res.status).not.toBe(404);
  });

  it("devuelve sospechosos — el patrón de la prueba de volumen del 2026-09-10", async () => {
    const res = await request(app)
      .post("/api/v1/evidence/reconcile")
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(res.body.sospechosos).toEqual(expect.any(Array));
  });

  it("devuelve reparados — Capa 1, corre antes de listar sospechosos", async () => {
    const id = await stage();
    const hilo = await abrirHiloEnInProgress(id);
    const eventId = await transicion(id, 0, null);
    await transicion(id, 1, await txidReal(`ruta-reparo-${id}`));

    const res = await request(app)
      .post("/api/v1/evidence/reconcile")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.body.reparados).toContainEqual({
      eventId,
      txid: hilo.txid,
      outputRef: hilo.outputRef
    });
    expect(res.body.sospechosos.map((s: { eventId: string }) => s.eventId)).not.toContain(eventId);
  });
});

// ── hilosSospechosos · detecta, no repara ───────────────────────────────────
//
// El hallazgo real de la prueba de volumen del 2026-09-10
// (specs/evidencia-m3/3-preprod/REPORTE-2026-09-10-prueba-de-volumen.md §Hallazgo): una
// STAGE_TRANSITION sin `txid` cuyo stage ya avanzó a un evento más nuevo.

/** Un stage real, con `sequenceOrder` al azar para no chocar entre corridas. */
async function stage() {
  const id = createId();
  const ahora = new Date();
  await db
    .insertInto("Stage")
    .values({
      id,
      projectId: proyecto,
      name: "Stage de reconciliación",
      sequenceOrder: Math.floor(Math.random() * 1_000_000) + 500_000,
      state: "InProgress",
      validationCritical: false,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

/** `toState` fijo en `"InProgress"`: coincide con el datum que abre `repararHilosSospechosos`. */
async function transicion(stageId: string, eventIndex: number, txid: string | null) {
  const id = createId();
  const ahora = new Date();
  await db
    .insertInto("OnChainEvent")
    .values({
      id,
      projectId: proyecto,
      stageId,
      evidenceId: null,
      referenceId: null,
      eventIndex,
      eventType: "STAGE_TRANSITION",
      fromState: "Observed",
      toState: "InProgress",
      commitment: null,
      status: txid === null ? "Pending" : "Confirmed",
      txid,
      network: txid === null ? null : "Simulated",
      outputRef: txid === null ? null : `${txid}#0`,
      blockTimestamp: null,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

describe("hilosSospechosos", () => {
  it("marca una transición sin TXID que el stage ya dejó atrás", async () => {
    const id = await stage();
    // El intento que se perdió: sin txid.
    await transicion(id, 0, null);
    // El stage siguió — hay un evento más nuevo en el mismo hilo.
    await transicion(id, 1, await txidReal(`sospechoso-${id}`));

    const sospechosos = await hilosSospechosos();
    expect(sospechosos.map((s) => s.stageId)).toContain(id);
  });

  it("NO marca una transición sin TXID que todavía es el último evento del hilo", async () => {
    // Sin evento más nuevo, puede ser un intento a punto de reintentarse —
    // no hay nada raro todavía, solo un anclaje que no llegó.
    const id = await stage();
    await transicion(id, 0, null);

    const sospechosos = await hilosSospechosos();
    expect(sospechosos.map((s) => s.stageId)).not.toContain(id);
  });

  it("no marca una transición que sí tiene TXID", async () => {
    const id = await stage();
    await transicion(id, 0, await txidReal(`sano-${id}`));
    await transicion(id, 1, await txidReal(`sano-siguiente-${id}`));

    const sospechosos = await hilosSospechosos();
    expect(sospechosos.map((s) => s.stageId)).not.toContain(id);
  });
});

// ── repararHilosSospechosos · Capa 1, sin firmar nada ───────────────────────
//
// Cierra el caso "etapa 3" del reporte: la transacción sí salió y confirmó,
// solo el registro perdió el recibo. `findLiveThread` la encuentra por
// `stageRef` directo en la cadena (acá, el simulador) y el bookkeeping se
// completa sin volver a construir ni firmar nada.

/**
 * Abre un hilo real en `Pending` (lo único que el mint acepta) y lo avanza a
 * `InProgress` — el `toState` fijo que pone `transicion()` — para que
 * `findLiveThread` encuentre un UTxO vivo en el estado que las pruebas de
 * reparación necesitan.
 */
async function abrirHiloEnInProgress(stageId: string) {
  const pending = buildStageDatum({
    id: stageId,
    projectId: proyecto,
    sequenceOrder: 1,
    validationCritical: false,
    state: "Pending"
  });
  const abierto = await anchorPort().openThread({ datum: pending });
  // `pending` ya es un `StageDatum` (`projectRef`/`stageRef` en hex) — no se
  // reconstruye con `buildStageDatum`, que espera el source (`id`/`projectId`).
  const inProgress = { ...pending, state: "InProgress" as const };
  return anchorPort().advanceThread({
    outputRef: abierto.outputRef,
    previous: pending,
    next: inProgress
  });
}

describe("repararHilosSospechosos", () => {
  it("completa txid/outputRef cuando el hilo real coincide con el toState declarado", async () => {
    const id = await stage();
    const hilo = await abrirHiloEnInProgress(id);

    const eventId = await transicion(id, 0, null);
    await transicion(id, 1, await txidReal(`reparo-siguiente-${id}`));

    const reparados = await repararHilosSospechosos();

    expect(reparados).toContainEqual({ eventId, txid: hilo.txid, outputRef: hilo.outputRef });
    const fila = await leer(eventId);
    expect(fila.txid).toBe(hilo.txid);
    expect(fila.outputRef).toBe(hilo.outputRef);
    // Queda Pending: es `reconciliarAnclajes`, no esta función, quien confirma.
    expect(fila.status).toBe("Pending");
  });

  it("NO repara si el datum del hilo real no coincide con el toState declarado", async () => {
    const id = await stage();
    // `state: "Pending"` — el `toState` que pone `transicion()` es `"InProgress"`.
    const datum = buildStageDatum({
      id,
      projectId: proyecto,
      sequenceOrder: 1,
      validationCritical: false,
      state: "Pending"
    });
    await anchorPort().openThread({ datum });

    const eventId = await transicion(id, 0, null);
    await transicion(id, 1, await txidReal(`no-coincide-${id}`));

    const reparados = await repararHilosSospechosos();

    expect(reparados.map((r) => r.eventId)).not.toContain(eventId);
    expect((await leer(eventId)).txid).toBeNull();
  });

  it("NO repara un stage que nunca minteó ningún hilo", async () => {
    const id = await stage();
    const eventId = await transicion(id, 0, null);
    await transicion(id, 1, await txidReal(`sin-hilo-${id}`));

    const reparados = await repararHilosSospechosos();

    expect(reparados.map((r) => r.eventId)).not.toContain(eventId);
    expect((await leer(eventId)).txid).toBeNull();
  });

  it("es idempotente: un evento ya reparado no se vuelve a tocar", async () => {
    const id = await stage();
    await abrirHiloEnInProgress(id);
    const eventId = await transicion(id, 0, null);
    await transicion(id, 1, await txidReal(`idempotente-${id}`));

    await repararHilosSospechosos();
    const segunda = await repararHilosSospechosos();

    expect(segunda.map((r) => r.eventId)).not.toContain(eventId);
  });
});

// ── D-077 · la reconciliación la dispara la lectura ────────────────────────
//
// Sin esto, un anclaje real queda `Pending` para siempre: nadie mueve
// `Pending → Confirmed` salvo el barrido a mano. Hoy no se nota porque el
// simulador devuelve `Confirmed` directo; con el modo real encendido, la
// evidencia queda anclada de verdad y la UI dice "Pendiente" eternamente.

describe("reconciliarParaLectura", () => {
  it("confirma lo que cae dentro del alcance", async () => {
    const id = await evento({ txid: await txidReal("alcance-1"), status: "Pending" });

    await reconciliarParaLectura({ projectId: proyecto });

    expect((await leer(id)).status).toBe("Confirmed");
  });

  // El alcance es lo que mantiene barata la lectura: mirar todo en cada pantalla
  // sería una request al proveedor por cada anclaje pendiente del sistema.
  it("no toca lo que cae fuera del alcance", async () => {
    const ajeno = (
      await db
        .selectFrom("Project")
        .select("id")
        .where("slug", "=", FIXTURES.otroProyecto.slug)
        .executeTakeFirstOrThrow()
    ).id;
    // El txid es real a propósito: si fuera inventado, este test pasaría porque
    // el simulador no lo conoce, no porque el alcance lo haya excluido.
    const id = await evento({
      txid: await txidReal("fuera-de-alcance-1"),
      status: "Pending",
      projectId: ajeno
    });

    await reconciliarParaLectura({ projectId: proyecto });

    expect((await leer(id)).status).toBe("Pending");
  });

  // La propiedad que importa más que confirmar: una cadena caída no puede
  // tumbar una pantalla. El registro no depende del anclaje, tampoco para leer
  // (SPEC-013 §Invariante 2).
  it("se traga el error del proveedor en vez de propagarlo", async () => {
    const id = await evento({ txid: "3".repeat(64), status: "Pending" });
    const puerto = anchorPort();
    const original = puerto.confirmedAt;
    puerto.confirmedAt = async () => {
      throw new Error("Blockfrost 502");
    };

    try {
      await expect(reconciliarParaLectura({ projectId: proyecto })).resolves.toBeUndefined();
      expect((await leer(id)).status).toBe("Pending");
    } finally {
      puerto.confirmedAt = original;
    }
  });

  it("no consulta la cadena si el puerto está inhabilitado", async () => {
    const id = await evento({ txid: "4".repeat(64), status: "Pending" });
    const puerto = anchorPort();
    const modoOriginal = puerto.mode;
    let consultas = 0;
    const original = puerto.confirmedAt;
    puerto.confirmedAt = async (txid) => {
      consultas++;
      return original.call(puerto, txid);
    };
    Object.defineProperty(puerto, "mode", { value: "disabled", configurable: true });

    try {
      await reconciliarParaLectura({ projectId: proyecto });

      expect(consultas).toBe(0);
      expect((await leer(id)).status).toBe("Pending");
    } finally {
      Object.defineProperty(puerto, "mode", { value: modoOriginal, configurable: true });
      puerto.confirmedAt = original;
    }
  });
});

describe("GET /investor/units/:id/news", () => {
  // La prueba de que el cableado existe, y no solo la función: sin la llamada en
  // la ruta, la pantalla sigue mostrando "Pendiente" sobre algo ya confirmado.
  it("confirma el anclaje pendiente del proyecto antes de responder", async () => {
    const unidad = (
      await db
        .selectFrom("Unit")
        .select("id")
        .where("projectId", "=", proyecto)
        .where("unitReference", "=", FIXTURES.unidad.unitReference)
        .executeTakeFirstOrThrow()
    ).id;
    const id = await evento({ txid: await txidReal("lectura-1"), status: "Pending" });
    const tokenInvestor = (await login(FIXTURES.investor)).body.token;

    const res = await request(app)
      .get(`/api/v1/investor/units/${unidad}/news`)
      .set("Authorization", `Bearer ${tokenInvestor}`);

    expect(res.status).toBe(200);
    expect((await leer(id)).status).toBe("Confirmed");
  });
});
