import type { createId as CreateId } from "@paralleldrive/cuid2" with {
  "resolution-mode": "require"
};

// ESM puro en un package CommonJS: `require()` en runtime (Node 24) tipado con `resolution-mode`.
const { createId } = require("@paralleldrive/cuid2") as { createId: typeof CreateId };

export { createId };
