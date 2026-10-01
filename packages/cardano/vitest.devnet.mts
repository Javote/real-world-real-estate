import { execFileSync } from "node:child_process";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "../..");
const COMPOSE = path.join(RAIZ, "compose.dev.yml");
const STORE = process.env.YACI_STORE_URL ?? "http://localhost:8080/api/v1";

const ARRANQUE_MAX_MS = 8 * 60 * 1000;

function docker(...args: string[]): string {
  return execFileSync("docker", args, { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
}

function estaCorriendo(): boolean {
  try {
    return docker("compose", "-f", COMPOSE, "ps", "-q", "yaci").trim().length > 0;
  } catch {
    return false;
  }
}

async function esperarListo(): Promise<void> {
  const limite = Date.now() + ARRANQUE_MAX_MS;

  while (Date.now() < limite) {
    try {
      if ((await fetch(`${STORE}/blocks/latest`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error(
    `El devnet no quedó listo en ${ARRANQUE_MAX_MS / 60000} minutos. ` +
      `Mirá 'docker compose -f compose.dev.yml logs yaci': la señal buena es ` +
      `"[OK] Yaci Store Started". El 'Java command not found' que aparece antes es ruido.`
  );
}

export async function setup(): Promise<void> {
  if (process.env.YACI_TEST !== "1") return;

  if (estaCorriendo()) {
    await esperarListo();
    return;
  }

  try {
    docker("compose", "-f", COMPOSE, "up", "-d", "yaci");
  } catch (error) {
    throw new Error(
      `No se pudo levantar el devnet. ¿Está corriendo el daemon de Docker?\n${String(error)}`
    );
  }

  process.env.YACI_LEVANTADO_POR_LA_SUITE = "1";
  await esperarListo();
}

export async function teardown(): Promise<void> {
  if (process.env.YACI_LEVANTADO_POR_LA_SUITE !== "1") return;

  try {
    docker("compose", "-f", COMPOSE, "stop", "yaci");
  } catch {
    console.error("[devnet] no se pudo detener yaci; queda corriendo.");
  }
}
