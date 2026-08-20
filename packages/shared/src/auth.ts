import { z } from "zod";

// Idioma Zod 4: `z.email()` y `z.iso.datetime()` en vez de encadenar sobre
// `z.string()`, y `z.strictObject` en vez de `.strict()`. Las formas viejas
// siguen funcionando, pero este archivo es el patrón que copian los schemas de
// cada rebanada: si acá queda el idioma viejo, se replica ochenta veces.

/** Roles globales. Espeja `enum UserRole` de packages/api/prisma/schema.prisma. */
export const userRoleSchema = z.enum(["admin", "developer", "buyer", "verifier"]);
export type UserRole = z.infer<typeof userRoleSchema>;

/** Body de `POST /api/v1/auth/login`. */
export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(3),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/**
 * El usuario tal como sale de la API.
 *
 * `z.strictObject` no es decorativo: es la defensa de la regla 4 de CLAUDE.md.
 * Con un objeto normal, Zod **descarta** las claves desconocidas en silencio y
 * un `passwordHash` que se filtrara pasaría el schema sin que nadie se entere.
 * Estricto, el schema falla y el test lo ve.
 */
export const sessionUserSchema = z.strictObject({
  id: z.string(),
  email: z.email(),
  role: userRoleSchema,
  fullName: z.string(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

/** Respuesta de `POST /api/v1/auth/login`. */
export const loginResponseSchema = z.strictObject({
  token: z.string().min(1),
  user: sessionUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

/**
 * Respuesta de `GET /api/v1/auth/me`.
 *
 * Trae dos campos más que `sessionUserSchema` porque el endpoint los devuelve.
 * Las fechas viajan como string ISO (JSON no tiene tipo fecha) y en UTC
 * (regla 1 de CLAUDE.md).
 */
export const meResponseSchema = sessionUserSchema.extend({
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
