import { z } from "zod";

// Notificaciones (M2-D5 filas 02, 22, 33-34, 62) — **M3-BE-07**.
//
// **El backend manda claves, no copy** (regla 15, M2-D4 §8.2): `titleKey` es
// una clave del diccionario y `params` lo que hay que interpolar. Una
// notificación que viaje con la frase ya armada rompe el toggle de idioma.
//
// Las cinco categorías son las MISMAS del audit log (M2-D4 P6). No hay una
// sexta: si algo no cae en ninguna, es una decisión nueva, no un valor nuevo.
export const NOTIFICATION_CATEGORIES = [
  "stage",
  "document",
  "release",
  "signature",
  "certificate"
] as const;
export const notificationCategorySchema = z.enum(NOTIFICATION_CATEGORIES);
export type NotificationCategory = z.infer<typeof notificationCategorySchema>;

export const notificationSchema = z.strictObject({
  id: z.string(),
  category: notificationCategorySchema,
  /** Clave del diccionario. El cliente la renderiza según su locale. */
  titleKey: z.string(),
  /** Valores a interpolar. Sin PII: referencias e identificadores opacos. */
  params: z.record(z.string(), z.union([z.string(), z.number()])),
  unitId: z.string().nullable(),
  /** `null` = no leída. */
  readAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date()
});
export type Notification = z.infer<typeof notificationSchema>;

export const unreadCountSchema = z.strictObject({
  unread: z.number().int().nonnegative()
});
export type UnreadCount = z.infer<typeof unreadCountSchema>;

/** Query de `GET /investor/notifications` (filas 22 y 62). */
export const notificationQuerySchema = z.strictObject({
  unitId: z.string().min(1).optional(),
  category: notificationCategorySchema.optional()
});
