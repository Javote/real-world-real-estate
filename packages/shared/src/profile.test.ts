import { describe, expect, it } from "vitest";
import { notificationPrefsSchema, updateNotificationPrefsSchema } from "./profile";

describe("updateNotificationPrefsSchema", () => {
  it("una clave ausente queda ausente del resultado, no en default true", () => {
    const parsed = updateNotificationPrefsSchema.parse({ stage: false });
    expect(parsed).toEqual({ stage: false });
    expect(parsed).not.toHaveProperty("document");
  });

  it("body vacío parsea a objeto vacío", () => {
    expect(updateNotificationPrefsSchema.parse({})).toEqual({});
  });
});

describe("notificationPrefsSchema", () => {
  it("completa las cinco claves con default true cuando faltan", () => {
    expect(notificationPrefsSchema.parse({ stage: false })).toEqual({
      stage: false,
      document: true,
      release: true,
      signature: true,
      certificate: true
    });
  });
});
