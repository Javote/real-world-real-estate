import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "../src/db/id";
import { db, enLote } from "../src/lib/db";
import { insertAuditLog } from "../src/utils/audit";
import { FIXTURES } from "./global-setup";
import { crearStageMinteado } from "./helpers/stages";

let stage: string;
let actor: string;

beforeAll(async () => {
  const proyecto = await db
    .selectFrom("Project")
    .select("id")
    .where("slug", "=", FIXTURES.proyecto.slug)
    .executeTakeFirstOrThrow();
  actor = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow()
  ).id;
  stage = (
    await crearStageMinteado({
      projectId: proyecto.id,
      name: "Original",
      sequenceOrder: 902,
      actorUserId: actor
    })
  ).id;
});

afterAll(async () => {
  await db.destroy();
});

const renombrar = (name: string) =>
  db
    .updateTable("Stage")
    .set({ name, updatedAt: new Date() })
    .where("id", "=", stage)
    .returningAll();

describe("enLote", () => {
  it("devuelve las filas de cada sentencia con los tipos de Kysely", async () => {
    const [[actualizado], audit] = await enLote(
      renombrar("Renombrada"),
      insertAuditLog({
        actorUserId: actor,
        action: "UPDATE_STAGE",
        entityType: "Stage",
        entityId: stage
      })
    );

    expect(actualizado?.name).toBe("Renombrada");
    expect(actualizado?.updatedAt).toBeInstanceOf(Date);
    expect(typeof actualizado?.validationCritical).toBe("boolean");
    expect(audit).toEqual([]);
  });

  it("es atómico: si el audit falla, la mutación tampoco queda", async () => {
    const fila = {
      id: createId(),
      actorUserId: actor,
      action: "UPDATE_STAGE" as const,
      entityType: "Stage" as const,
      entityId: stage,
      metadataJson: null,
      createdAt: new Date()
    };
    await db.insertInto("AuditLog").values(fila).execute();
    const conIdRepetido = db.insertInto("AuditLog").values(fila);

    await expect(enLote(renombrar("No tiene que quedar"), conIdRepetido)).rejects.toThrow();

    const actual = await db
      .selectFrom("Stage")
      .select("name")
      .where("id", "=", stage)
      .executeTakeFirstOrThrow();
    expect(actual.name).toBe("Renombrada");
  });
});
