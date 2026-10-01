import { z } from "zod";

export const cuidParamSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]{23}$/, "No tiene forma de id válido");

export const hex64ParamSchema = z.string().regex(/^[a-f0-9]{64}$/, "No es un hex de 64 caracteres");

export const positiveIntParamSchema = z.coerce.number().int().positive();
