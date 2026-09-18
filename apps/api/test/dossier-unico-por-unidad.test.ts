import { afterAll, describe, expect, it } from "vitest";
import { compileDossier } from "../src/domain/dossier";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// SPEC-202 (B-02) — reproduce el duplicado de la auditoría del backend
// (2026-09-11) y prueba que queda cerrado: `Dossier_unitId_key` (migración
// 0006) hace que dos compilaciones concurrentes de la misma unidad no puedan
// terminar en dos filas.

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

describe("compileDossier bajo concurrencia (invariante 2)", () => {
  it("Promise.all([compileDossier(u), compileDossier(u)]) devuelve el MISMO id, una sola fila", async () => {
    proyecto ??= (
      await db
        .selectFrom("Project")
        .select("id")
        .where("slug", "=", FIXTURES.proyecto.slug)
        .executeTakeFirstOrThrow()
    ).id;

    const unidad = await crearUnidad(`SPEC202-CONC-${createId()}`);

    const [a, b] = await Promise.all([compileDossier(unidad), compileDossier(unidad)]);

    expect(a?.id).toBeDefined();
    expect(a?.id).toBe(b?.id);

    const filas = await db
      .selectFrom("Dossier")
      .selectAll()
      .where("unitId", "=", unidad)
      .execute();
    expect(filas).toHaveLength(1);
  });

  it("compilar una unidad con dossier ya firmado devuelve la firmada y no recompila el masterHash", async () => {
    proyecto ??= (
      await db
        .selectFrom("Project")
        .select("id")
        .where("slug", "=", FIXTURES.proyecto.slug)
        .executeTakeFirstOrThrow()
    ).id;

    const unidad = await crearUnidad(`SPEC202-SIGNED-${createId()}`);
    const primera = await compileDossier(unidad);
    expect(primera).not.toBeNull();

    const hashFirmado = "c".repeat(64);
    await db
      .updateTable("Dossier")
      .set({ status: "signed", masterHash: hashFirmado, signedAt: new Date() })
      .where("id", "=", primera!.id)
      .execute();

    // Evidencia nueva cambiaría el hash calculado si se recompilara — el
    // punto es que, firmado, no se recompila (comentario de `dossier.ts`).
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

    const releida = await compileDossier(unidad);
    expect(releida?.id).toBe(primera!.id);
    expect(releida?.masterHash).toBe(hashFirmado);
    expect(releida?.status).toBe("signed");

    const filas = await db
      .selectFrom("Dossier")
      .selectAll()
      .where("unitId", "=", unidad)
      .execute();
    expect(filas).toHaveLength(1);
  });
});
