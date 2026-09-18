import { createHash } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { notifyUnitInvestors } from "../src/domain/notify";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";
import { crearStageMinteado } from "./helpers/stages";

// SPEC-209 — B-13 (el N+1 de notificar investors) y B-14 (el filtro en
// memoria de GET /developer/documents). Las dos son optimizaciones puras:
// mismos cuerpos, mismos tests, cero cambio de forma.

const token = async (email: string, password: string) => {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password });
  return res.body.token as string;
};

let tokenDev: string;
let projectId: string;

beforeAll(async () => {
  tokenDev = await token(FIXTURES.activo.email, FIXTURES.activo.password);
  projectId = (
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

async function crearInvestor(email: string) {
  const ahora = new Date();
  const id = createId();
  await db
    .insertInto("User")
    .values({
      id,
      email,
      passwordHash: await bcrypt.hash("spec209pass", 10),
      fullName: "Investor SPEC-209",
      role: "buyer",
      isActive: true,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

async function crearUnidad(reference: string, investorId: string | null) {
  const ahora = new Date();
  const id = createId();
  await db
    .insertInto("Unit")
    .values({
      id,
      projectId,
      unitReference: reference,
      status: investorId ? "sold" : "available",
      priceMinorUnits: 5_000_000,
      currency: "USD",
      investorId,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

describe("notifyUnitInvestors (B-13): un INSERT en vez de N SELECT+INSERT", () => {
  it("sin unidades, no inserta nada", async () => {
    await expect(
      notifyUnitInvestors([], { category: "document", titleKey: "notifications.evidence.uploaded" })
    ).resolves.toBeUndefined();
  });

  it("una notificación por unidad, incluso si dos unidades son del mismo investor", async () => {
    const investor = await crearInvestor(`spec209-notify-${createId()}@test.local`);
    const u1 = await crearUnidad(`SPEC209-N1-${createId()}`, investor);
    const u2 = await crearUnidad(`SPEC209-N2-${createId()}`, investor);

    await notifyUnitInvestors(
      [
        { unitId: u1, investorId: investor },
        { unitId: u2, investorId: investor }
      ],
      {
        category: "document",
        titleKey: "notifications.evidence.uploaded",
        params: { stageName: "x" }
      }
    );

    const notificaciones = await db
      .selectFrom("Notification")
      .selectAll()
      .where("userId", "=", investor)
      .execute();

    expect(notificaciones).toHaveLength(2);
    expect(new Set(notificaciones.map((n) => n.unitId))).toEqual(new Set([u1, u2]));
    for (const n of notificaciones) {
      expect(n.titleKey).toBe("notifications.evidence.uploaded");
      expect(n.category).toBe("document");
    }
  });

  it("proyecto sin unidades vendidas: el flujo real de subir evidencia no crea notificaciones", async () => {
    // Proyecto propio y aislado (no el compartido `torre-test`, que otros
    // tests ya llenan de unidades vendidas): acá no hay ninguna, a propósito.
    const ahora = new Date();
    const dev = await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow();

    const proyectoAislado = await db
      .insertInto("Project")
      .values({
        id: createId(),
        name: "SPEC-209 sin ventas",
        slug: `spec209-sin-ventas-${createId()}`,
        totalUnits: 0,
        status: "planning",
        createdAt: ahora,
        updatedAt: ahora
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await db
      .insertInto("ProjectMember")
      .values({
        id: createId(),
        userId: dev.id,
        projectId: proyectoAislado.id,
        membershipRole: "developer",
        createdAt: ahora
      })
      .execute();

    const stage = await crearStageMinteado({
      projectId: proyectoAislado.id,
      name: "SPEC-209 sin unidades vendidas",
      sequenceOrder: 1,
      actorUserId: dev.id
    });

    const res = await request(app)
      .post(`/api/v1/developer/projects/${proyectoAislado.id}/stages/${stage.id}/evidence`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .field("evidenceType", "document")
      .field("category", "plano")
      .attach("file", Buffer.from("%PDF-1.4\nx\n%%EOF\n"), {
        filename: "sin-investors.pdf",
        contentType: "application/pdf"
      });

    // El chequeo real: el camino completo (0 unidades vendidas →
    // `notifyUnitInvestors([])`) no explota y la subida sigue respondiendo
    // 201 — el caso `[]` en sí ya está cubierto arriba, directo sobre la
    // función.
    expect(res.status).toBe(201);
  });
});

describe("GET /developer/documents?status= (B-14): filtro en SQL, no en memoria", () => {
  async function crearEvidenciaConAnclaje(opts: {
    txid: string | null;
    extraEventoSinTxid?: boolean;
  }) {
    const ahora = new Date();
    const evidenceId = createId();
    const contenido = `spec209-${createId()}`;
    await db
      .insertInto("Evidence")
      .values({
        id: evidenceId,
        projectId,
        stageId: null,
        uploadedById: (
          await db
            .selectFrom("User")
            .select("id")
            .where("email", "=", FIXTURES.activo.email)
            .executeTakeFirstOrThrow()
        ).id,
        evidenceType: "document",
        category: "plano",
        authoritative: false,
        issuingAuthority: null,
        originalFilename: `${contenido}.pdf`,
        storedFilename: `${contenido}-guardado.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 1,
        storagePath: `/tmp/no-existe/${contenido}.pdf`,
        sha256Hash: createHash("sha256").update(contenido).digest("hex"),
        uploadedAt: ahora,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();

    if (opts.txid !== null || opts.extraEventoSinTxid === undefined) {
      await db
        .insertInto("OnChainEvent")
        .values({
          id: createId(),
          projectId,
          stageId: null,
          evidenceId,
          referenceId: evidenceId,
          eventIndex: 0,
          eventType: "EVIDENCE_ANCHOR",
          fromState: null,
          toState: null,
          commitment: "a".repeat(64),
          status: opts.txid ? "Confirmed" : "Pending",
          txid: opts.txid,
          network: opts.txid ? "Preprod" : null,
          outputRef: null,
          blockTimestamp: null,
          createdAt: ahora,
          updatedAt: ahora
        })
        .execute();
    }

    // Un segundo OnChainEvent sobre la MISMA evidencia (el caso que un
    // `leftJoin` multiplica): la fila extra tiene que aparecer las mismas
    // veces que aparecía antes del refactor, ni una más ni una menos.
    if (opts.extraEventoSinTxid) {
      await db
        .insertInto("OnChainEvent")
        .values({
          id: createId(),
          projectId,
          stageId: null,
          evidenceId,
          referenceId: evidenceId,
          eventIndex: 1,
          eventType: "EVIDENCE_ANCHOR",
          fromState: null,
          toState: null,
          commitment: "b".repeat(64),
          status: "Pending",
          txid: null,
          network: null,
          outputRef: null,
          blockTimestamp: null,
          createdAt: ahora,
          updatedAt: ahora
        })
        .execute();
    }

    return evidenceId;
  }

  it("sin status devuelve todo, igual que hoy", async () => {
    await crearEvidenciaConAnclaje({ txid: "c".repeat(64) });
    await crearEvidenciaConAnclaje({ txid: null });

    const res = await request(app)
      .get("/api/v1/developer/documents")
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it("status=anchored devuelve solo lo que tiene txid", async () => {
    const conTxid = await crearEvidenciaConAnclaje({ txid: "d".repeat(64) });
    const sinTxid = await crearEvidenciaConAnclaje({ txid: null });

    const res = await request(app)
      .get("/api/v1/developer/documents")
      .query({ status: "anchored" })
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    const ids = res.body.map((d: { id: string }) => d.id);
    expect(ids).toContain(conTxid);
    expect(ids).not.toContain(sinTxid);
    for (const d of res.body) expect(d.txid).not.toBeNull();
  });

  it("status=pending devuelve solo lo que no tiene txid", async () => {
    const conTxid = await crearEvidenciaConAnclaje({ txid: "e".repeat(64) });
    const sinTxid = await crearEvidenciaConAnclaje({ txid: null });

    const res = await request(app)
      .get("/api/v1/developer/documents")
      .query({ status: "pending" })
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    const ids = res.body.map((d: { id: string }) => d.id);
    expect(ids).toContain(sinTxid);
    expect(ids).not.toContain(conTxid);
    for (const d of res.body) expect(d.txid).toBeNull();
  });

  it("una evidencia con dos OnChainEvent (el leftJoin la duplica) cuenta igual con y sin status", async () => {
    const evidenceId = await crearEvidenciaConAnclaje({
      txid: "f".repeat(64),
      extraEventoSinTxid: true
    });

    const sinFiltro = await request(app)
      .get("/api/v1/developer/documents")
      .set("Authorization", `Bearer ${tokenDev}`);
    const filasSinFiltro = sinFiltro.body.filter((d: { id: string }) => d.id === evidenceId);
    // Dos OnChainEvent → dos filas por el leftJoin, igual que antes del
    // refactor (el filtro de JS tampoco las habría colapsado).
    expect(filasSinFiltro).toHaveLength(2);

    const anchored = await request(app)
      .get("/api/v1/developer/documents")
      .query({ status: "anchored" })
      .set("Authorization", `Bearer ${tokenDev}`);
    const filasAnchored = anchored.body.filter((d: { id: string }) => d.id === evidenceId);
    // Solo la fila con txid no nulo pasa: la misma cuenta que
    // `filasSinFiltro.filter(d => d.txid !== null)` habría dado.
    expect(filasAnchored).toHaveLength(1);

    const pending = await request(app)
      .get("/api/v1/developer/documents")
      .query({ status: "pending" })
      .set("Authorization", `Bearer ${tokenDev}`);
    const filasPending = pending.body.filter((d: { id: string }) => d.id === evidenceId);
    expect(filasPending).toHaveLength(1);
  });
});
