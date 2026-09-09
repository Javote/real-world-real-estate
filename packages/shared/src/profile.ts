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

/** Las cinco categorías, sin default: la base que comparten las dos formas de abajo. */
const notificationPrefsFields = {
  stage: z.boolean(),
  document: z.boolean(),
  release: z.boolean(),
  signature: z.boolean(),
  certificate: z.boolean()
};

/**
 * Preferencias de notificación, completas.
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

/**
 * Body de `PATCH /api/v1/profile`. Sin `email` ni `role` a propósito: cambiar
 * el rol por acá sería una escalada de privilegios con forma de preferencia.
 */
export const updateProfileSchema = z.strictObject({ fullName: z.string().min(1).max(120) });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Body de `PATCH /api/v1/profile/notifications`. Parcial: un PATCH que manda
 * una sola preferencia no puede apagar las otras cuatro (merge, no reemplazo,
 * ver `profile.routes.ts`).
 *
 * **`.partial()` va sobre `notificationPrefsFields` (sin default), no sobre
 * `notificationPrefsSchema`.** Un bug real, encontrado escribiendo el test de
 * la Tanda 2: `z.boolean().default(true)` sigue aplicando el default a una
 * clave ausente aunque esté envuelta en `.optional()` — así que
 * `notificationPrefsSchema.partial()` no dejaba pasar `undefined`, mandaba
 * `true` para las cuatro claves no tocadas. Con el merge de `profile.routes.ts`
 * eso pisaba en silencio cualquier preferencia distinta de `true` que ya
 * hubiera guardada: cada PATCH revertía las demás cuatro, exactamente lo que
 * este comentario decía que no podía pasar.
 */
export const updateNotificationPrefsSchema = z.strictObject(notificationPrefsFields).partial();
export type UpdateNotificationPrefsInput = z.infer<typeof updateNotificationPrefsSchema>;
