import { z } from "zod";

// Las formas de los parámetros de path (regla 6, la única frontera que
// todavía los dejaba pasar sin Zod). Un schema por FORMA, no por nombre de
// parámetro: varias entidades comparten la misma forma de id, y `fileHash` /
// `shareToken` comparten la de hex64 sin ser la misma cosa (ver abajo).

/**
 * `createId()` de `@paralleldrive/cuid2` (`apps/api/src/db/id.ts`), el
 * generador de TODOS los ids propios del dominio (`Project`, `Stage`,
 * `Evidence`, `User`, `Contract`, `Unit`, `EvidenceBundle`...). Formato por
 * default de la librería: 24 caracteres, minúsculas y dígitos, siempre
 * arrancando con una letra — confirmado generando muestras reales
 * (`createId()` cinco veces), no de la documentación de la librería.
 */
export const cuidParamSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]{23}$/, "No tiene forma de id válido");

/**
 * Hex de 64 caracteres — la forma de un SHA-256. La usan dos cosas distintas
 * por coincidencia de forma, no de origen: `fileHash` es `Evidence.sha256Hash`
 * (el hash real de un archivo) y `shareToken` es
 * `randomBytes(32).toString("hex")` (`investor.routes.ts`, sin relación con
 * ningún hash de contenido). Un schema, dos usos — no son la misma cosa.
 */
export const hex64ParamSchema = z.string().regex(/^[a-f0-9]{64}$/, "No es un hex de 64 caracteres");

/**
 * El número de secuencia de un stage dentro de un contrato
 * (`POST /developer/contracts/:id/releases/:stageNum`). Antes se aceptaba a
 * mano con `Number.parseInt(v, 10)`, que trunca silenciosamente `"1.5"` a
 * `1` — con este schema, `"1.5"` pasa a rechazarse (400), que es lo que la
 * validación de la regla 6 exige y el `parseInt` a mano no daba.
 */
export const positiveIntParamSchema = z.coerce.number().int().positive();
