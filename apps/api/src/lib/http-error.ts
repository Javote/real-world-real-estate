/**
 * Un error cuyo mensaje es **seguro de mostrarle al cliente**.
 *
 * Existe para que el `errorHandler` pueda distinguir dos cosas que antes
 * trataba igual: "el cliente mandó algo mal, y contarle qué lo ayuda" contra
 * "algo se rompió adentro, y contarle qué es filtrar información". Sin esta
 * distinción la única salida era exponer `err.message` de todo —que en un error
 * de Kysely/libSQL trae SQL, nombres de tabla y rutas de archivo del servidor— o
 * no explicar nada nunca.
 *
 * Regla: si el mensaje lo escribimos nosotros pensando en quien usa la API, va
 * acá. Si viene de una librería o del runtime, NO.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}
