import { describe, expect, it } from "vitest";
import { ERROR_CODES, esErrorCode } from "./errors";

describe("ERROR_CODES", () => {
  it.each(Object.entries(ERROR_CODES))(
    "%s tiene un status de error HTTP",
    (_codigo, { status }) => {
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(600);
    }
  );

  it("esErrorCode reconoce los del inventario y nada más", () => {
    expect(esErrorCode("STAGE_NOT_FOUND")).toBe(true);
    expect(esErrorCode("NO_EXISTE")).toBe(false);
    expect(esErrorCode("toString")).toBe(false);
    expect(esErrorCode(404)).toBe(false);
  });
});
