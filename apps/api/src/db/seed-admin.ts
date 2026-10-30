import "dotenv/config";
import { createUserSchema } from "@plataforma/shared";
import { db } from "../lib/db.js";
import { correrSiEsPuntoDeEntrada } from "../lib/punto-de-entrada.js";
import { entorno } from "../platform/config.js";
import { passwordDeProduccion } from "./credentials.js";
import { sembrarUsuarios } from "./fixtures.js";

// Una base que arranca vacía (mainnet): solo el admin, sin la demo. El resto de las cuentas las
// crea el admin desde la app. Exige `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`, y nunca imprime la
// password (RUNBOOK-mainnet-cutover §1.8).
export async function sembrarSoloAdmin(env: NodeJS.ProcessEnv = process.env) {
  const email = createUserSchema.shape.email.safeParse(entorno(env).SEED_ADMIN_EMAIL);
  if (!email.success) {
    throw new Error(
      "SEED_ADMIN_EMAIL no está seteada o no es un email: el admin no tiene default."
    );
  }
  const password = passwordDeProduccion("SEED_ADMIN_PASSWORD", env);

  await sembrarUsuarios(db, [{ email: email.data, fullName: "Admin", role: "admin", password }]);

  console.log(`Admin sembrado: ${email.data} / (desde SEED_ADMIN_PASSWORD)`);
}

correrSiEsPuntoDeEntrada(import.meta.url, sembrarSoloAdmin, db.destroy.bind(db));
