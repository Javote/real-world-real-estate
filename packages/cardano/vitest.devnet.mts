import { execFileSync } from "node:child_process";
import path from "node:path";

// Levanta el devnet de Cardano para `test:yaci`, y lo baja al terminar.
//
// **Por qué vive acá y no en el `package.json`.** Un `docker compose up && vitest
// ; docker compose stop` encadenado en el script no baja nada si vitest se cae,
// y no puede saber si el contenedor ya estaba corriendo. El teardown de
// `globalSetup` corre igual cuando los tests fallan, que es justo cuando uno se
// olvida de limpiar.
//
// **Solo apaga lo que prendió.** Si el devnet ya estaba arriba —lo dejaste vos
// para iterar— se usa y se deja como estaba. Bajar infraestructura ajena es
// peor que dejar la propia prendida.
//
// **No hace nada si el suite no corre.** Sin `YACI_TEST=1`, `yaci.test.ts` se
// saltea entero, así que levantar dos contenedores sería pura espera.

const RAIZ = path.resolve(import.meta.dirname, "../..");
const COMPOSE = path.join(RAIZ, "compose.dev.yml");
const STORE = process.env.YACI_STORE_URL ?? "http://localhost:8080/api/v1";

/** yaci-store es un Spring Boot: tarda ~5 min, y hasta entonces no contesta. */
const ARRANQUE_MAX_MS = 8 * 60 * 1000;

function docker(...args: string[]): string {
  return execFileSync("docker", args, { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
}

function estaCorriendo(): boolean {
  try {
    return docker("compose", "-f", COMPOSE, "ps", "-q", "yaci").trim().length > 0;
  } catch {
    // Sin docker instalado o sin daemon. El error útil lo da `setup()`.
    return false;
  }
}

async function esperarListo(): Promise<void> {
  const limite = Date.now() + ARRANQUE_MAX_MS;

  while (Date.now() < limite) {
    try {
      if ((await fetch(`${STORE}/blocks/latest`)).ok) return;
    } catch {
      // Todavía no escucha: es el caso normal durante los primeros minutos.
    }
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
    // Puede estar arriba pero a medio arrancar: igual se espera.
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

  // `stop` y no `down`: el compose también define MinIO, y bajar el proyecto
  // entero se llevaría puesto un contenedor que esta suite nunca tocó.
  try {
    docker("compose", "-f", COMPOSE, "stop", "yaci");
  } catch {
    // Que no falle la suite por no poder limpiar: los tests ya dieron su
    // resultado, y un error acá lo taparía.
    console.error("[devnet] no se pudo detener yaci; queda corriendo.");
  }
}
