import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";
import { motivoParaNoAnclar } from "../src/lib/anchor";

// **El contrato entre `render.yaml` y el código.**
//
// Por qué existe: el 2026-08-31 se pusheó un commit sabiendo que dejaría el
// anclaje inhabilitado en producción, y eso se verificó DESPUÉS, leyendo los
// logs del deploy. Saberlo no es un control. `pnpm verify` corre la suite contra
// el entorno de test, y el entorno de test no es el que declara el Blueprint:
// entre los dos no había nada.
//
// Estos tests miran la configuración **desplegada** —la que vive en
// `render.yaml`— con las mismas reglas que la API aplica al arrancar, y fallan
// antes del push. No reemplazan mirar los logs; reemplazan enterarse tarde.

const RAIZ = join(__dirname, "..", "..", "..");

interface EnvVar {
  key: string;
  value?: string | number | boolean;
  sync?: boolean;
  fromService?: unknown;
}

interface Servicio {
  name: string;
  envVars?: EnvVar[];
  startCommand?: string;
}

function servicioApi(): Servicio {
  const doc = load(readFileSync(join(RAIZ, "render.yaml"), "utf8")) as {
    services: Servicio[];
  };
  const api = doc.services.find((s) => s.name === "propnexus-api");
  if (!api) throw new Error("render.yaml no declara el servicio `propnexus-api`");
  return api;
}

const envDeclaradas = (): Map<string, EnvVar> =>
  new Map((servicioApi().envVars ?? []).map((v) => [v.key, v]));

describe("render.yaml — el anclaje que quedaría desplegado", () => {
  const ANCHOR_MODE = process.env.ANCHOR_MODE;
  const DATABASE_URL = process.env.DATABASE_URL;

  afterEach(() => {
    if (ANCHOR_MODE === undefined) delete process.env.ANCHOR_MODE;
    else process.env.ANCHOR_MODE = ANCHOR_MODE;
    if (DATABASE_URL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = DATABASE_URL;
  });

  // El corazón del asunto. `DATABASE_URL` es `sync: false`, así que el Blueprint
  // no dice cuál es — pero el servicio desplegado corre contra Turso y eso no es
  // una suposición, es para lo que existe (D-038). Con esa base, un
  // `ANCHOR_MODE` equivocado en el YAML deja el puerto inhabilitado: la API
  // sirve, pero deja de poder probar nada y nadie se entera hasta leer un log.
  it("no queda inhabilitado con el ANCHOR_MODE que declara el Blueprint", () => {
    const declarado = envDeclaradas().get("ANCHOR_MODE");
    expect(declarado?.value, "ANCHOR_MODE tiene que estar declarado con `value:`").toBeDefined();

    process.env.ANCHOR_MODE = String(declarado?.value);
    process.env.DATABASE_URL = "libsql://propnexus-javote.aws-us-east-1.turso.io";

    // Se ejecuta la regla real, no una copia: si mañana se agrega otra condición
    // que inhabilite el puerto, este test la hereda sin tocarlo.
    expect(motivoParaNoAnclar()).toBeNull();
  });

  // `ANCHOR_MODE` con `value:` y no `sync: false` es deliberado: las que llevan
  // `value:` las gobierna el Blueprint, así que un re-sync pisa lo que alguien
  // haya cambiado a mano. Al revés —`sync: false`— el modo viviría solo en el
  // dashboard y volvería a ser invisible desde el repo.
  it("declara el modo en el Blueprint y no lo deja librado al dashboard", () => {
    expect(envDeclaradas().get("ANCHOR_MODE")).toMatchObject({ value: expect.anything() });
  });

  it("declara los dos secretos del modo real, y como secretos", () => {
    const env = envDeclaradas();
    for (const clave of ["BLOCKFROST_API_KEY", "SERVICE_WALLET_PRIVATE_KEY"]) {
      expect(env.get(clave), `${clave} no está declarada en render.yaml`).toBeDefined();
      // `sync: false` = se carga a mano en el dashboard. Un `value:` acá sería
      // un secreto commiteado (regla 12).
      expect(env.get(clave), `${clave} no puede viajar con \`value:\``).toMatchObject({
        sync: false
      });
    }
  });

  // D-013. Mainnet no se declara ni por accidente.
  it("apunta a Preprod", () => {
    expect(envDeclaradas().get("CARDANO_NETWORK")).toMatchObject({ value: "Preprod" });
  });
});

describe("render.yaml — cobertura de variables", () => {
  /**
   * Las que el código lee y el Blueprint no declara **a propósito**.
   *
   * `PORT` la inyecta Render sola. `BLOCKFROST_URL` solo se usa para apuntar a
   * un devnet; en Preprod la resuelve el factory desde la red. `NODE_ENV` NO
   * puede ser una env var del servicio a propósito: declararla ahí la aplica
   * también al `buildCommand`, y con `NODE_ENV=production` puesto `pnpm
   * install` saltea las devDependencies —rompió el build el 2026-09-07,
   * `packages/cardano` no encontraba `@types/node`—. Va inline en el
   * `startCommand`, solo para el proceso del servidor.
   */
  const OPCIONALES = new Set(["PORT", "BLOCKFROST_URL", "NODE_ENV"]);

  /**
   * Toda variable que el backend lee, sacada del código y no de una lista a
   * mano — una lista a mano envejece en silencio, que es el modo de falla que
   * este archivo entero intenta cerrar.
   *
   * El patrón es `env.LO_QUE_SEA` y cubre las dos formas que conviven en el
   * repo: `process.env.X` directo, y el `env` inyectable de `jwt.ts` y
   * `rateLimit.ts`. Los `.test.ts` quedan afuera: `YACI_*` es andamiaje de una
   * prueba contra un devnet local, no configuración de producción.
   */
  function variablesQueElCodigoLee(): string[] {
    const salida = execFileSync(
      "grep",
      [
        "-rhoE",
        "--include=*.ts",
        "--exclude=*.test.ts",
        "\\benv\\.[A-Z][A-Z0-9_]{2,}",
        join(RAIZ, "apps", "api", "src"),
        join(RAIZ, "packages", "cardano", "src")
      ],
      { encoding: "utf8" }
    );

    return [
      ...new Set(
        salida
          .split("\n")
          .filter(Boolean)
          .map((l) => l.replace("env.", ""))
      )
    ].sort();
  }

  // El caso que esto atrapa: alguien agrega `process.env.NUEVA_COSA` a un
  // servicio, anda en local porque está en su `.env`, y en producción llega
  // `undefined`. Con `requerida()` eso hoy inhabilita el anclaje; con un
  // `?? default` silencioso es peor, porque no falla.
  it("declara toda variable que el código lee, salvo las opcionales conocidas", () => {
    const declaradas = envDeclaradas();
    const faltantes = variablesQueElCodigoLee().filter(
      (v) => !OPCIONALES.has(v) && !declaradas.has(v)
    );

    expect(faltantes, `sin declarar en render.yaml: ${faltantes.join(", ")}`).toEqual([]);
  });

  // La otra punta: si una variable deja de leerse, el `OPCIONALES` que la
  // eximía sobra y hay que borrarlo. Sin esto la lista solo crece.
  it("no exime variables que el código ya no lee", () => {
    const leidas = new Set(variablesQueElCodigoLee());
    const sobrantes = [...OPCIONALES].filter((v) => !leidas.has(v));

    expect(sobrantes, `sobran en OPCIONALES: ${sobrantes.join(", ")}`).toEqual([]);
  });
});

// 2026-09-07 · `node --require apps/api/dist/.../instrumentation.js` (sin
// `./`) tumbó producción: a diferencia del script principal (posicional,
// resuelto relativo al cwd sin importar el prefijo), `--require` sigue la
// resolución de `require()` — una ruta sin `./` ni `/` se busca como paquete
// de node_modules, no como archivo. Ninguna suite corre el `startCommand`
// compilado de punta a punta (`pnpm dev` usa tsx, que resuelve distinto; los
// tests importan `app.ts` directo), así que esto es lo más cerca que se
// puede probar sin ejecutar el build real dentro del test.
describe("render.yaml — startCommand", () => {
  it("toda ruta de --require/-r/--loader/--import empieza con ./ o /", () => {
    const comando = servicioApi().startCommand ?? "";
    const flags = /(?:--require|-r|--loader|--import)[= ]([^\s&]+)/g;
    const rutas = [...comando.matchAll(flags)].map((m) => m[1]);

    expect(rutas.length, "no se encontró ningún --require en el startCommand").toBeGreaterThan(0);

    const sinPrefijo = rutas.filter((r) => !r.startsWith("./") && !r.startsWith("/"));
    expect(
      sinPrefijo,
      `sin ./ ni / — se resuelve como paquete, no como archivo: ${sinPrefijo.join(", ")}`
    ).toEqual([]);
  });

  // 2026-09-07 · `NODE_ENV: production` como env var del servicio rompió el
  // build: se aplica también al `buildCommand`, y con esa variable puesta
  // `pnpm install` saltea las devDependencies — `packages/cardano` se quedó
  // sin `@types/node` y `tsc` falló (TS2688). Tiene que ir inline en el
  // `startCommand`, nunca declarada acá.
  it("NODE_ENV nunca es una env var del servicio — rompe pnpm install en el build", () => {
    expect(envDeclaradas().has("NODE_ENV")).toBe(false);
  });

  it("el startCommand fija NODE_ENV=production inline, para el proceso del servidor", () => {
    expect(servicioApi().startCommand ?? "").toMatch(/\bNODE_ENV=production\b/);
  });
});
