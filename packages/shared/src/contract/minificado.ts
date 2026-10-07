import { minifyContractRouter } from "@orpc/contract";
import { contrato } from "./index";

/**
 * El contrato sin schemas, solo rutas: lo que importa la web para armar su `OpenAPILink` sin traer
 * Zod al bundle (SPEC-609). `pnpm --filter @plataforma/shared contract:min` lo escribe y
 * `contract.test.ts` lo compara con el commiteado.
 */
export function contratoMinificado(): string {
  return `${JSON.stringify(minifyContractRouter(contrato), null, 2)}\n`;
}
