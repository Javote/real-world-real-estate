import { writeFileSync } from "node:fs";
import path from "node:path";
import { contratoMinificado } from "../src/contract/minificado";

writeFileSync(
  path.join(__dirname, "..", "src", "contract", "contract.min.json"),
  contratoMinificado()
);
