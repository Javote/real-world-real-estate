import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "../src/db/id";
import { compileDossier } from "../src/domain/dossier";
import { notify, notifyUnitInvestor, notifyUnitInvestors } from "../src/domain/notify";
import { agregadosDeProyectos } from "../src/domain/project-aggregates";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// SPEC-018 §A5 — `domain/notify.ts`, `domain/dossier.ts` (la unidad
// inexistente) y `domain/project-aggregates.ts` (la lista vacía), llamados
// directo. `dossier.test.ts` cubre el resto de `compileDossier` por HTTP.

let proyecto: string;

beforeAll(async () => {
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

async function crearUnidad(reference: string, investorId: string | null) {
  const id = createId();
  const ahora = new Date();
  await db
    .insertInto("Unit")
    .values({
      id,
      projectId: proyecto,
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

describe("notify — la notificación sin unitId", () => {
  it("queda con unitId null, no undefined", async () => {
    const usuario = (
      await db
        .selectFrom("User")
        .select("id")
        .where("email", "=", FIXTURES.activo.email)
        .executeTakeFirstOrThrow()
    ).id;

    await notify({
      userId: usuario,
      category: "document",
      titleKey: "notifications.evidence.uploaded"
    });

    const fila = await db
      .selectFrom("Notification")
      .selectAll()
      .where("userId", "=", usuario)
      .where("titleKey", "=", "notifications.evidence.uploaded")
      .orderBy("createdAt", "desc")
      .executeTakeFirstOrThrow();

    expect(fila.unitId).toBeNull();
  });
});

describe("notifyUnitInvestor — la unidad sin dueño", () => {
  it("no inserta nada: una unidad available no tiene a quién avisarle", async () => {
    const disponible = await crearUnidad(`SPEC018-A5-SIN-DUENO-${createId()}`, null);

    const antes = await db
      .selectFrom("Notification")
      .select((eb) => eb.fn.countAll().as("n"))
      .executeTakeFirstOrThrow();

    await notifyUnitInvestor({
      unitId: disponible,
      category: "document",
      titleKey: "notifications.evidence.uploaded"
    });

    const despues = await db
      .selectFrom("Notification")
      .select((eb) => eb.fn.countAll().as("n"))
      .executeTakeFirstOrThrow();

    expect(despues.n).toBe(antes.n);
  });
});

describe("notifyUnitInvestors — sin params", () => {
  it('paramsJson queda null, no undefined ni "undefined"', async () => {
    const investorId = (
      await db
        .selectFrom("User")
        .select("id")
        .where("email", "=", FIXTURES.investor.email)
        .executeTakeFirstOrThrow()
    ).id;
    const unitId = await crearUnidad(`SPEC018-A5-SIN-PARAMS-${createId()}`, investorId);

    await notifyUnitInvestors([{ unitId, investorId }], {
      category: "document",
      titleKey: "notifications.evidence.uploaded"
    });

    const fila = await db
      .selectFrom("Notification")
      .selectAll()
      .where("unitId", "=", unitId)
      .executeTakeFirstOrThrow();

    expect(fila.paramsJson).toBeNull();
  });
});

describe("compileDossier de una unidad inexistente", () => {
  it("devuelve null", async () => {
    expect(await compileDossier(createId())).toBeNull();
  });
});

describe("agregadosDeProyectos con una lista vacía", () => {
  it("devuelve un Map vacío, sin consultar la base", async () => {
    const salida = await agregadosDeProyectos([]);
    expect(salida.size).toBe(0);
  });
});

describe("agregadosDeProyectos — una sola moneda entre las unidades con precio", () => {
  it('da el precio "desde": la unidad más barata en esa moneda', async () => {
    const barata = await crearUnidad(`SPEC018-A5-PRECIO-BARATA-${createId()}`, null);
    await db
      .updateTable("Unit")
      .set({ priceMinorUnits: 3_000_000, currency: "USD" })
      .where("id", "=", barata)
      .execute();
    const cara = await crearUnidad(`SPEC018-A5-PRECIO-CARA-${createId()}`, null);
    await db
      .updateTable("Unit")
      .set({ priceMinorUnits: 9_000_000, currency: "USD" })
      .where("id", "=", cara)
      .execute();

    const salida = await agregadosDeProyectos([proyecto]);
    const agregado = salida.get(proyecto);

    expect(agregado?.priceCurrency).toBe("USD");
    expect(agregado?.priceFromMinorUnits).toBeLessThanOrEqual(3_000_000);
  });
});
