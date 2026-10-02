import { z } from "zod";

export const userRoleSchema = z.enum(["admin", "developer", "buyer", "verifier", "notary"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const PASSWORD_MIN_CHARS = 8;

export const PASSWORD_MAX_BYTES = 72;

function byteLength(value: string): number {
  let bytes = 0;
  for (const char of value) {
    /* v8 ignore next -- @preserve: cada `char` de un `for...of` sobre un string es un code point completo y no vacío; `codePointAt(0)` nunca da `undefined` acá */
    const cp = char.codePointAt(0) ?? 0;
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return bytes;
}

export const passwordSchema = z
  .string()
  .refine((pw) => [...pw].length >= PASSWORD_MIN_CHARS, {
    message: `La contraseña necesita al menos ${PASSWORD_MIN_CHARS} caracteres`
  })
  .refine((pw) => byteLength(pw) <= PASSWORD_MAX_BYTES, {
    message: `La contraseña no puede superar los ${PASSWORD_MAX_BYTES} bytes`
  });

// Sin la política de passwords a propósito: el login no puede ser un oráculo de ella.
export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(1024)
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

// `strictObject`: un campo de más (como `passwordHash`) hace fallar la respuesta.
export const sessionUserSchema = z.strictObject({
  id: z.string(),
  email: z.email(),
  role: userRoleSchema,
  fullName: z.string()
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const loginResponseSchema = z.strictObject({
  token: z.string().min(1),
  user: sessionUserSchema
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const meResponseSchema = sessionUserSchema.extend({
  isActive: z.boolean(),
  createdAt: z.iso.datetime()
});
export type MeResponse = z.infer<typeof meResponseSchema>;
