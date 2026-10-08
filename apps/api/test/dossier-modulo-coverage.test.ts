import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { sembrarUnidadVendida } from "../src/db/fixtures.js";
import { createId } from "../src/db/id.js";
import { db } from "../src/lib/db.js";
import { insumosDe } from "../src/modules/dossier/queries.js";
import { FIXTURES } from "./global-setup.js";

// Lo que pasa entre leer el dossier y reclamarlo: otro notary decidió en el medio.
const ganchos = vi.hoisted(() => ({ enElMedio: null as null | (() => Promise<void>) }));

vi.mock("../src/modules/dossier/queries.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/modules/dossier/queries.js")>();
  return {
    ...real,
    insumosDe: async (...args: Parameters<typeof real.insumosDe>) => {
      const insumos = await real.insumosDe(...args);
      const enElMedio = ganchos.enElMedio;
      ganchos.enElMedio = null;
      await enElMedio?.();
      return insumos;
    }
  };
});

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

let proyecto: string;
let investorId: string;
let tokenNotario: string;
let tokenAdmin: string;

async function venta() {
  const { unitId } = await sembrarUnidadVendida(db, {
    projectId: proyecto,
    investorId,
    unitReference: `MODULO-${createId()}`,
    floor: 1,
    sizeM2: 40,
    priceMinorUnits: 5_000_000,
    currency: "USD"
  });
  const { id } = await db
    .selectFrom("Dossier")
    .select("id")
    .where("unitId", "=", unitId)
    .executeTakeFirstOrThrow();
  const { body } = await request(app)
    .get(`/api/v1/notary/dossiers/${id}`)
    .set("Authorization", `Bearer ${tokenNotario}`);
  return { unitId, dossierId: id, masterHash: body.masterHash as string };
}

const decidir =
  (dossierId: string, cambios: { status: string; masterHash: string }) => async () => {
    await db.updateTable("Dossier").set(cambios).where("id", "=", dossierId).execute();
  };

beforeAll(async () => {
  proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
  investorId = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.investor.email)
      .executeTakeFirstOrThrow()
  ).id;
  tokenNotario = (await login(FIXTURES.notario)).body.token;
  tokenAdmin = (await login(FIXTURES.admin)).body.token;
});

afterAll(async () => {
  await db.destroy();
});

describe("el reclamo lo gana otro notary", () => {
  it("firmar mientras otro lo rechaza: 409 DOSSIER_NOT_SIGNABLE, sin anclar", async () => {
    const { dossierId, masterHash } = await venta();
    ganchos.enElMedio = decidir(dossierId, { status: "rejected", masterHash });

    const firma = await request(app)
      .post(`/api/v1/notary/dossiers/${dossierId}/sign`)
      .set("Authorization", `Bearer ${tokenNotario}`);

    expect(firma.status).toBe(409);
    expect(firma.body.code).toBe("DOSSIER_NOT_SIGNABLE");
    const eventos = await db
      .selectFrom("OnChainEvent")
      .select("id")
      .where("referenceId", "=", dossierId)
      .execute();
    expect(eventos).toEqual([]);
  });

  it("rechazar mientras otro lo firma: 409 DOSSIER_SIGNED, sin audit ni aviso", async () => {
    const { dossierId, masterHash } = await venta();
    ganchos.enElMedio = decidir(dossierId, { status: "signed", masterHash });

    const rechazo = await request(app)
      .post(`/api/v1/notary/dossiers/${dossierId}/reject`)
      .set("Authorization", `Bearer ${tokenNotario}`)
      .send({ note: "tarde" });

    expect(rechazo.status).toBe(409);
    expect(rechazo.body.code).toBe("DOSSIER_SIGNED");
    const audits = await db
      .selectFrom("AuditLog")
      .select("id")
      .where("entityId", "=", dossierId)
      .execute();
    expect(audits).toEqual([]);
  });

  it("rechazar mientras otro lo rechaza: 409 DOSSIER_NOT_REJECTABLE, un solo audit", async () => {
    const { dossierId, masterHash } = await venta();
    ganchos.enElMedio = decidir(dossierId, { status: "rejected", masterHash });

    const rechazo = await request(app)
      .post(`/api/v1/notary/dossiers/${dossierId}/reject`)
      .set("Authorization", `Bearer ${tokenNotario}`)
      .send({ note: "el segundo" });

    expect(rechazo.status).toBe(409);
    expect(rechazo.body.code).toBe("DOSSIER_NOT_REJECTABLE");
  });

  it("dos links a la vez: el que pierde devuelve el token del que ganó, con un solo audit", async () => {
    const { unitId, dossierId } = await venta();
    const tokenInvestor = (await login(FIXTURES.investor)).body.token;
    const compartir = () =>
      request(app)
        .post(`/api/v1/investor/units/${unitId}/dossier/share`)
        .set("Authorization", `Bearer ${tokenInvestor}`);

    let primero: Awaited<ReturnType<typeof compartir>> | undefined;
    ganchos.enElMedio = async () => {
      primero = await compartir();
    };
    const segundo = await compartir();

    expect(segundo.body.shareToken).toBe(primero?.body.shareToken);
    const audits = await db
      .selectFrom("AuditLog")
      .select("id")
      .where("entityId", "=", dossierId)
      .where("action", "=", "SHARE_DOSSIER")
      .execute();
    expect(audits).toHaveLength(1);
  });
});

describe("una unidad sin venta no tiene dossier", () => {
  it("compartirlo y exportarlo es 404, y no lo crea", async () => {
    const ahora = new Date();
    const unitId = createId();
    await db
      .insertInto("Unit")
      .values({
        id: unitId,
        projectId: proyecto,
        unitReference: `SIN-VENTA-${unitId}`,
        status: "available",
        priceMinorUnits: 5_000_000,
        currency: "USD",
        investorId: null,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();

    const compartido = await request(app)
      .post(`/api/v1/investor/units/${unitId}/dossier/share`)
      .set("Authorization", `Bearer ${tokenAdmin}`);
    const exportado = await request(app)
      .get(`/api/v1/investor/units/${unitId}/dossier/export.pdf`)
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect([compartido.status, exportado.status]).toEqual([404, 404]);
    const filas = await db
      .selectFrom("Dossier")
      .select("id")
      .where("unitId", "=", unitId)
      .execute();
    expect(filas).toEqual([]);
  });

  it("insumosDe sin unidades no consulta la base", async () => {
    const leer = vi.spyOn(db, "selectFrom");
    expect((await insumosDe(db, [])).size).toBe(0);
    expect(leer).not.toHaveBeenCalled();
    leer.mockRestore();
  });
});
