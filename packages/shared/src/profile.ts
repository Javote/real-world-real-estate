import { z } from "zod";
import { userRoleSchema } from "./auth";

// Perfil y preferencias (M2-D5 fila 30 y sus equivalentes por rol).
//
// **Es UNA superficie con cuatro entradas.** M2-D5 §3 lo declara: *"`/profile`
// and `/profile/notifications` operate on the authenticated user regardless of
// role"*. Por eso hay un solo schema y no cuatro — los campos propios de cada
// rol (credenciales del notario, matrícula del certificador) se anidan cuando
// existan, no se duplica la superficie.

export const profileSchema = z.strictObject({
  id: z.string(),
  email: z.string(),
  role: userRoleSchema,
  fullName: z.string(),
  isActive: z.boolean(),
  /** JSON crudo de preferencias. `null` mientras el usuario no tocó ninguna. */
  notificationPrefsJson: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type Profile = z.infer<typeof profileSchema>;

/**
 * Preferencias de notificación.
 *
 * **Todas arrancan en `true`.** Un usuario que nunca tocó la pantalla quiere
 * enterarse de lo que pasa con su operación; el opt-in silencioso haría que se
 * pierda el aviso de que su dossier se firmó.
 */
export const notificationPrefsSchema = z.strictObject({
  stage: z.boolean().default(true),
  document: z.boolean().default(true),
  release: z.boolean().default(true),
  signature: z.boolean().default(true),
  certificate: z.boolean().default(true)
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;
