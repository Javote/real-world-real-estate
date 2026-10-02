import type { Client, Config } from "@libsql/client" with { "resolution-mode": "require" };

// ESM puro en un package CommonJS: `require()` en runtime (Node 24) tipado con `resolution-mode`.
const { createClient } = require("@libsql/client") as {
  createClient: (config: Config) => Client;
};

export type { Client, Config };
export { createClient };
