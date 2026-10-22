import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Lo que en CommonJS era `require.main === module`. Node 22 no tiene `import.meta.main`.
export function esPuntoDeEntrada(url: string, argv: readonly string[] = process.argv): boolean {
  const script = argv[1];
  if (!script) return false;
  return realpathSync(fileURLToPath(url)) === realpathSync(script);
}

/**
 * Corre la tarea solo si el módulo es el que lanzó `node` (importarlo no la corre). Si falla, lo
 * dice y sale con 1; al final, `alTerminar` cierra lo que haya que cerrar.
 */
export function correrSiEsPuntoDeEntrada(
  url: string,
  tarea: () => Promise<unknown>,
  alTerminar: () => unknown = () => undefined,
  argv: readonly string[] = process.argv
): void {
  if (!esPuntoDeEntrada(url, argv)) return;
  tarea()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(alTerminar);
}
