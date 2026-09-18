import type { AuditAction, AuditEntityType } from "@plataforma/shared";
import { createId } from "../db/id";
import { db } from "../lib/db";

// SPEC-207 (B-09): `action`/`entityType` tipados contra las uniones de
// `packages/shared` — antes eran `string` a secas, y las tres listas (acá,
// `auditScope` y el diccionario del front) coincidían porque alguien se
// acordaba, no porque algo lo obligara. Una `action` o un `entityType` nuevo
// ahora es un renglón deliberado en `AUDIT_ACTIONS`/`AUDIT_ENTITY_TYPES`
// (`packages/shared/src/audit.ts`), no un string que se le ocurre a un call
// site.
export async function writeAuditLog(params: {
  actorUserId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
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
