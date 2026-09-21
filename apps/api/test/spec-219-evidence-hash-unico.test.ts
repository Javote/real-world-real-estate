import { afterAll, describe, expect, it } from "vitest";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// SPEC-219 (anexo de SPEC-218) — `Evidence_stageId_sha256Hash_key` (migración
// 0009) es la red de seguridad de la base contra la carrera que el chequeo de
// aplicación de SPEC-218 no cierra: dos requests simultáneos con el mismo
// archivo pueden pasar los dos el "leer y después escribir" antes de que
// cualquiera inserte. Este archivo prueba el ÍNDICE solo, insertando directo
// contra `Evidence` — no pasa por la ruta HTTP de la subida (WIP de SPEC-218
// al escribir esto), que es donde vive la traducción a la respuesta 409 con
// limpieza que la spec describe en su paso 3.

let proyecto: string;
let developer: string;

async function contexto() {
  proyecto ??= (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
  developer ??= (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow()
  ).id;
  return { proyecto, developer };
}

async function crearStage(sequenceOrder: number) {
  const { proyecto } = await contexto();
  const ahora = new Date();
  return (
    await db
      .insertInto("Stage")
      .values({
        id: createId(),
        projectId: proyecto,
        name: `SPEC-219 stage ${sequenceOrder}`,
        sequenceOrder,
        state: "Pending",
        validationCritical: false,
        certifiedAt: null,
        certifiedById: null,
        createdAt: ahora,
        updatedAt: ahora
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  ).id;
}

async function insertarEvidencia(opts: { stageId: string | null; sha256Hash: string }) {
  const { proyecto, developer } = await contexto();
  const ahora = new Date();
  return db
    .insertInto("Evidence")
    .values({
      id: createId(),
      projectId: proyecto,
      stageId: opts.stageId,
      uploadedById: developer,
      evidenceType: "document",
      category: "plano",
      authoritative: false,
      issuingAuthority: null,
      originalFilename: "spec-219.pdf",
      storedFilename: `spec-219-${createId()}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 10,
      storagePath: `spec-219/${createId()}.pdf`,
      sha256Hash: opts.sha256Hash,
      uploadedAt: ahora,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
}

afterAll(async () => {
  await db.destroy();
});

describe("el índice único Evidence_stageId_sha256Hash_key", () => {
  it("dos INSERT directos con el mismo (stageId, sha256Hash): el segundo rechaza", async () => {
    const stage = await crearStage(995_219_1);
    const hash = "a".repeat(64);

    await insertarEvidencia({ stageId: stage, sha256Hash: hash });

    await expect(insertarEvidencia({ stageId: stage, sha256Hash: hash })).rejects.toThrow();

    const filas = await db
      .selectFrom("Evidence")
      .select("id")
      .where("stageId", "=", stage)
      .where("sha256Hash", "=", hash)
      .execute();
    expect(filas).toHaveLength(1);
  });

  it("el mismo hash en dos stages distintos: se acepta", async () => {
    const stageA = await crearStage(995_219_2);
    const stageB = await crearStage(995_219_3);
    const hash = "b".repeat(64);

    await insertarEvidencia({ stageId: stageA, sha256Hash: hash });
    await expect(insertarEvidencia({ stageId: stageB, sha256Hash: hash })).resolves.not.toThrow();
  });

  it("dos filas con stageId NULL y el mismo hash: se aceptan las dos (el límite documentado del índice)", async () => {
    const hash = "c".repeat(64);

    await insertarEvidencia({ stageId: null, sha256Hash: hash });
    await expect(insertarEvidencia({ stageId: null, sha256Hash: hash })).resolves.not.toThrow();
  });

  it("la carrera real: dos INSERT concurrentes con el mismo archivo — uno pasa, el otro rechaza, una sola fila", async () => {
    const stage = await crearStage(995_219_4);
    const hash = "d".repeat(64);

    const resultados = await Promise.allSettled([
      insertarEvidencia({ stageId: stage, sha256Hash: hash }),
      insertarEvidencia({ stageId: stage, sha256Hash: hash })
    ]);

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(resultados.filter((r) => r.status === "rejected")).toHaveLength(1);

    const filas = await db
      .selectFrom("Evidence")
      .select("id")
      .where("stageId", "=", stage)
      .where("sha256Hash", "=", hash)
      .execute();
    expect(filas).toHaveLength(1);
  });
});
