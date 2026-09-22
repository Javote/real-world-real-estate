import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_CATEGORIES,
  notificationQuerySchema,
  notificationSchema,
  unreadCountSchema
} from "./notifications";

const base = {
  id: "n1",
  category: "stage" as const,
  titleKey: "notifications.stage.advanced",
  params: { stageName: "Cimentación" },
  unitId: "u1",
  readAt: null,
  createdAt: new Date().toISOString()
};

describe("notificationSchema", () => {
  it("acepta las cinco categorías, las mismas del audit log", () => {
    for (const category of NOTIFICATION_CATEGORIES) {
      expect(notificationSchema.safeParse({ ...base, category }).success).toBe(true);
    }
  });

  it("rechaza una categoría que no sea una de las cinco", () => {
    expect(notificationSchema.safeParse({ ...base, category: "billing" }).success).toBe(false);
  });

  it("titleKey es una clave, no copy: cualquier string pasa (el backend nunca manda la frase)", () => {
    expect(notificationSchema.safeParse({ ...base, titleKey: "x.y.z" }).success).toBe(true);
  });

  it("params solo acepta strings y numbers — sin PII estructurado", () => {
    expect(notificationSchema.safeParse({ ...base, params: { a: "b", n: 1 } }).success).toBe(true);
    expect(notificationSchema.safeParse({ ...base, params: { a: { nested: true } } }).success).toBe(
      false
    );
  });

  it("readAt null significa no leída, y acepta una fecha cuando sí", () => {
    expect(notificationSchema.safeParse({ ...base, readAt: null }).success).toBe(true);
    expect(
      notificationSchema.safeParse({ ...base, readAt: new Date().toISOString() }).success
    ).toBe(true);
  });
});

describe("unreadCountSchema", () => {
  it("acepta un entero no negativo y rechaza uno negativo", () => {
    expect(unreadCountSchema.safeParse({ unread: 0 }).success).toBe(true);
    expect(unreadCountSchema.safeParse({ unread: -1 }).success).toBe(false);
  });
});

describe("notificationQuerySchema", () => {
  it("los dos filtros son opcionales", () => {
    expect(notificationQuerySchema.safeParse({}).success).toBe(true);
    expect(notificationQuerySchema.safeParse({ unitId: "u1", category: "document" }).success).toBe(
      true
    );
  });

  it("rechaza una categoría fuera del dominio y un unitId vacío", () => {
    expect(notificationQuerySchema.safeParse({ category: "otra" }).success).toBe(false);
    expect(notificationQuerySchema.safeParse({ unitId: "" }).success).toBe(false);
  });
});
