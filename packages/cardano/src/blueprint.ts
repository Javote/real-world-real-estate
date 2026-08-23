import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  applyParamsToScript,
  mintingPolicyToId,
  type Network,
  type Script,
  validatorToAddress
} from "@lucid-evolution/lucid";

// El blueprint (`contracts/plutus.json`) es la única fuente del script.
//
// **La dirección se deriva, nunca se hardcodea** (regla 11). Y no es un detalle
// de estilo: el validador está parametrizado por el `admin`, así que la
// dirección depende de la wallet de servicio. Escribirla a mano en una variable
// de entorno significaría que el día que cambie la wallet, la app le hablaría a
// una dirección donde no hay ningún hilo — sin error, solo silencio.
//
// **Corolario que hay que saber antes de generar la seed:** rotar la wallet
// cambia la dirección del script, o sea que **no se puede rotar sin migrar
// todos los hilos** (SPEC-013 §Preguntas abiertas 4).

export interface Blueprint {
  validators: Array<{ title: string; compiledCode: string; hash: string }>;
}

/** Título del validador en el blueprint. Sale de `validators/stage.ak`. */
export const SPEND_VALIDATOR_TITLE = "stage.stage.spend";

/**
 * Busca `contracts/plutus.json` hacia arriba desde este archivo.
 *
 * Se busca en vez de fijarse porque el mismo código corre desde `src/` con
 * `tsx` y desde `dist/` compilado, y una constante relativa no puede servir a
 * los dos — es la misma trampa que ya mordió en `db/migrate.ts` (D-055).
 */
export function findBlueprintPath(from: string = __dirname): string {
  let dir = from;
  for (let i = 0; i < 8; i += 1) {
    const candidato = path.join(dir, "contracts", "plutus.json");
    if (existsSync(candidato)) return candidato;
    const padre = path.dirname(dir);
    if (padre === dir) break;
    dir = padre;
  }
  throw new Error(
    `No encuentro contracts/plutus.json buscando hacia arriba desde ${from}. ` +
      "Es el blueprint que genera 'aiken build' y tiene que estar commiteado."
  );
}

export function loadBlueprint(blueprintPath?: string): Blueprint {
  return JSON.parse(readFileSync(blueprintPath ?? findBlueprintPath(), "utf8")) as Blueprint;
}

/**
 * El script con el `admin` ya aplicado. Los tres handlers del blueprint
 * (`spend`, `mint`, `else`) son **el mismo script**: comparten `compiledCode` y
 * hash, así que alcanza con tomar uno.
 */
export function stageScript(adminKeyHash: string, blueprint: Blueprint): Script {
  const validator = blueprint.validators.find((v) => v.title === SPEND_VALIDATOR_TITLE);
  if (!validator) {
    throw new Error(`El blueprint no trae el validador "${SPEND_VALIDATOR_TITLE}"`);
  }

  return {
    type: "PlutusV3",
    script: applyParamsToScript(validator.compiledCode, [adminKeyHash])
  };
}

export interface StageScriptRefs {
  script: Script;
  /** Dirección del script: donde viven TODOS los hilos. */
  address: string;
  /** Policy del thread token. Es el mismo hash del script. */
  policyId: string;
}

export function stageScriptRefs(
  adminKeyHash: string,
  network: Network,
  blueprint: Blueprint
): StageScriptRefs {
  const script = stageScript(adminKeyHash, blueprint);
  return {
    script,
    address: validatorToAddress(network, script),
    policyId: mintingPolicyToId(script)
  };
}
