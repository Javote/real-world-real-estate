import { afterAll, describe, expect, it } from "vitest";
import { sembrarUnidadVendida } from "../src/db/fixtures.js";
import { createId } from "../src/db/id.js";
import { db } from "../src/lib/db.js";
import { leerDeLaUnidad } from "../src/modules/dossier/casos.js";
import { FIXTURES } from "./global-setup.js";

let proyecto: string;

async function crearUnidad(reference: string) {
  const ahora = new Date();
  const id = createId();
  await db
    .insertInto("Unit")
    .values({
      id,
      projectId: proyecto,
      unitReference: reference,
      status: "available",
      priceMinorUnits: 5_000_000,
      currency: "USD",
      investorId: null,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

afterAll(async () => {
  await db.destroy();
});

describe("el índice único de Dossier.unitId", () => {
  it("existe y rechaza un segundo insert directo sobre la misma unidad", async () => {
    proyecto ??= (
      await db
        .selectFrom("Project")
        .select("id")
        .where("slug", "=", FIXTURES.proyecto.slug)
        .executeTakeFirstOrThrow()
    ).id;

    const unidad = await crearUnidad(`SPEC202-IDX-${createId()}`);
    const ahora = new Date();

    await db
      .insertInto("Dossier")
      .values({
        id: createId(),
        unitId: unidad,
        masterHash: "a".repeat(64),
        compiledAt: ahora,
        shareToken: null,
        status: "compiled",
        signedById: null,
        signedAt: null,
        rejectionNote: null
      })
      .execute();

    await expect(
      db
        .insertInto("Dossier")
        .values({
          id: createId(),
          unitId: unidad,
          masterHash: "b".repeat(64),
          compiledAt: ahora,
          shareToken: null,
          status: "compiled",
          signedById: null,
          signedAt: null,
          rejectionNote: null
        })
        .execute()
    ).rejects.toThrow();
  });
});

describe("un dossier firmado (invariante 2)", () => {
  it("leerlo devuelve el masterHash firmado aunque cambie lo que compromete", async () => {
    proyecto ??= (
      await db
        .selectFrom("Project")
        .select("id")
        .where("slug", "=", FIXTURES.proyecto.slug)
        .executeTakeFirstOrThrow()
    ).id;

    const investor = await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.investor.email)
      .executeTakeFirstOrThrow();
    const { unitId: unidad } = await sembrarUnidadVendida(db, {
      projectId: proyecto,
      investorId: investor.id,
      unitReference: `SPEC202-SIGNED-${createId()}`,
      floor: 1,
      sizeM2: 40,
      priceMinorUnits: 5_000_000,
      currency: "USD"
    });

    const hashFirmado = "c".repeat(64);
    await db
      .updateTable("Dossier")
      .set({ status: "signed", masterHash: hashFirmado, signedAt: new Date() })
      .where("unitId", "=", unidad)
      .execute();

    const ahora = new Date();
    const developer = await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow();
    await db
      .insertInto("Evidence")
      .values({
        id: createId(),
        projectId: proyecto,
        stageId: null,
        uploadedById: developer.id,
        evidenceType: "document",
        category: "plano",
        authoritative: false,
        issuingAuthority: null,
        originalFilename: "algo.pdf",
        storedFilename: "algo-guardado.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
        storagePath: "algo.pdf",
        sha256Hash: "d".repeat(64),
        uploadedAt: ahora,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();

    const releida = await leerDeLaUnidad({ db, clock: () => new Date() }, unidad);
    expect(releida).toMatchObject({
      ok: true,
      value: { masterHash: hashFirmado, status: "signed" }
    });

    const filas = await db.selectFrom("Dossier").selectAll().where("unitId", "=", unidad).execute();
    expect(filas).toHaveLength(1);
  });
});
