import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Lo que en CommonJS era `require.main === module`. Node 22 no tiene `import.meta.main`.
export function esPuntoDeEntrada(url: string, argv: readonly string[] = process.argv): boolean {
  const script = argv[1];
  if (!script) return false;
  return realpathSync(fileURLToPath(url)) === realpathSync(script);
}
