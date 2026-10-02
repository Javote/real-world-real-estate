import { passwordSchema } from "@plataforma/shared";
import { urlDeLaBase } from "./local-db.js";

export const esBaseLocal = (url: string) => /^file:/i.test(url.trim());

export function passwordDeDemo(
  variable: string,
  defaultLocal: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const delEntorno = env[variable]?.trim();

  if (!delEntorno) {
    if (!esBaseLocal(urlDeLaBase(env))) {
      throw new Error(
        `${variable} no está seteada y DATABASE_URL no apunta a una base local.\n` +
          "Las credenciales de este seed están publicadas en el repo: sembrarlas en una " +
          "instancia desplegada deja una cuenta de credenciales conocidas expuesta.\n" +
          `Seteá ${variable} (openssl rand -base64 24) o no corras el seed contra esta base.`
      );
    }
    return defaultLocal;
  }

  const parsed = passwordSchema.safeParse(delEntorno);
  if (!parsed.success) {
    throw new Error(
      `${variable} no cumple la política de passwords: ${parsed.error.issues[0]?.message}`
    );
  }
  return parsed.data;
}

export const paraMostrar = (
  variable: string,
  defaultLocal: string,
  env: NodeJS.ProcessEnv = process.env
) => (env[variable]?.trim() ? `(desde ${variable})` : defaultLocal);
