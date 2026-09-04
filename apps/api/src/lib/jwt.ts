import jwt from "jsonwebtoken";

/**
 * Lee la clave de firma del entorno, o revienta.
 *
 * No hay fallback y no puede haberlo: un default literal en el repo firma tokens
 * que cualquiera puede reproducir, y `{userId, role:"admin"}` firmado con él no
 * escala privilegios — saltea la autenticación entera. El fallback anterior
 * (`|| "dev-secret"`) además se activaba con `JWT_SECRET=""`, que es lo que trae
 * `.env.example`: el modo inseguro era el que se obtenía por omisión.
 *
 * Revienta al importar, no al primer login: en el free tier de Render no hay
 * shell para ir a ver qué variables quedaron cargadas (D-040), así que el fallo
 * tiene que ser el arranque del proceso y no una request de producción.
 *
 * Se recorta el valor porque los dashboards de plataforma pegan saltos de línea
 * invisibles al final; un secreto con `\n` de más firma tokens distintos según
 * cómo se haya cargado.
 */
export function requireJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "JWT_SECRET falta o está vacío: la API no arranca sin clave de firma propia. " +
        "Generá una con `openssl rand -hex 32` y cargala en el entorno " +
        "(apps/api/.env en desarrollo, variables de la plataforma en prod)."
    );
  }

  return secret;
}

const JWT_SECRET = requireJwtSecret();

export type JwtPayload = {
  userId: string;
  role: string;
  email: string;
};

/**
 * El algoritmo se fija de los dos lados en vez de quedar librado al default.
 *
 * Hoy no hay agujero: con un secreto de tipo string, jsonwebtoken v9 ya acota
 * la verificación a la familia HS* por su cuenta, así que ni `alg: "none"` ni
 * la confusión HS/RS entran. Lo que se cierra es la dependencia de ese default:
 * el día que la clave deje de ser un string —un KMS, un par asimétrico— la
 * allowlist deja de deducirse sola y el token elige su propio algoritmo. Que la
 * garantía sea explícita cuesta una línea; que sea implícita cuesta una
 * auditoría de la librería cada vez que se toca la clave.
 */
const JWT_ALGORITHM = "HS256" as const;

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, JWT_SECRET, { algorithm: JWT_ALGORITHM, expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] }) as JwtPayload;
}
