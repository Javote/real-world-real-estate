export function en<T>(arr: readonly T[], i: number): T {
  const valor = arr[i];
  if (valor === undefined) {
    throw new Error(`Index ${i} out of bounds for array of length ${arr.length}`);
  }
  return valor;
}

const comoLoLeeUnaPersona = new Intl.Collator("es", { numeric: true });

/** "UF 2" antes que "UF 10": la base ordena texto, y una referencia de unidad se lee por su número. */
export function porReferencia(a: { unitReference: string }, b: { unitReference: string }): number {
  return comoLoLeeUnaPersona.compare(a.unitReference, b.unitReference);
}

export function porProyecto(a: { projectName: string }, b: { projectName: string }): number {
  return comoLoLeeUnaPersona.compare(a.projectName, b.projectName);
}
