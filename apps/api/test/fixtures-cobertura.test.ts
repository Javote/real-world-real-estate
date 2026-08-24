import { describe, expect, it } from "vitest";
import { USER_ROLES } from "../src/db/types";
import { db } from "../src/lib/db";
import { ELENCO_TEST } from "./global-setup";

// La regla que faltaba (SPEC-015 §2).
//
// **Este es el test que habría atrapado el bug de hoy.** El elenco de la suite
// no tenía ningún usuario activo que no fuera developer o admin, así que un
// `router.use(requireRole("admin","developer"))` montado sobre `/api/v1` pelado
// —que contestaba 403 a TODA la superficie del investor, del notario y del
// certificador— pasó desapercibido: no había con qué pedir esas superficies.
//
// No prueba una ruta. Prueba que el mundo de prueba **pueda** ejercitar todos
// los roles. Un rol sin representante activo es una superficie entera que nadie
// puede pedir, y eso no se ve como un test rojo: se ve como un test que no
// existe.

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
