import jwt from "jsonwebtoken";

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

const JWT_ALGORITHM = "HS256" as const;

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, JWT_SECRET, { algorithm: JWT_ALGORITHM, expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] }) as JwtPayload;
}
