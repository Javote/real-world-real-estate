import { describe, expect, it } from "vitest";
import { cuidParamSchema, hex64ParamSchema, positiveIntParamSchema } from "./params";

describe("cuidParamSchema", () => {
  it("acepta la forma real de createId(): 24 chars, empieza con letra", () => {
    expect(cuidParamSchema.safeParse("clh3k9x0000008l3fabc1234").success).toBe(true);
  });

  it("rechaza un id que empieza con dígito, uno corto, y uno con mayúsculas", () => {
    expect(cuidParamSchema.safeParse("1lh3k9x0000008l3fabc1234").success).toBe(false);
    expect(cuidParamSchema.safeParse("clh3k9x").success).toBe(false);
    expect(cuidParamSchema.safeParse("CLH3K9X0000008L3FABC1234").success).toBe(false);
  });
});

describe("hex64ParamSchema", () => {
  it("acepta un hex de 64 caracteres en minúsculas", () => {
    expect(hex64ParamSchema.safeParse("a".repeat(64)).success).toBe(true);
  });

  it("rechaza mayúsculas, largo distinto, y caracteres fuera de a-f0-9", () => {
    expect(hex64ParamSchema.safeParse("A".repeat(64)).success).toBe(false);
    expect(hex64ParamSchema.safeParse("a".repeat(63)).success).toBe(false);
    expect(hex64ParamSchema.safeParse("z".repeat(64)).success).toBe(false);
  });
});

describe("positiveIntParamSchema", () => {
  it("coerciona un string de dígitos a entero positivo", () => {
    const result = positiveIntParamSchema.safeParse("3");
    expect(result.success).toBe(true);
    expect(result.data).toBe(3);
  });

  it("rechaza '1.5' en vez de truncarlo en silencio", () => {
    expect(positiveIntParamSchema.safeParse("1.5").success).toBe(false);
  });

  it("rechaza cero y negativos", () => {
    expect(positiveIntParamSchema.safeParse("0").success).toBe(false);
    expect(positiveIntParamSchema.safeParse("-1").success).toBe(false);
  });
});
