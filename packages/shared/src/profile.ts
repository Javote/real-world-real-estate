import { z } from "zod";
import { userRoleSchema } from "./auth";

export const profileSchema = z.strictObject({
  id: z.string(),
  email: z.string(),
  role: userRoleSchema,
  fullName: z.string(),
  isActive: z.boolean(),
  notificationPrefsJson: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type Profile = z.infer<typeof profileSchema>;

const notificationPrefsFields = {
  stage: z.boolean(),
  document: z.boolean(),
  release: z.boolean(),
  signature: z.boolean(),
  certificate: z.boolean()
};

export const notificationPrefsSchema = z.strictObject({
  stage: z.boolean().default(true),
  document: z.boolean().default(true),
  release: z.boolean().default(true),
  signature: z.boolean().default(true),
  certificate: z.boolean().default(true)
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

export const updateProfileSchema = z.strictObject({ fullName: z.string().min(1).max(120) });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateNotificationPrefsSchema = z.strictObject(notificationPrefsFields).partial();
export type UpdateNotificationPrefsInput = z.infer<typeof updateNotificationPrefsSchema>;
