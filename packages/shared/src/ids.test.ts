import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as ids from "./ids";
import { projectIdSchema } from "./ids";

// Lo que la marca impide (un `UnitId` donde va un `StageId`) es de tipos: lo verifica `tsc` en
// `apps/api/test/cimientos-tipos.test.ts`, porque este paquete no typechequea sus tests.
const schemas = Object.entries(ids).filter(([, v]) => v instanceof z.ZodType);

describe("IDs con marca — la marca es solo de tipo", () => {
  it.each(schemas)("%s publica el mismo JSON Schema que un string", (_nombre, schema) => {
    expect(z.toJSONSchema(schema as z.ZodType)).toEqual(z.toJSONSchema(z.string()));
  });

  it("hay un schema por entidad", () => {
    expect(schemas).toHaveLength(13);
  });

  it("parsea el mismo string, sin tocarlo", () => {
    expect(projectIdSchema.parse("clh3k9x0000008l3fabc1234")).toBe("clh3k9x0000008l3fabc1234");
  });
});
