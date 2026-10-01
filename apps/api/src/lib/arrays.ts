export function en<T>(arr: readonly T[], i: number): T {
  const valor = arr[i];
  if (valor === undefined) {
    throw new Error(`Index ${i} out of bounds for array of length ${arr.length}`);
  }
  return valor;
}
