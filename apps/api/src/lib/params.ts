/**
 * SPEC-208 (B-12) — `req.params[x]` tipa `string | string[] | undefined`
 * porque Express 5 + path-to-regexp v8 admite parámetros repetidos
 * (`:id+`). Ninguna ruta de esta API declara uno (`apps/api/CLAUDE.md`
 * §Trampas lo confirma), y `router.param(nombre, paramValidator(schema))`
 * ya rechazó cualquier otra cosa **antes** de que el handler corra — el
 * mismo hecho que `middlewares/auth.ts` ya usa para su propio `leerParam`.
 *
 * Esto no es un cast a ciegas para callar `noUncheckedIndexedAccess`: es
 * esa misma garantía, puesta en un solo lugar en vez de asumida en
 * silencio en cada handler. Si algún día una ruta SÍ declarara un
 * parámetro repetido, esto explota con un 500 explícito en el momento en
 * que ese handler lo lee — igual que la capa de autorización ya hace.
 */
export function paramSeguro(valor: string | string[] | undefined): string {
  if (typeof valor !== "string") {
    throw new Error(
      `Route misconfiguration: expected a single path param, got ${JSON.stringify(valor)}`
    );
  }
  return valor;
}
