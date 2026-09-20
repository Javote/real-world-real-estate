/**
 * SPEC-208 (B-12) — un acceso `arr[i]` que ya está probado en rango por
 * construcción (el llamador acaba de calcular `i` a partir del mismo
 * `arr.length`) sigue devolviendo `T | undefined` bajo
 * `noUncheckedIndexedAccess`. Esto documenta la garantía en vez de
 * silenciarla con un cast: si algún día deja de cumplirse, tira acá y no
 * tres funciones más abajo con un `NaN` o un `undefined` calmado.
 */
export function en<T>(arr: readonly T[], i: number): T {
  const valor = arr[i];
  if (valor === undefined) {
    throw new Error(`Index ${i} out of bounds for array of length ${arr.length}`);
  }
  return valor;
}
