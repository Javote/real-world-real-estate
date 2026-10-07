import "dotenv/config";
import { db } from "../lib/db.js";
import { esPuntoDeEntrada } from "../lib/punto-de-entrada.js";
import { exigirBaseLocal } from "./credentials.js";
import { ELENCO_DEMO, sembrarMundoDemo } from "./demo.js";

// El seed local (desarrollo, e2e y CI). Usa siempre las passwords del repo e ignora `SEED_*`
// aunque estén en el `.env`: las del entorno son de producción y van por `seed-produccion.ts`.
export async function sembrarDemo(env: NodeJS.ProcessEnv = process.env) {
  exigirBaseLocal(env);

  await sembrarMundoDemo(
    ELENCO_DEMO.map((p) => ({
      email: p.email,
      fullName: p.fullName,
      role: p.role,
      password: p.passwordLocal
    }))
  );

  console.log("Seed local completado");
  for (const p of ELENCO_DEMO) console.log(`${p.role}: ${p.email} / ${p.passwordLocal}`);
  console.log("Project slug: torre-a");
}

/* v8 ignore if -- @preserve: guardia para que importar el módulo no siembre; solo corre como CLI */
if (esPuntoDeEntrada(import.meta.url)) {
  sembrarDemo()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => {
      db.destroy();
    });
}
