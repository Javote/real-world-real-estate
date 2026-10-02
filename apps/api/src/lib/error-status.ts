import { MulterError } from "multer";
import {
  CONSTRAINT_ERRORS,
  codigoDeRestriccion,
  errorDelCliente
} from "../middlewares/errorHandler.js";
import { HttpError } from "./http-error.js";

export function statusDeError(err: unknown): number {
  if (err instanceof HttpError) return err.status;
  if (err instanceof MulterError) return 400;

  const delCliente = errorDelCliente(err);
  if (delCliente) return delCliente.status;

  const restriccion = codigoDeRestriccion(err);
  if (restriccion) return CONSTRAINT_ERRORS[restriccion].status;

  return 500;
}
