import { passwordSchema } from "@plataforma/shared";
import { entorno } from "../platform/config.js";
import { urlDeLaBase } from "./local-db.js";

export const esBaseLocal = (url: string) => /^file:/i.test(url.trim());

// Las passwords del seed local están publicadas en el repo: sembradas en una base desplegada,
// dejan cuentas de credenciales conocidas (D-047).
export function exigirBaseLocal(env: NodeJS.ProcessEnv = process.env): void {
  if (esBaseLocal(urlDeLaBase(env))) return;
  throw new Error(
    "`db:seed` es el seed local y DATABASE_URL no apunta a un SQLite en disco.\n" +
      "Sus passwords están publicadas en el repo. Para la demo desplegada, " +
      "`db:seed:produccion` (RUNBOOK §1.3)."
  );
}

export function passwordDeProduccion(
  variable: "SEED_ADMIN_PASSWORD" | "SEED_DEMO_PASSWORD",
  env: NodeJS.ProcessEnv = process.env
): string {
  const delEntorno = entorno(env)[variable];
  if (!delEntorno) {
    throw new Error(
      `${variable} no está seteada: el seed de producción no tiene passwords por defecto.\n` +
        "Generala con `openssl rand -base64 24` y guardala antes de sembrar (RUNBOOK §1.3)."
    );
  }

  const parsed = passwordSchema.safeParse(delEntorno);
  if (!parsed.success) {
    throw new Error(
      `${variable} no cumple la política de passwords: ${parsed.error.issues[0]?.message}`
    );
  }
  return parsed.data;
}
