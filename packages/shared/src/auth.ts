import { z } from "zod";

/** Roles globales. Espeja `enum UserRole` de packages/api/prisma/schema.prisma. */
export const userRoleSchema = z.enum(["admin", "developer", "buyer", "verifier"]);
export type UserRole = z.infer<typeof userRoleSchema>;

/** Body de `POST /api/v1/auth/login`. */
export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(3),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/**
 * El usuario tal como sale de la API.
 *
 * `.strict()` no es decorativo: es la defensa de la regla 4 de CLAUDE.md. Sin
 * él, Zod **descarta** las claves desconocidas en silencio y un `passwordHash`
 * que se filtrara pasaría el schema sin que nadie se entere. Con `.strict()`,
 * el schema falla y el test lo ve.
 */
export const sessionUserSchema = z
  .object({
    id: z.string(),
    email: z.string().email(),
    role: userRoleSchema,
    fullName: z.string(),
  })
  .strict();
export type SessionUser = z.infer<typeof sessionUserSchema>;

/** Respuesta de `POST /api/v1/auth/login`. */
export const loginResponseSchema = z
  .object({
    token: z.string().min(1),
    user: sessionUserSchema,
  })
  .strict();
export type LoginResponse = z.infer<typeof loginResponseSchema>;

/**
 * Respuesta de `GET /api/v1/auth/me`.
 *
 * Trae dos campos más que `sessionUserSchema` porque el endpoint los devuelve.
 * Las fechas viajan como string ISO (JSON no tiene tipo fecha) y en UTC
 * (regla 1 de CLAUDE.md).
 */
export const meResponseSchema = sessionUserSchema
  .extend({
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .strict();
export type MeResponse = z.infer<typeof meResponseSchema>;
