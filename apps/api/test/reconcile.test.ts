import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { reconciliarAnclajes, reconciliarParaLectura } from "../src/domain/reconcile";
import { anchorPort } from "../src/lib/anchor";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// SPEC-013 §C · la parte mínima: promover a `Confirmed` lo que ya está en la
// cadena. Corre con el adaptador `simulated`, donde `confirmedAt()` siempre
// responde — lo que se prueba acá es la lógica de promoción, no la consulta al
// proveedor, que se ejercita contra Preprod a mano.

let proyecto: string;
let tokenAdmin: string;
let tokenDev: string;

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

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
    const id = await evento({ txid: "f".repeat(64), status: "Pending" });

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
    await evento({ txid: "e".repeat(64), status: "Pending" });
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
});

// ── D-077 · la reconciliación la dispara la lectura ────────────────────────
//
// Sin esto, un anclaje real queda `Pending` para siempre: nadie mueve
// `Pending → Confirmed` salvo el barrido a mano. Hoy no se nota porque el
// simulador devuelve `Confirmed` directo; con el modo real encendido, la
// evidencia queda anclada de verdad y la UI dice "Pendiente" eternamente.

describe("reconciliarParaLectura", () => {
  it("confirma lo que cae dentro del alcance", async () => {
    const id = await evento({ txid: "1".repeat(64), status: "Pending" });

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
    const id = await evento({ txid: "2".repeat(64), status: "Pending", projectId: ajeno });

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
    const id = await evento({ txid: "5".repeat(64), status: "Pending" });
    const tokenInvestor = (await login(FIXTURES.investor)).body.token;

    const res = await request(app)
      .get(`/api/v1/investor/units/${unidad}/news`)
      .set("Authorization", `Bearer ${tokenInvestor}`);

    expect(res.status).toBe(200);
    expect((await leer(id)).status).toBe("Confirmed");
  });
});
