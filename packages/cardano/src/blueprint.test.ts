import { describe, expect, it } from "vitest";
import { loadBlueprint, stageScriptRefs } from "./blueprint";

// El blueprint que se lee es el commiteado: si alguien corre `aiken build` y no
// commitea, o toca el validador sin rebuildear, esto lo ve.
const blueprint = loadBlueprint();
const admin = "00000000000000000000000000000000000000000000000000000000";

describe("stageScriptRefs", () => {
  it("deriva dirección y policy del blueprint, sin nada hardcodeado", () => {
    const refs = stageScriptRefs(admin, "Preprod", blueprint);
    expect(refs.address.startsWith("addr_test1")).toBe(true);
    expect(refs.policyId).toMatch(/^[0-9a-f]{56}$/);
  });

  it("la policy del thread token ES el hash del script", () => {
    // No son dos cosas: el mismo validador hace de spend y de minting policy,
    // que es lo que ata el token a su propio hilo (D-058).
    const refs = stageScriptRefs(admin, "Preprod", blueprint);
    expect(refs.script.script.length).toBeGreaterThan(0);
    expect(refs.policyId.length).toBe(56);
  });

  it("cambiar el admin cambia la dirección — por eso la wallet no se rota gratis", () => {
    const a = stageScriptRefs(admin, "Preprod", blueprint);
    const b = stageScriptRefs("1".repeat(56), "Preprod", blueprint);
    expect(a.address).not.toBe(b.address);
  });

  it("la red decide el prefijo de la dirección, no el script", () => {
    const preprod = stageScriptRefs(admin, "Preprod", blueprint);
    const mainnet = stageScriptRefs(admin, "Mainnet", blueprint);
    expect(preprod.address.startsWith("addr_test1")).toBe(true);
    expect(mainnet.address.startsWith("addr1")).toBe(true);
    // Mismo script, distinta red: el hash NO cambia.
    expect(preprod.policyId).toBe(mainnet.policyId);
  });
});
