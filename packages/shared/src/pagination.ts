import { z } from "zod";
import { userRoleSchema } from "./auth";

// Paginación por cursor, la misma forma en las tres superficies de historial
// que la piden (M2-D5): certificados del certifier, firmas del notario,
// audit log del developer. Un solo schema en vez de tres copias idénticas
// de `{ cursor, limit }` — si el límite superior cambia, cambia una vez.

export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});
export type CursorPagination = z.infer<typeof cursorPaginationSchema>;

/** `GET /developer/audit-log` — la única de las tres que además filtra por categoría. */
export const auditLogQuerySchema = cursorPaginationSchema.extend({
  category: z.string().optional()
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

/**
 * La forma de respuesta de las tres superficies de historial paginadas por
 * cursor: `{ items, nextCursor }`, con `nextCursor` el ISO del último item o
 * `null` si no hay más. Una función y no un schema fijo porque cada superficie
 * pagina un item distinto (`certifierCertificateSchema`, `notarySignatureSchema`...).
 */
export function paginatedResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return z.strictObject({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable()
  });
}

/**
 * Fila 49 — `GET /developer/audit-log`. `actorName`/`actorRole` son `null`
 * cuando `AuditLog.actorUserId` es `null` o el usuario ya no existe (el
 * `leftJoin` no encuentra fila) — un evento del sistema, no de una persona.
 */
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
