import { z } from "zod";

// Idioma Zod 4: `z.email()` y `z.iso.datetime()` en vez de encadenar sobre
// `z.string()`, y `z.strictObject` en vez de `.strict()`. Las formas viejas
// siguen funcionando, pero este archivo es el patrón que copian los schemas de
// cada rebanada: si acá queda el idioma viejo, se replica ochenta veces.

/** Roles globales. Espeja `enum UserRole` de packages/api/prisma/schema.prisma. */
export const userRoleSchema = z.enum(["admin", "developer", "buyer", "verifier"]);
export type UserRole = z.infer<typeof userRoleSchema>;

/** Largo mínimo en caracteres: el SHALL de NIST SP 800-63B §5.1.1.2 (D-046). */
export const PASSWORD_MIN_CHARS = 8;

/**
 * Largo máximo en BYTES. Es el límite de bcrypt, que más allá de 72 **trunca en
 * silencio**: sin esto, una passphrase larga tendría hasheados solo los primeros
 * 72 bytes y nadie se enteraría. NIST prohíbe truncar, así que se rechaza.
 */
export const PASSWORD_MAX_BYTES = 72;

/**
 * Largo en bytes UTF-8, contado a mano.
 *
 * Ni `Buffer` (Node) ni `TextEncoder` (DOM): el `lib` de este package es
 * `["ES2022"]` pelado a propósito, porque lo consumen la API y el browser. Meter
 * `DOM` acá para una línea le abriría a `packages/api` todos los globals del
 * navegador, que es un precio alto por evitar ocho líneas.
 *
 * El `for...of` sobre un string itera **code points**, no unidades UTF-16, así
 * que los pares suplentes —emoji incluidos— cuentan una vez y no dos.
 */
function byteLength(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const cp = char.codePointAt(0) ?? 0;
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/**
 * La política de passwords, en un solo lugar (D-046).
 *
 * Deliberadamente **no** hay reglas de composición —nada de "una mayúscula y un
 * número"— porque NIST lo prohíbe explícitamente: empujan a `Password1!` y bajan
 * la entropía real. Y el alfabeto es todo: espacios, Unicode y emoji incluidos.
 * Si alguna vez aparece acá un `.regex(...)` restringiendo caracteres, está mal.
 *
 * Se aplica donde la password se ESCRIBE (`POST /users`, `PATCH /users/:id`), no
 * donde se verifica: ver el comentario de `loginRequestSchema`.
 */
export const passwordSchema = z
  .string()
  // `.min()` de Zod cuenta unidades UTF-16, no caracteres: cuatro emoji dan
  // `.length === 8` y pasarían un mínimo de 8 con la mitad de los caracteres que
  // el mínimo pide. `[...pw]` itera code points, que es lo que NIST llama
  // "characters".
  .refine((pw) => [...pw].length >= PASSWORD_MIN_CHARS, {
    message: `La contraseña necesita al menos ${PASSWORD_MIN_CHARS} caracteres`,
  })
  .refine((pw) => byteLength(pw) <= PASSWORD_MAX_BYTES, {
    message: `La contraseña no puede superar los ${PASSWORD_MAX_BYTES} bytes`,
  });

/**
 * Body de `POST /api/v1/auth/login`.
 *
 * `password` NO valida la política a propósito (D-046). Hacerlo convertiría al
 * login en un oráculo de cuál es la política, y dejaría afuera a cuentas creadas
 * bajo una anterior. Acá solo se exige que venga algo, con un techo generoso que
 * es higiene de entrada y no política.
 */
export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(1024),
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
