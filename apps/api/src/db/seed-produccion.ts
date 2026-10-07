import "dotenv/config";
import { db } from "../lib/db.js";
import { esPuntoDeEntrada } from "../lib/punto-de-entrada.js";
import { passwordDeProduccion } from "./credentials.js";
import { ELENCO_DEMO, sembrarMundoDemo } from "./demo.js";

// La demo desplegada. Sin passwords por defecto: exige `SEED_ADMIN_PASSWORD` y
// `SEED_DEMO_PASSWORD`, y nunca las imprime. Se corre a mano contra Turso (RUNBOOK §1.3).
export async function sembrarDemoProduccion(env: NodeJS.ProcessEnv = process.env) {
  const personajes = ELENCO_DEMO.map((p) => ({
    email: p.email,
    fullName: p.fullName,
    role: p.role,
    password: passwordDeProduccion(p.variable, env)
  }));

  await sembrarMundoDemo(personajes);

  console.log("Seed de producción completado");
  for (const p of ELENCO_DEMO) console.log(`${p.role}: ${p.email} / (desde ${p.variable})`);
  console.log("Project slug: torre-a");
}

/* v8 ignore if -- @preserve: guardia para que importar el módulo no siembre; solo corre como CLI */
if (esPuntoDeEntrada(import.meta.url)) {
  sembrarDemoProduccion()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => {
      db.destroy();
    });
}
