import type { AuditAction, AuditEntityType } from "@plataforma/shared";
import { createId } from "../db/id";
import { db } from "../lib/db";

type EntradaDeAudit = {
  actorUserId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  metadata?: unknown;
};

export async function writeAuditLog(params: EntradaDeAudit) {
  await insertAuditLog(params).execute();
}

// Sin ejecutar: para mandarlo con `enLote` junto con la mutación que audita.
export function insertAuditLog(params: EntradaDeAudit) {
  return db.insertInto("AuditLog").values({
    id: createId(),
    actorUserId: params.actorUserId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
    createdAt: new Date()
  });
}
