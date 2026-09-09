import { describe, expect, it } from "vitest";
import { notificationPrefsSchema, updateNotificationPrefsSchema } from "./profile";

// Bug real encontrado escribiendo el test de la Tanda 2 (documentación de la
// API): `.partial()` sobre un schema con `.default()` no deja pasar
// `undefined` para una clave ausente — sigue completando el default. Sin este
// schema separado (sin default), un PATCH parcial "completaba" con `true` las
// claves no tocadas, y `profile.routes.ts` mergeaba esos `true` sobre
// preferencias ya guardadas en `false`.
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
