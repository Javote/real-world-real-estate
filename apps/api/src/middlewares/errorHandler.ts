import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { HttpError } from "../lib/http-error";

/**
 * Violaciones de restricción de SQLite que **son culpa de lo que mandó el
 * cliente**, no nuestra.
 *
 * `@libsql/client` tira un `LibsqlError` con estos `code`. Se comprobó contra
 * la base real, no contra la documentación: el error trae además un `message`
 * del estilo `UNIQUE constraint failed: Project.slug` — o sea **el nombre de la
 * tabla y de la columna**, que nunca puede salir al cliente (regla 2). Por eso
 * acá se mapea el código a una respuesta genérica y el detalle queda en el log.
 *
 * Exportado porque `lib/error-status.ts` (`statusDeError`) necesita el mismo
 * mapeo — Sentry ve el error antes que este archivo (ver el comentario ahí) y
 * tiene que poder clasificarlo igual, sin duplicar la tabla.
 */
/**
 * SPEC-208 (B-12) — literal, no `string`: con `noUncheckedIndexedAccess`,
 * indexar un `Record<string, T>` da siempre `T | undefined`, aunque el
 * llamador ya haya hecho el `in` que lo garantiza. Con las tres claves
 * como unión, el `in` de `codigoDeRestriccion` sí estrecha el tipo (TS
 * narrowing sobre `in` contra un record de claves literales), y el tipo
 * de retorno deja de mentir sobre qué puede devolver.
 */
export type ConstraintCode =
  | "SQLITE_CONSTRAINT_UNIQUE"
  | "SQLITE_CONSTRAINT_PRIMARYKEY"
  | "SQLITE_CONSTRAINT_FOREIGNKEY";

export const CONSTRAINT_ERRORS: Record<
  ConstraintCode,
  { status: number; code: string; message: string }
> = {
  // Crear algo que ya existe: un slug repetido, dos stages con el mismo orden,
  // dos unidades con la misma referencia. Es 409, no 500 — el servidor está
  // perfectamente sano y el cliente puede corregirlo.
  SQLITE_CONSTRAINT_UNIQUE: {
    status: 409,
    code: "RESOURCE_ALREADY_EXISTS",
    message: "Resource already exists"
  },
  SQLITE_CONSTRAINT_PRIMARYKEY: {
    status: 409,
    code: "RESOURCE_ALREADY_EXISTS",
    message: "Resource already exists"
  },
  // Referenciar algo que no existe (un `userId` inventado en el body). El
  // cliente mandó un id que no resuelve: 400.
  SQLITE_CONSTRAINT_FOREIGNKEY: {
    status: 400,
    code: "RELATED_RESOURCE_NOT_FOUND",
    message: "A referenced resource does not exist"
  }
};

/** `in` sobre un `string` no estrecha a la unión de claves del `Record` por su cuenta; el predicado lo hace explícito. */
function esConstraintCode(codigo: string): codigo is ConstraintCode {
  return codigo in CONSTRAINT_ERRORS;
}

/** El `code` de un error de restricción, mirando también la causa. Exportado por el mismo motivo que `CONSTRAINT_ERRORS`. */
export function codigoDeRestriccion(err: unknown): ConstraintCode | undefined {
  if (typeof err !== "object" || err === null) return undefined;

  const propio = (err as { code?: unknown }).code;
  if (typeof propio === "string" && esConstraintCode(propio)) return propio;

  const causa = (err as { cause?: { code?: unknown } }).cause?.code;
  if (typeof causa === "string" && esConstraintCode(causa)) return causa;

  return undefined;
}

/**
 * El último eslabón: todo lo que nadie manejó termina acá.
 *
 * **Antes devolvía 400 y el `err.message` crudo para CUALQUIER `Error`**, lo que
 * estaba mal en las dos direcciones a la vez:
 *
 * - Un fallo interno (la base caída, un null) contestaba **400 Bad Request**, o
 *   sea que le echaba la culpa al cliente y **el monitoreo nunca veía un 5xx**.
 *   Un servicio que jamás reporta errores de servidor no es un servicio sano:
 *   es uno que no sabe cuándo se rompe.
 * - `err.message` viajaba al cliente. Un error de Kysely/libSQL trae el SQL, los
 *   nombres de tabla y rutas del servidor. En una URL pública eso es filtración
 *   (regla 2: ni URLs internas ni detalle interno afuera).
 *
 * Ahora la pregunta es explícita: **¿este mensaje lo escribimos para que lo lea
 * quien usa la API?** Si sí, va con su status. Si no, es 500 genérico y el
 * detalle queda en el log del servidor, que es donde se mira.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  // Si ya se empezó a escribir la respuesta (por ejemplo `res.download` que
  // falló a mitad del stream), no se puede cambiar el status: lo único correcto
  // es delegarle a Express que corte la conexión.
  if (res.headersSent) {
    return next(err);
  }

  // Mensaje nuestro, pensado para el cliente.
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }

  // Multer: sus mensajes son genéricos y no exponen nada del servidor
  // ("File too large", "Unexpected field"). El código sí es útil para el cliente.
  if (err instanceof MulterError) {
    return res.status(400).json({ message: err.message, code: err.code });
  }

  // Restricción de la base violada por lo que mandó el cliente. **Se resuelve
  // acá y no ruta por ruta a propósito**: son ~10 índices únicos y cada
  // endpoint nuevo que inserte hereda el comportamiento correcto sin acordarse
  // de nada. Un chequeo previo por ruta además no cierra la ventana de carrera
  // —dos requests simultáneos pasan los dos el `select` y uno choca igual—, así
  // que la restricción de la base es la única respuesta verdadera.
  const restriccion = codigoDeRestriccion(err);
  if (restriccion) {
    const { status, code, message } = CONSTRAINT_ERRORS[restriccion];
    // El detalle (tabla y columna) SOLO al log.
    console.error("[restricción de la base]", err);
    return res.status(status).json({ message, code });
  }

  // Todo lo demás es un fallo nuestro hasta que se demuestre lo contrario.
  // El detalle va al log —único lugar donde se puede mirar en Render, que no da
  // shell (D-040)— y al cliente le va una respuesta que no dice nada de adentro.
  console.error("[error no manejado]", err);

  return res.status(500).json({ message: "Internal server error" });
}
