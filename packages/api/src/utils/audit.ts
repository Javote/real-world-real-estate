import { db } from "../lib/db";
import { auditLogs } from "../db/schema";

export async function writeAuditLog(params: {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: unknown;
}) {
  await db.insert(auditLogs).values({
    actorUserId: params.actorUserId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    metadataJson: params.metadata ? JSON.stringify(params.metadata) : null
  });
}
