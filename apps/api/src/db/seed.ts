import "dotenv/config";
import { db } from "../lib/db.js";
import { correrSiEsPuntoDeEntrada } from "../lib/punto-de-entrada.js";
import { exigirBaseLocal } from "./credentials.js";
import { ELENCO_DEMO, sembrarMundoDemo } from "./demo.js";
import { sembrarEncuestaPendiente } from "./fixtures.js";

// El token de la encuesta que responde el e2e (`apps/web/e2e/_credenciales.ts` lo repite).
export const TOKEN_ENCUESTA_DEL_SEED = "5eed".repeat(16);

// El seed local (desarrollo, e2e y CI). Usa siempre las passwords del repo e ignora `SEED_*`
// aunque estén en el `.env`: las del entorno son de producción y van por `seed-produccion.ts`.
export async function sembrarDemo(env: NodeJS.ProcessEnv = process.env) {
  exigirBaseLocal(env);

  const { buyerId, projectId } = await sembrarMundoDemo(
    ELENCO_DEMO.map((p) => ({
      email: p.email,
      fullName: p.fullName,
      role: p.role,
      password: p.passwordLocal
    }))
  );
  // Solo en el seed local: en producción sumaría una respuesta inventada al NPS del piloto.
  await sembrarEncuestaPendiente(db, {
    investorId: buyerId,
    projectId,
    token: TOKEN_ENCUESTA_DEL_SEED
  });

  console.log("Seed local completado");
  for (const p of ELENCO_DEMO) console.log(`${p.role}: ${p.email} / ${p.passwordLocal}`);
  console.log("Project slug: torre-a");
}

correrSiEsPuntoDeEntrada(import.meta.url, sembrarDemo, db.destroy.bind(db));
