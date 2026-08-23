import { createId } from "../db/id";
import { db } from "../lib/db";

export async function writeAuditLog(params: {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: unknown;
}) {
  await db
    .insertInto("AuditLog")
    .values({
      id: createId(),
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
      createdAt: new Date()
    })
    .execute();
}
