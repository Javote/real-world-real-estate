import { describe, expect, it } from "vitest";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { writeAuditLog } from "../src/utils/audit";

// SPEC-018 §A6 — `writeAuditLog` sin `actorUserId`: todo call site real de
// `src/routes/**` tiene un actor autenticado, así que ningún test de HTTP
// llega nunca al lado `?? null` de esa línea. Es el evento de sistema (un
// seed, una migración de datos) que hoy no tiene caller pero que la firma
// deja abierto a propósito — `actorUserId` es opcional.

describe("writeAuditLog sin actorUserId", () => {
  it("escribe la fila con actorUserId en null, no con undefined ni con un string vacío", async () => {
    const entityId = createId();

    await writeAuditLog({
      action: "STAGE_WORK_INITIATED",
      entityType: "Stage",
      entityId
    });

    const fila = await db
      .selectFrom("AuditLog")
      .selectAll()
      .where("entityId", "=", entityId)
      .where("action", "=", "STAGE_WORK_INITIATED")
      .executeTakeFirstOrThrow();

    expect(fila.actorUserId).toBeNull();
  });
});
