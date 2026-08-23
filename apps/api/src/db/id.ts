import type { createId as CreateId } from "@paralleldrive/cuid2" with {
  "resolution-mode": "require"
};

// Mismo patrón ESM-puro que `lib/libsql-client.ts` (ver Trampas de
// `apps/api/CLAUDE.md`): tipos vía `resolution-mode: "require"`, valor
// vía `require()` en runtime.
const { createId } = require("@paralleldrive/cuid2") as { createId: typeof CreateId };

export { createId };
