import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createId } from "../src/db/id.js";
import { anchorCommitmentEvent, commitmentOf } from "../src/domain/anchoring.js";
import { anchorPort } from "../src/lib/anchor.js";
import { db, enLote } from "../src/lib/db.js";
import { anclarConReclamo } from "../src/platform/anclaje.js";
import { audit } from "../src/platform/audit.js";
import { notify } from "../src/platform/notify.js";
import { FIXTURES } from "./global-setup.js";

let proyecto: string;
let usuario: string;

beforeAll(async () => {
  proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
  usuario = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow()
  ).id;
});

afterAll(async () => {
  await db.destroy();
});

const auditsDe = (entityId: string) =>
  db.selectFrom("AuditLog").selectAll().where("entityId", "=", entityId).execute();

async function crearUnidad() {
  const id = createId();
  const ahora = new Date();
  await db
    .insertInto("Unit")
    .values({
      id,
      projectId: proyecto,
      unitReference: `CIMIENTOS-${id}`,
      status: "available",
      priceMinorUnits: 1_000_000,
      currency: "USD",
      investorId: null,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

describe("audit(ejecutor, entrada)", () => {
  it("contra db escribe la fila, con el metadata en JSON", async () => {
    const entidad = createId();
    await audit(db, {
      actorUserId: usuario,
      action: "UPDATE_UNIT",
      entityType: "Unit",
      entityId: entidad,
      metadata: { campo: "status" }
    }).execute();

    const [fila] = await auditsDe(entidad);
    expect(fila).toMatchObject({ actorUserId: usuario, action: "UPDATE_UNIT", entityType: "Unit" });
    expect(JSON.parse(fila!.metadataJson!)).toEqual({ campo: "status" });
  });

  it("sin actor ni metadata, los dos van en null", async () => {
    const entidad = createId();
    await audit(db, { action: "UPDATE_UNIT", entityType: "Unit", entityId: entidad }).execute();
    expect((await auditsDe(entidad))[0]).toMatchObject({ actorUserId: null, metadataJson: null });
  });

  it("adentro de una transacción que falla, no queda", async () => {
    const entidad = createId();
    await expect(
      db.transaction().execute(async (trx) => {
        await audit(trx, {
          action: "UPDATE_UNIT",
          entityType: "Unit",
          entityId: entidad
        }).execute();
        throw new Error("la mutación falló");
      })
    ).rejects.toThrow("la mutación falló");
    expect(await auditsDe(entidad)).toEqual([]);
  });

  it("en un lote, viaja con la mutación que audita", async () => {
    const unidad = await crearUnidad();
    await enLote(
      db.updateTable("Unit").set({ status: "reserved" }).where("id", "=", unidad),
      audit(db, { action: "UPDATE_UNIT", entityType: "Unit", entityId: unidad })
    );
    expect(await auditsDe(unidad)).toHaveLength(1);
  });
});

describe("notify(ejecutor, entradas) — atómico, en el lote de la mutación (SPEC-613 §La decisión)", () => {
  const notificacionesDe = (titleKey: string) =>
    db.selectFrom("Notification").selectAll().where("titleKey", "=", titleKey).execute();

  it("una entrada, una fila, con los params en JSON", async () => {
    const clave = `test.${createId()}`;
    await notify(db, {
      userId: usuario,
      category: "stage",
      titleKey: clave,
      params: { n: 1 }
    }).execute();
    const [fila] = await notificacionesDe(clave);
    expect(fila).toMatchObject({ userId: usuario, unitId: null, readAt: null });
    expect(JSON.parse(fila!.paramsJson!)).toEqual({ n: 1 });
  });

  it("varias entradas van en un solo INSERT, y una lista vacía no compila", async () => {
    const clave = `test.${createId()}`;
    const entrada = { userId: usuario, category: "stage" as const, titleKey: clave };
    const consulta = notify(db, [entrada, entrada]);
    expect(consulta.compile().sql.match(/insert into/gi)).toHaveLength(1);
    await consulta.execute();
    expect(await notificacionesDe(clave)).toHaveLength(2);

    // @ts-expect-error — una lista vacía no es un INSERT
    void (() => notify(db, []));
  });

  it("en un lote, viaja con la mutación que avisa", async () => {
    const unidad = await crearUnidad();
    const clave = `test.${createId()}`;
    await enLote(
      db.updateTable("Unit").set({ status: "reserved" }).where("id", "=", unidad),
      notify(db, { userId: usuario, category: "stage", titleKey: clave, unitId: unidad })
    );
    expect(await notificacionesDe(clave)).toHaveLength(1);
  });

  it("si la notificación falla, tira y deshace la mutación del mismo lote", async () => {
    const unidad = await crearUnidad();
    const antes = await db
      .selectFrom("Unit")
      .select("status")
      .where("id", "=", unidad)
      .executeTakeFirstOrThrow();

    await expect(
      enLote(
        db.updateTable("Unit").set({ status: "reserved" }).where("id", "=", unidad),
        notify(db, { userId: "no-existe", category: "stage", titleKey: "test.falla" })
      )
    ).rejects.toThrow();

    const despues = await db
      .selectFrom("Unit")
      .select("status")
      .where("id", "=", unidad)
      .executeTakeFirstOrThrow();
    expect(despues.status).toBe(antes.status);
  });
});

describe("anclarConReclamo — reclamar antes de anclar", () => {
  const reservar = (unidad: string) => ({
    reclamar: () =>
      db
        .updateTable("Unit")
        .set({ status: "reserved", updatedAt: new Date() })
        .where("id", "=", unidad)
        .where("status", "=", "available")
        .returning("id")
        .executeTakeFirst(),
    anclar: () =>
      anchorCommitmentEvent({
        projectId: proyecto,
        eventType: "DOSSIER_SIGNATURE",
        commitment: commitmentOf({ unidad }),
        reference: unidad
      })
  });

  const eventosDe = (referenceId: string) =>
    db.selectFrom("OnChainEvent").select("id").where("referenceId", "=", referenceId).execute();

  it("con cinco a la vez, uno gana y ancla; los otros reciben null y no anclan", async () => {
    const unidad = await crearUnidad();
    const anclar = vi.spyOn(anchorPort(), "anchorCommitment");

    const resultados = await Promise.all(
      [0, 1, 2, 3, 4].map(() => anclarConReclamo(reservar(unidad)))
    );

    const ganadores = resultados.filter((r) => r !== null);
    expect(ganadores).toHaveLength(1);
    expect(ganadores[0]!.reclamo).toEqual({ id: unidad });
    expect(ganadores[0]!.evento.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(anclar).toHaveBeenCalledTimes(1);
    expect(await eventosDe(unidad)).toHaveLength(1);
    anclar.mockRestore();
  });

  it("si el reclamo tira, no se ancla nada", async () => {
    const anclar = vi.fn();

    await expect(
      anclarConReclamo({ reclamar: () => Promise.reject(new Error("falló el reclamo")), anclar })
    ).rejects.toThrow("falló el reclamo");

    expect(anclar).not.toHaveBeenCalled();
  });
});
