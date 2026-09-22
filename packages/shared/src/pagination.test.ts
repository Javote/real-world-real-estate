import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  auditLogEntrySchema,
  auditLogQuerySchema,
  auditLogRowSchema,
  cursorPaginationSchema,
  paginatedResponseSchema
} from "./pagination";

describe("cursorPaginationSchema", () => {
  it("limit tiene default 20 cuando no viene", () => {
    const result = cursorPaginationSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.limit).toBe(20);
  });

  it("coerciona un limit de query string y respeta el techo de 100", () => {
    expect(cursorPaginationSchema.safeParse({ limit: "50" }).success).toBe(true);
    expect(cursorPaginationSchema.safeParse({ limit: "101" }).success).toBe(false);
    expect(cursorPaginationSchema.safeParse({ limit: "0" }).success).toBe(false);
  });
});

describe("auditLogQuerySchema", () => {
  it("extiende la paginación con category, opcional", () => {
    expect(auditLogQuerySchema.safeParse({ category: "stage" }).success).toBe(true);
    expect(auditLogQuerySchema.safeParse({}).success).toBe(true);
  });
});

describe("paginatedResponseSchema", () => {
  it("arma {items, nextCursor} para cualquier schema de item", () => {
    const schema = paginatedResponseSchema(z.object({ id: z.string() }));
    expect(schema.safeParse({ items: [{ id: "a" }], nextCursor: null }).success).toBe(true);
    expect(
      schema.safeParse({ items: [{ id: "a" }], nextCursor: "2026-09-22T00:00:00.000Z" }).success
    ).toBe(true);
  });

  it("rechaza un item que no matchea el schema pasado", () => {
    const schema = paginatedResponseSchema(z.object({ id: z.string() }));
    expect(schema.safeParse({ items: [{ id: 1 }], nextCursor: null }).success).toBe(false);
  });
});

describe("auditLogEntrySchema", () => {
  it("actorName y actorRole son null para un evento del sistema", () => {
    expect(
      auditLogEntrySchema.safeParse({
        id: "e1",
        action: "CREATE_PROJECT",
        entityType: "Project",
        entityId: "p1",
        metadataJson: null,
        createdAt: new Date().toISOString(),
        actorName: null,
        actorRole: null
      }).success
    ).toBe(true);
  });

  it("rechaza un actorRole fuera de los cinco roles globales", () => {
    expect(
      auditLogEntrySchema.safeParse({
        id: "e1",
        action: "CREATE_PROJECT",
        entityType: "Project",
        entityId: "p1",
        metadataJson: null,
        createdAt: new Date().toISOString(),
        actorName: "Ana",
        actorRole: "superadmin"
      }).success
    ).toBe(false);
  });
});

describe("auditLogRowSchema", () => {
  it("no lleva actorName/actorRole proyectados — sin join con User", () => {
    const fila = {
      id: "e1",
      actorUserId: "u1",
      action: "CREATE_PROJECT",
      entityType: "Project",
      entityId: "p1",
      metadataJson: null,
      createdAt: new Date().toISOString()
    };
    expect(auditLogRowSchema.safeParse(fila).success).toBe(true);
    expect(auditLogRowSchema.safeParse({ ...fila, actorName: "Ana" }).success).toBe(false);
  });
});
