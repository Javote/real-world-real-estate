import { z } from "zod";
import { passwordSchema, userRoleSchema } from "./auth";

// La administración de usuarios (`/users`, admin-only). Distinto de
// `auth.ts`: ahí vive la sesión (login, `/me`); acá, el alta y la edición.

/** Body de `POST /api/v1/users`. */
export const createUserSchema = z.object({
  email: z.email(),
  password: passwordSchema,
  role: userRoleSchema,
  fullName: z.string().min(1)
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

/** Body de `PATCH /api/v1/users/:id`. Todo opcional, incluida la password. */
export const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
  password: passwordSchema.optional()
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * `GET /api/v1/users` (array) y `GET /api/v1/users/:id`. Nunca `passwordHash`
 * (regla 4) — la lista de columnas del `select` es la única fuente, este
 * schema describe esa misma forma.
 */
export const userSummarySchema = z.strictObject({
  id: z.string(),
  email: z.email(),
  role: userRoleSchema,
  fullName: z.string(),
  isActive: z.boolean(),
  createdAt: z.coerce.date()
});
export type UserSummary = z.infer<typeof userSummarySchema>;

/**
 * `POST /api/v1/users` y `PATCH /api/v1/users/:id`. Un `.returning()` más
 * angosto que el `select` de arriba —sin `createdAt`— porque el `RETURNING`
 * de la fila recién escrita nunca lo pidió; es la forma real, no una que
 * "debería" incluirlo.
 */
export const userMutationResultSchema = z.strictObject({
  id: z.string(),
  email: z.email(),
  role: userRoleSchema,
  fullName: z.string(),
  isActive: z.boolean()
});
export type UserMutationResult = z.infer<typeof userMutationResultSchema>;
