import { prisma } from "../lib/prisma";

export async function writeAuditLog(params: {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      actorUserId: params.actorUserId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadataJson: params.metadata ? JSON.stringify(params.metadata) : null
    }
  });
}
