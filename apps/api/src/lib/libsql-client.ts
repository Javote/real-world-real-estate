// `@libsql/client` se publica solo como ESM (con condición `require` en su
// package.json, pero el `.d.ts` que declara está marcado ESM por el `type` del
// paquete). Con `moduleResolution: node16` y este package siendo CJS
// (D-016/D-048: sin `"type": "module"`), un `import { createClient } from
// "@libsql/client"` normal falla el typecheck con TS1479 aunque en runtime
// funcione perfecto — es un desajuste de tipos, no de resolución real.
//
// La salida: import de SOLO TIPOS con `resolution-mode: "require"` (para que
// tsc resuelva contra la condición `require` del paquete) + un `require()` en
// runtime, que Node 24 sí sabe cargar de forma síncrona aunque el módulo sea
// ESM puro (`require(esm)`, estable desde Node ~22.12). Centralizado acá para
// no repetir el patrón en cada archivo que necesita un cliente libSQL.
import type { Client, Config } from "@libsql/client" with { "resolution-mode": "require" };

const { createClient } = require("@libsql/client") as {
  createClient: (config: Config) => Client;
};

export type { Client, Config };
export { createClient };
