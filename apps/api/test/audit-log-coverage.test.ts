import { describe, expect, it } from "vitest";
import { createId } from "../src/db/id.js";
import { db } from "../src/lib/db.js";
import { writeAuditLog } from "../src/utils/audit.js";

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
