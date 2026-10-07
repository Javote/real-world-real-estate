import { describe, expect, it } from "vitest";
import { err, ok } from "./result";

describe("Result", () => {
  it("ok lleva el valor", () => {
    expect(ok(3)).toEqual({ ok: true, value: 3 });
  });

  it("err lleva el código y, si hay, el detalle", () => {
    expect(err("STAGE_NOT_FOUND")).toEqual({
      ok: false,
      code: "STAGE_NOT_FOUND",
      details: undefined
    });
    expect(err("STAGE_TRANSITION_INVALID", { from: "Pending", to: "Completed" })).toEqual({
      ok: false,
      code: "STAGE_TRANSITION_INVALID",
      details: { from: "Pending", to: "Completed" }
    });
  });
});
