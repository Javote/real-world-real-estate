import { z } from "zod";

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
  titleKey: z.string(),
  params: z.record(z.string(), z.union([z.string(), z.number()])),
  unitId: z.string().nullable(),
  readAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date()
});
export type Notification = z.infer<typeof notificationSchema>;

export const unreadCountSchema = z.strictObject({
  unread: z.number().int().nonnegative()
});
export type UnreadCount = z.infer<typeof unreadCountSchema>;

export const notificationQuerySchema = z.strictObject({
  unitId: z.string().min(1).optional(),
  category: notificationCategorySchema.optional()
});
export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
