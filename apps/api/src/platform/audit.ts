import type { AuditAction, AuditEntityType } from "@plataforma/shared";
import { createId } from "../db/id.js";
import type { Database } from "../db/types.js";
import type { Kysely } from "../lib/kysely.js";

/** Contra qué se escribe: `db` o una transacción abierta con `db.transaction()`. */
export type Ejecutor = Kysely<Database>;

export type EntradaDeAudit = {
  actorUserId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  metadata?: unknown;
};

/**
 * La fila de audit, sin ejecutar: `await audit(trx, entrada).execute()` adentro de una transacción, o
 * `enLote(mutacion, audit(db, entrada))` para que viaje en el mismo `batch` que lo que audita.
 */
export function audit(ejecutor: Ejecutor, entrada: EntradaDeAudit) {
  return ejecutor.insertInto("AuditLog").values({
    id: createId(),
    actorUserId: entrada.actorUserId ?? null,
    action: entrada.action,
    entityType: entrada.entityType,
    entityId: entrada.entityId,
    metadataJson: entrada.metadata ? JSON.stringify(entrada.metadata) : null,
    createdAt: new Date()
  });
}
