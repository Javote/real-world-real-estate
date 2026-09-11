import { MulterError } from "multer";
import { CONSTRAINT_ERRORS, codigoDeRestriccion } from "../middlewares/errorHandler";
import { HttpError } from "./http-error";

/**
 * El status HTTP que `errorHandler` le va a devolver a este error — sin
 * escribir la respuesta ni loguear nada.
 *
 * **Por qué existe, aparte de `errorHandler`:** `Sentry.setupExpressErrorHandler`
 * corre ANTES que `errorHandler` (`app.ts` lo explica), así que sin esto Sentry
 * ve el error crudo, sin status todavía, y su default (`!status || status >=
 * 500`) lo reporta como "Unhandled" — un `SQLITE_CONSTRAINT_UNIQUE` que
 * `errorHandler` va a devolver como un 409 perfectamente sano aparece en
 * Sentry mezclado con los fallos de verdad. Esta función le hace a Sentry la
 * misma pregunta que `errorHandler`, un paso antes: ¿esto es un 5xx? Reusa el
 * mapeo de `errorHandler` en vez de copiarlo, así que no hay dos tablas que
 * mantener sincronizadas.
 */
export function statusDeError(err: unknown): number {
  if (err instanceof HttpError) return err.status;
  if (err instanceof MulterError) return 400;

  const restriccion = codigoDeRestriccion(err);
  if (restriccion) return CONSTRAINT_ERRORS[restriccion].status;

  return 500;
}
