import { passwordSchema } from "@plataforma/shared";

/**
 * Una URL `file:` es un SQLite en disco de esta máquina. Cualquier otra cosa
 * —`libsql://` de Turso (D-038), `postgres://`— es una base que alguien más
 * puede alcanzar.
 */
export const esBaseLocal = (url: string) => /^file:/i.test(url.trim());

/**
 * De dónde sale la password de un usuario de demo.
 *
 * El seed publica sus credenciales: están en el `README.md`, en el skill
 * `run-app`, en los presets del login y en los e2e. Eso está bien en un SQLite
 * local y es un problema serio en la instancia pública que pide el criterio 12
 * del SOM — sería una cuenta admin de credenciales conocidas, en internet.
 *
 * La regla es la de D-042 aplicada acá: el valor ausente no resuelve a algo que
 * funciona. Contra una base local cae al default documentado, porque ahí no hay
 * nada que proteger y la fricción sería puro costo. Contra cualquier otra base
 * **revienta** si la variable no está. Ver D-047.
 */
export function passwordDeDemo(
  variable: string,
  defaultLocal: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const delEntorno = env[variable]?.trim();

  if (!delEntorno) {
    if (!esBaseLocal(env.DATABASE_URL ?? "")) {
      throw new Error(
        `${variable} no está seteada y DATABASE_URL no apunta a una base local.\n` +
          "Las credenciales de este seed están publicadas en el repo: sembrarlas en una " +
          "instancia desplegada deja una cuenta de credenciales conocidas expuesta.\n" +
          `Seteá ${variable} (openssl rand -base64 24) o no corras el seed contra esta base.`
      );
    }
    return defaultLocal;
  }

  // Lo que el seed escribe pasa por la MISMA política que los endpoints (D-046).
  // Sin esto, `SEED_ADMIN_PASSWORD=abc` crea un admin que la API jamás habría
  // aceptado crear — el seed sería el agujero de su propia política.
  const parsed = passwordSchema.safeParse(delEntorno);
  if (!parsed.success) {
    throw new Error(
      `${variable} no cumple la política de passwords: ${parsed.error.issues[0]?.message}`
    );
  }
  return parsed.data;
}

/**
 * Qué mostrar al terminar el seed.
 *
 * **Nunca** una password que vino del entorno: los logs de la plataforma se
 * guardan, y publicar en un log lo que se sacó del repo sería deshacer el
 * arreglo entero. Solo se imprimen los defaults locales, que ya son públicos.
 */
export const paraMostrar = (
  variable: string,
  defaultLocal: string,
  env: NodeJS.ProcessEnv = process.env
) => (env[variable]?.trim() ? `(desde ${variable})` : defaultLocal);
