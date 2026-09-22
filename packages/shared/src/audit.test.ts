import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  auditActionSchema,
  auditEntityTypeSchema
} from "./audit";

describe("auditActionSchema", () => {
  it("acepta las 29 acciones declaradas, ninguna más", () => {
    for (const action of AUDIT_ACTIONS) {
      expect(auditActionSchema.safeParse(action).success).toBe(true);
    }
    expect(auditActionSchema.safeParse("DELETE_EVERYTHING").success).toBe(false);
  });
});

describe("auditEntityTypeSchema", () => {
  it("acepta las 10 entidades declaradas, incluida User", () => {
    for (const entityType of AUDIT_ENTITY_TYPES) {
      expect(auditEntityTypeSchema.safeParse(entityType).success).toBe(true);
    }
  });

  it("rechaza una entidad que no está en el mapeo de writeAuditLog", () => {
    expect(auditEntityTypeSchema.safeParse("Organization").success).toBe(false);
  });
});
