import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { HttpError } from "../lib/http-error";

export type ConstraintCode =
  | "SQLITE_CONSTRAINT_UNIQUE"
  | "SQLITE_CONSTRAINT_PRIMARYKEY"
  | "SQLITE_CONSTRAINT_FOREIGNKEY";

export const CONSTRAINT_ERRORS: Record<
  ConstraintCode,
  { status: number; code: string; message: string }
> = {
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
  SQLITE_CONSTRAINT_FOREIGNKEY: {
    status: 400,
    code: "RELATED_RESOURCE_NOT_FOUND",
    message: "A referenced resource does not exist"
  }
};

function esConstraintCode(codigo: string): codigo is ConstraintCode {
  return codigo in CONSTRAINT_ERRORS;
}

export function codigoDeRestriccion(err: unknown): ConstraintCode | undefined {
  if (typeof err !== "object" || err === null) return undefined;

  const propio = (err as { code?: unknown }).code;
  if (typeof propio === "string" && esConstraintCode(propio)) return propio;

  const causa = (err as { cause?: { code?: unknown } }).cause?.code;
  if (typeof causa === "string" && esConstraintCode(causa)) return causa;

  return undefined;
}

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }

  if (err instanceof MulterError) {
    return res.status(400).json({ message: err.message, code: err.code });
  }

  const restriccion = codigoDeRestriccion(err);
  if (restriccion) {
    const { status, code, message } = CONSTRAINT_ERRORS[restriccion];
    console.error("[restricción de la base]", err);
    return res.status(status).json({ message, code });
  }

  console.error("[error no manejado]", err);

  return res.status(500).json({ message: "Internal server error" });
}
