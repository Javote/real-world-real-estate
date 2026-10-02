import { describe, expect, it } from "vitest";
import { USER_ROLES } from "../src/db/types";
import { db } from "../src/lib/db";
import { ELENCO_TEST } from "./global-setup";

describe("el elenco de fixtures cubre todos los roles", () => {
  it("cada rol de USER_ROLES tiene un representante ACTIVO", () => {
    const activosPorRol = new Set(
      ELENCO_TEST.filter((p) => p.isActive !== false).map((p) => p.role)
    );

    const sinRepresentante = USER_ROLES.filter((rol) => !activosPorRol.has(rol));

    expect(sinRepresentante).toEqual([]);
  });

  it("y ese representante existe de verdad en la base sembrada", async () => {
    const usuarios = await db
      .selectFrom("User")
      .select(["role", "isActive"])
      .where("isActive", "=", true)
      .execute();

    const rolesEnLaBase = new Set(usuarios.map((u) => u.role));

    for (const rol of USER_ROLES) {
      expect(rolesEnLaBase.has(rol)).toBe(true);
    }
  });

  it("el elenco no repite emails", () => {
    const emails = ELENCO_TEST.map((p) => p.email);
    expect(new Set(emails).size).toBe(emails.length);
  });
});
