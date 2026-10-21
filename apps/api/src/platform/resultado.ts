import type { ErrorCode, Result } from "@plataforma/shared";

/**
 * El valor, o el error que el contrato declara para el código del caso de uso. Un código que el
 * procedimiento no declara no compila.
 */
export function valor<T, C extends ErrorCode>(
  resultado: Result<T, C>,
  errores: Record<C, () => Error>
): T {
  if (resultado.ok) return resultado.value;
  throw errores[resultado.code]();
}
