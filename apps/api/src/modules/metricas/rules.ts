/** Una proporción, o `null` sin denominador: "no hay datos" no es 0 ni 100% (regla 17). */
export function tasa(numerador: number, denominador: number): number | null {
  return denominador === 0 ? null : numerador / denominador;
}

/**
 * Promedio simple de las tasas que existen (SPEC-504): una unidad no pesa más por tener más stages, y
 * una sin denominador no entra.
 */
export function promedio(tasas: readonly (number | null)[]): number | null {
  const conDatos = tasas.filter((t): t is number => t !== null);
  if (conDatos.length === 0) return null;
  return conDatos.reduce((suma, t) => suma + t, 0) / conDatos.length;
}
