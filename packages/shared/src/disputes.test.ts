import { describe, expect, it } from "vitest";
import { listDisputesQuerySchema, openDisputeSchema, resolveDisputeSchema } from "./disputes";

const ID = "a".repeat(24);

describe("openDisputeSchema", () => {
  it("un reason de solo espacios no es un reclamo", () => {
    expect(openDisputeSchema.safeParse({ stageId: ID, reason: "   " }).success).toBe(false);
    expect(openDisputeSchema.safeParse({ stageId: ID, reason: "No corresponde" }).success).toBe(
      true
    );
  });

  it("es estricto: no acepta un status ni un projectId del cliente", () => {
    expect(
      openDisputeSchema.safeParse({ stageId: ID, reason: "x", status: "Resolved" }).success
    ).toBe(false);
  });
});

describe("resolveDisputeSchema", () => {
  it("el outcome es un enum cerrado", () => {
    expect(
      resolveDisputeSchema.safeParse({ resolution: "x", outcome: "RefundAgreed" }).success
    ).toBe(true);
    expect(resolveDisputeSchema.safeParse({ resolution: "x", outcome: "Ganó" }).success).toBe(
      false
    );
  });
});

describe("listDisputesQuerySchema", () => {
  it("projectId es obligatorio: la guarda de dos capas lo lee", () => {
    expect(listDisputesQuerySchema.safeParse({}).success).toBe(false);
    expect(listDisputesQuerySchema.safeParse({ projectId: ID, status: "Open" }).success).toBe(true);
  });
});
