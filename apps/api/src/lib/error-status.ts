import { MulterError } from "multer";
import { CONSTRAINT_ERRORS, codigoDeRestriccion } from "../middlewares/errorHandler";
import { HttpError } from "./http-error";

export function statusDeError(err: unknown): number {
  if (err instanceof HttpError) return err.status;
  if (err instanceof MulterError) return 400;

  const restriccion = codigoDeRestriccion(err);
  if (restriccion) return CONSTRAINT_ERRORS[restriccion].status;

  return 500;
}
