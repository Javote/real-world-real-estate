import { z } from "zod";

export const LOCAL_DB_DIR = ".data";
export const DEFAULT_DATABASE_URL = `file:./${LOCAL_DB_DIR}/dev.db`;

const texto = z.string().optional();

// `""` cuenta como ausente solo donde el código siempre lo trató así (`||` o un `if`); con `??`, no.
const noVacio = texto.transform((v) => v || undefined);
const recortado = texto.transform((v) => v?.trim() || undefined);
const conDefault = (porDefecto: string) => texto.transform((v) => v ?? porDefecto);

// `parseInt`, no `Number`: `"3abc"` es 3, como fue siempre. Lo que no da un entero válido cae al default.
const entero = (minimo: number, porDefecto: number) =>
  texto.transform((v) => {
    const n = Number.parseInt(v ?? "", 10);
    return Number.isInteger(n) && n >= minimo ? n : porDefecto;
  });

// Cualquier cosa que no sea `"true"` es `false`, también `""`; solo la ausencia toma el default.
const booleano = (porDefecto: "true" | "false") =>
  texto.transform((v) => (v ?? porDefecto) === "true");

/**
 * Todas las variables que lee la API, cada una con el parseo que tenía en su archivo. Ninguna tira:
 * un valor inválido cae al mismo default que antes. Lo que sí frena el arranque (`JWT_SECRET`, un
 * `STORAGE_DRIVER` desconocido) lo sigue decidiendo quien la usa.
 */
export const esquemaDelEntorno = z.object({
  NODE_ENV: conDefault("development"),
  PORT: texto.transform((v) => Number(v || 8787)),
  WEB_ORIGIN: conDefault("http://localhost:3000").transform((v) =>
    v
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean)
  ),
  JWT_SECRET: recortado,
  TRUST_PROXY_HOPS: entero(0, 0),
  LOGIN_RATE_LIMIT_MAX: entero(1, 20),
  DOSSIER_RATE_LIMIT_MAX: entero(1, 60),

  DATABASE_URL: conDefault(DEFAULT_DATABASE_URL),
  DATABASE_AUTH_TOKEN: noVacio,

  UPLOAD_DIR: noVacio,
  STORAGE_DRIVER: conDefault("disk"),
  S3_ENDPOINT: texto,
  S3_REGION: conDefault("us-east-1"),
  S3_BUCKET: noVacio,
  S3_ACCESS_KEY_ID: noVacio,
  S3_SECRET_ACCESS_KEY: noVacio,
  S3_FORCE_PATH_STYLE: booleano("true"),
  S3_CREATE_BUCKET: booleano("false"),

  ANCHOR_MODE: conDefault("simulated"),
  CARDANO_NETWORK: texto,
  BLOCKFROST_API_KEY: texto,
  BLOCKFROST_URL: texto,
  SERVICE_WALLET_PRIVATE_KEY: texto,

  SENTRY_DSN: noVacio,
  OTEL_EXPORTER_OTLP_ENDPOINT: noVacio,

  SEED_ADMIN_PASSWORD: recortado,
  SEED_DEMO_PASSWORD: recortado
});

export type Entorno = z.infer<typeof esquemaDelEntorno>;
export type VariableDelEntorno = keyof Entorno;

export const VARIABLES_DEL_ENTORNO = Object.keys(
  esquemaDelEntorno.shape
) as readonly VariableDelEntorno[];

/** Se llama en el mismo momento en que antes se leía `process.env`: al importar o por llamada. */
export function entorno(env: NodeJS.ProcessEnv = process.env): Entorno {
  return esquemaDelEntorno.parse(env);
}

const BIEN_FORMADA: Partial<Record<VariableDelEntorno, RegExp>> = {
  PORT: /^\d+$/,
  TRUST_PROXY_HOPS: /^\d+$/,
  LOGIN_RATE_LIMIT_MAX: /^[1-9]\d*$/,
  DOSSIER_RATE_LIMIT_MAX: /^[1-9]\d*$/,
  S3_FORCE_PATH_STYLE: /^(true|false)$/,
  S3_CREATE_BUCKET: /^(true|false)$/
};

/** Las variables seteadas que no tienen la forma esperada, con el valor que se usa en su lugar. */
export function avisosDelEntorno(env: NodeJS.ProcessEnv = process.env): string[] {
  const valores = entorno(env);
  return Object.entries(BIEN_FORMADA).flatMap(([clave, forma]) => {
    const crudo = env[clave];
    if (!crudo || forma.test(crudo)) return [];
    const usado = valores[clave as VariableDelEntorno];
    return [`${clave} no tiene la forma esperada (${forma.source}); se usa ${String(usado)}`];
  });
}
