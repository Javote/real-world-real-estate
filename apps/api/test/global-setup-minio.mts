import { execFileSync } from "node:child_process";
import path from "node:path";

// Levanta MinIO para `test:s3`, y lo baja al terminar. Mismo criterio que el
// devnet de `packages/cardano` (ver `vitest.devnet.mts`): el teardown de
// `globalSetup` corre aunque los tests fallen, y solo se apaga lo que se prendió.
//
// **Sin `S3_TEST=1` no hace absolutamente nada.** Este archivo se carga en TODA
// la suite de la API —son 25 archivos que no necesitan Docker—, así que el
// camino normal es entrar, ver la variable vacía y salir.

const RAIZ = path.resolve(import.meta.dirname, "../../..");
const COMPOSE = path.join(RAIZ, "compose.dev.yml");
const SALUD = `${process.env.S3_ENDPOINT ?? "http://localhost:9000"}/minio/health/live`;

/** MinIO arranca en segundos, no en minutos como yaci. */
const ARRANQUE_MAX_MS = 90 * 1000;

function docker(...args: string[]): string {
  return execFileSync("docker", args, { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
}

function estaCorriendo(): boolean {
  try {
    return docker("compose", "-f", COMPOSE, "ps", "-q", "minio").trim().length > 0;
  } catch {
    return false;
  }
}

async function esperarListo(): Promise<void> {
  const limite = Date.now() + ARRANQUE_MAX_MS;

  while (Date.now() < limite) {
    try {
      if ((await fetch(SALUD)).ok) return;
    } catch {
      // Todavía no escucha.
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error(`MinIO no respondió en ${SALUD} después de ${ARRANQUE_MAX_MS / 1000}s.`);
}

export async function setup(): Promise<void> {
  if (process.env.S3_TEST !== "1") return;

  if (estaCorriendo()) {
    await esperarListo();
    return;
  }

  try {
    docker("compose", "-f", COMPOSE, "up", "-d", "minio");
  } catch (error) {
    throw new Error(
      `No se pudo levantar MinIO. ¿Está corriendo el daemon de Docker?\n${String(error)}`
    );
  }

  process.env.MINIO_LEVANTADO_POR_LA_SUITE = "1";
  await esperarListo();
}

export async function teardown(): Promise<void> {
  if (process.env.MINIO_LEVANTADO_POR_LA_SUITE !== "1") return;

  // `stop` y no `down`: el compose también define el devnet de Cardano.
  try {
    docker("compose", "-f", COMPOSE, "stop", "minio");
  } catch {
    console.error("[minio] no se pudo detener; queda corriendo.");
  }
}
