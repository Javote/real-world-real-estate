import type { NextFunction, Response } from "express";
import type { ZodType } from "zod";

// Path params con Zod (regla 6, la única frontera de entrada que seguía sin
// validar). Se conecta con `router.param(nombre, ...)` en vez de un middleware
// por ruta: el mismo nombre de param (`id`, `stageId`, `bundleId`...) tiene
// SIEMPRE la misma forma en todo el dominio (ver `packages/shared/src/params.ts`),
// así que un `router.param` por nombre cubre todas las rutas de ese router que
// lo usan, sin repetir la validación 51 veces.
//
// **Invisible para `route-inventory.ts` a propósito.** `router.param()` no
// vive en `capa.route.stack` (Express lo guarda aparte, en el router), así que
// ni la matriz de `route-guards.test.ts` ni el handler terminal que lee
// `generate-openapi.ts` lo ven — no hay nada que actualizar ahí. El documento
// OpenAPI conoce la forma real de cada param por su NOMBRE, en una tabla
// aparte (`PARAM_SCHEMAS` de `generate-openapi.ts`), no por introspección.

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
