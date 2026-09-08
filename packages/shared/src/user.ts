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
