import type { OpenAPIGenerator as OpenAPIGeneratorType } from "@orpc/openapi" with { "resolution-mode": "require" };
import type { OpenAPIHandler as OpenAPIHandlerType } from "@orpc/openapi/node" with {
  "resolution-mode": "require"
};
import type { createORPCClient as createORPCClientType } from "@orpc/client" with {
  "resolution-mode": "require"
};
import type { OpenAPILink as OpenAPILinkType } from "@orpc/openapi-client/fetch" with {
  "resolution-mode": "require"
};
import type { os as osType } from "@orpc/server" with { "resolution-mode": "require" };
export type { RouterClient } from "@orpc/server" with { "resolution-mode": "require" };
import type { ZodToJsonSchemaConverter as ZodToJsonSchemaConverterType } from "@orpc/zod/zod4" with {
  "resolution-mode": "require"
};

const { OpenAPIGenerator } = require("@orpc/openapi") as { OpenAPIGenerator: typeof OpenAPIGeneratorType };
const { OpenAPIHandler } = require("@orpc/openapi/node") as { OpenAPIHandler: typeof OpenAPIHandlerType };
const { os } = require("@orpc/server") as { os: typeof osType };
const { ZodToJsonSchemaConverter } = require("@orpc/zod/zod4") as {
  ZodToJsonSchemaConverter: typeof ZodToJsonSchemaConverterType;
};
const { createORPCClient } = require("@orpc/client") as { createORPCClient: typeof createORPCClientType };
const { OpenAPILink } = require("@orpc/openapi-client/fetch") as { OpenAPILink: typeof OpenAPILinkType };

export { OpenAPIGenerator, OpenAPIHandler, os, ZodToJsonSchemaConverter, createORPCClient, OpenAPILink };
