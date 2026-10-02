import { describe, expect, it } from "vitest";
import { outputRefSchema, sha256HexSchema, txidSchema } from "./hashes";

const HEX64 = "0123456789abcdef".repeat(4);

describe("sha256HexSchema", () => {
  it("acepta un SHA-256 en hex minúscula", () => {
    expect(sha256HexSchema.safeParse(HEX64).success).toBe(true);
  });

  it("rechaza el vacío: '' no es un hash", () => {
    expect(sha256HexSchema.safeParse("").success).toBe(false);
  });

  it("rechaza mayúscula: el árbol de Merkle asume minúscula", () => {
    expect(sha256HexSchema.safeParse(HEX64.toUpperCase()).success).toBe(false);
  });

  it("rechaza 63 y 65 caracteres, y lo que no es hex", () => {
    expect(sha256HexSchema.safeParse(HEX64.slice(1)).success).toBe(false);
    expect(sha256HexSchema.safeParse(`${HEX64}0`).success).toBe(false);
    expect(sha256HexSchema.safeParse("pendiente").success).toBe(false);
    expect(sha256HexSchema.safeParse("g".repeat(64)).success).toBe(false);
  });
});

describe("txidSchema", () => {
  it("acepta mayúscula y la devuelve idéntica: un TXID no se normaliza", () => {
    const mixto = `${HEX64.slice(0, 32).toUpperCase()}${HEX64.slice(32)}`;
    const result = txidSchema.safeParse(mixto);
    expect(result.success && result.data).toBe(mixto);
  });

  it("rechaza el vacío, otro largo y lo que no es hex", () => {
    expect(txidSchema.safeParse("").success).toBe(false);
    expect(txidSchema.safeParse(HEX64.slice(1)).success).toBe(false);
    expect(txidSchema.safeParse("pendiente").success).toBe(false);
  });

  it("acepta null donde el campo lo declara", () => {
    expect(txidSchema.nullable().safeParse(null).success).toBe(true);
  });
});

describe("outputRefSchema", () => {
  it("acepta <txid>#<índice> y lo devuelve idéntico", () => {
    const ref = `${HEX64.toUpperCase()}#12`;
    const result = outputRefSchema.safeParse(ref);
    expect(result.success && result.data).toBe(ref);
  });

  it("rechaza un txid que no es hex64", () => {
    expect(outputRefSchema.safeParse("abc#0").success).toBe(false);
  });

  it("rechaza un índice no numérico, ausente o sin el #", () => {
    expect(outputRefSchema.safeParse(`${HEX64}#x`).success).toBe(false);
    expect(outputRefSchema.safeParse(`${HEX64}#`).success).toBe(false);
    expect(outputRefSchema.safeParse(HEX64).success).toBe(false);
  });
});
