// Acceso de solo lo necesario a la API de producción, para los scripts del
// video walkthrough. Las contraseñas salen del entorno (SEED_DEMO_PASSWORD,
// SEED_ADMIN_PASSWORD) o, si no están, de apps/api/.env — nunca se imprimen.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const API = process.env.PROPNEXUS_API ?? "https://propnexus-api.onrender.com";
export const WEB = process.env.PROPNEXUS_WEB ?? "https://propnexus-web.onrender.com";

function secreto(nombre) {
  if (process.env[nombre]) return process.env[nombre];
  const env = join(RAIZ, "apps", "api", ".env");
  if (existsSync(env)) {
    const m = readFileSync(env, "utf8").match(new RegExp(`^${nombre}=(.*)$`, "m"));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error(`Falta ${nombre}: exportala o dejala en apps/api/.env (la tiene el técnico).`);
}

export const USUARIOS = {
  investor: ["buyer@example.com", "SEED_DEMO_PASSWORD"],
  developer: ["developer@example.com", "SEED_DEMO_PASSWORD"],
  certifier: ["verifier@example.com", "SEED_DEMO_PASSWORD"],
  notary: ["notary@example.com", "SEED_DEMO_PASSWORD"],
  admin: ["admin@example.com", "SEED_ADMIN_PASSWORD"]
};

export async function pedir(ruta, { token, metodo = "GET", cuerpo, espera = 120_000 } = {}) {
  const r = await fetch(`${API}/api/v1${ruta}`, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(espera)
  });
  const datos = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${metodo} ${ruta} → ${r.status}`);
  return datos;
}

export async function entrar(rol) {
  const [email, variable] = USUARIOS[rol];
  const r = await pedir("/auth/login", {
    metodo: "POST",
    cuerpo: { email, password: secreto(variable) }
  });
  return r.token ?? r.accessToken;
}

/** Espera a que Render despierte: el primer pedido en frío tarda de 50 s a más de 90 s. */
export async function despertar() {
  const inicio = Date.now();
  for (let intento = 0; intento < 6; intento++) {
    try {
      const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(100_000) });
      if (r.ok) return Math.round((Date.now() - inicio) / 1000);
    } catch {}
  }
  throw new Error("La API no respondió en ~10 minutos. Mirá el dashboard de Render.");
}
