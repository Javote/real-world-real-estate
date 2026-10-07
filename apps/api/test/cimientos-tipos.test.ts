import {
  type Err,
  err,
  type Result,
  type Serialized,
  type StageId,
  stageIdSchema,
  type UnitId,
  unitIdSchema
} from "@plataforma/shared";
import { describe, expectTypeOf, it } from "vitest";

// Las garantías de tipos de A1 (SPEC-613). Viven acá porque `packages/shared` no typechequea sus
// tests y `apps/api` sí (`tsconfig.typecheck.json`): si una deja de valer, `pnpm typecheck` falla.
describe("cimientos de A1 — lo que verifica tsc", () => {
  it("un id con marca no pasa por el de otra entidad, y sigue siendo un string", () => {
    const unidad = unitIdSchema.parse("u1");
    expectTypeOf(unidad).not.toMatchTypeOf<StageId>();
    expectTypeOf(stageIdSchema.parse("s1")).toEqualTypeOf<StageId>();
    expectTypeOf<UnitId>().toMatchTypeOf<string>();
    // @ts-expect-error — un string suelto no es un UnitId: se parsea con su schema
    const suelto: UnitId = "u1";
    void suelto;
  });

  it("Serialized deja un id con marca como está", () => {
    expectTypeOf<Serialized<{ unitId: UnitId }>>().toEqualTypeOf<{ unitId: UnitId }>();
  });

  it("err solo acepta un ErrorCode del inventario", () => {
    // @ts-expect-error — no está en ERROR_CODES
    err("NO_EXISTE");
    const r: Result<number, "STAGE_NOT_FOUND"> = err("STAGE_NOT_FOUND");
    expectTypeOf(r).toMatchTypeOf<Result<number, "STAGE_NOT_FOUND">>();
    expectTypeOf(err("STAGE_NOT_FOUND")).toEqualTypeOf<Err<"STAGE_NOT_FOUND">>();
  });
});
