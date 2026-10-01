import { z } from "zod";
import { userRoleSchema } from "./auth";

export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});
export type CursorPagination = z.infer<typeof cursorPaginationSchema>;

export const auditLogQuerySchema = cursorPaginationSchema.extend({
  category: z.string().optional()
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export function paginatedResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return z.strictObject({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable()
  });
}

export const auditLogEntrySchema = z.strictObject({
  id: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  metadataJson: z.string().nullable(),
  createdAt: z.coerce.date(),
  actorName: z.string().nullable(),
  actorRole: userRoleSchema.nullable()
});
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

export const auditLogRowSchema = z.strictObject({
  id: z.string(),
  actorUserId: z.string().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  metadataJson: z.string().nullable(),
  createdAt: z.coerce.date()
});
export type AuditLogRow = z.infer<typeof auditLogRowSchema>;
