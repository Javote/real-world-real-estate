import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { HttpError } from "../lib/http-error";

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

  // Todo lo demás es un fallo nuestro hasta que se demuestre lo contrario.
  // El detalle va al log —único lugar donde se puede mirar en Render, que no da
  // shell (D-040)— y al cliente le va una respuesta que no dice nada de adentro.
  console.error("[error no manejado]", err);

  return res.status(500).json({ message: "Internal server error" });
}
