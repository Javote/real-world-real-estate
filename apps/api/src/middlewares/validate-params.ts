import type { NextFunction, Response } from "express";
import type { ZodType } from "zod";

export function paramValidator(schema: ZodType) {
  return (_req: unknown, res: Response, next: NextFunction, value: string) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Parámetro de path inválido", ...parsed.error.flatten() });
    }
    return next();
  };
}
