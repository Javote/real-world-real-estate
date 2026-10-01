import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  applyParamsToScript,
  mintingPolicyToId,
  type Network,
  type Script,
  validatorToAddress
} from "@lucid-evolution/lucid";

export interface Blueprint {
  validators: Array<{ title: string; compiledCode: string; hash: string }>;
}

export const SPEND_VALIDATOR_TITLE = "stage.stage.spend";

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
  adminKeyHash: string;
  address: string;
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
    adminKeyHash,
    address: validatorToAddress(network, script),
    policyId: mintingPolicyToId(script)
  };
}
