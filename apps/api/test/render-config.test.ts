import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";
import { motivoParaNoAnclar } from "../src/lib/anchor.js";
import { en } from "../src/lib/arrays.js";
import { VARIABLES_DEL_ENTORNO } from "../src/platform/config.js";

const RAIZ = join(import.meta.dirname, "..", "..", "..");

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
  buildCommand?: string;
  autoDeployTrigger?: string;
}

function servicioPorNombre(nombre: string): Servicio {
  const doc = load(readFileSync(join(RAIZ, "render.yaml"), "utf8")) as {
    services: Servicio[];
  };
  const servicio = doc.services.find((s) => s.name === nombre);
  if (!servicio) throw new Error(`render.yaml no declara el servicio \`${nombre}\``);
  return servicio;
}

const servicioApi = () => servicioPorNombre("propnexus-api");
const servicioWeb = () => servicioPorNombre("propnexus-web");

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

  it("no queda inhabilitado con el ANCHOR_MODE que declara el Blueprint", () => {
    const declarado = envDeclaradas().get("ANCHOR_MODE");
    expect(declarado?.value, "ANCHOR_MODE tiene que estar declarado con `value:`").toBeDefined();

    process.env.ANCHOR_MODE = String(declarado?.value);
    process.env.DATABASE_URL = "libsql://propnexus-javote.aws-us-east-1.turso.io";

    expect(motivoParaNoAnclar()).toBeNull();
  });

  it("declara el modo en el Blueprint y no lo deja librado al dashboard", () => {
    expect(envDeclaradas().get("ANCHOR_MODE")).toMatchObject({ value: expect.anything() });
  });

  it("declara los dos secretos del modo real, y como secretos", () => {
    const env = envDeclaradas();
    for (const clave of ["BLOCKFROST_API_KEY", "SERVICE_WALLET_PRIVATE_KEY"]) {
      expect(env.get(clave), `${clave} no está declarada en render.yaml`).toBeDefined();
      expect(env.get(clave), `${clave} no puede viajar con \`value:\``).toMatchObject({
        sync: false
      });
    }
  });

  it("apunta a Preprod", () => {
    expect(envDeclaradas().get("CARDANO_NETWORK")).toMatchObject({ value: "Preprod" });
  });
});

describe("render.yaml — cobertura de variables", () => {
  // `PORT` lo pone Render, `NODE_ENV` va inline en el startCommand y `BLOCKFROST_URL` tiene default
  // en el adaptador. Los `SEED_*` son del seed de producción, que se corre a mano (RUNBOOK §1.3).
  const OPCIONALES = new Set([
    "PORT",
    "BLOCKFROST_URL",
    "NODE_ENV",
    "SEED_ADMIN_PASSWORD",
    "SEED_DEMO_PASSWORD"
  ]);

  it("declara toda variable del schema del entorno, salvo las opcionales conocidas", () => {
    const declaradas = envDeclaradas();
    const faltantes = VARIABLES_DEL_ENTORNO.filter((v) => !OPCIONALES.has(v) && !declaradas.has(v));

    expect(faltantes, `sin declarar en render.yaml: ${faltantes.join(", ")}`).toEqual([]);
  });

  it("no exime variables que el schema ya no tiene", () => {
    const leidas = new Set<string>(VARIABLES_DEL_ENTORNO);
    const sobrantes = [...OPCIONALES].filter((v) => !leidas.has(v));

    expect(sobrantes, `sobran en OPCIONALES: ${sobrantes.join(", ")}`).toEqual([]);
  });

  it("ningún archivo de la API lee `process.env` por su cuenta: todo pasa por `entorno()`", () => {
    const { stdout } = spawnSync(
      "grep",
      [
        "-rnE",
        "--include=*.ts",
        "--exclude=*.test.ts",
        "process\\.env(\\.|\\[)",
        join(RAIZ, "apps", "api", "src"),
        join(RAIZ, "packages", "cardano", "src")
      ],
      { encoding: "utf8" }
    );

    expect(stdout).toBe("");
  });
});

describe("render.yaml — startCommand", () => {
  it("toda ruta de --require/-r/--loader/--import empieza con ./ o /", () => {
    const comando = servicioApi().startCommand ?? "";
    const flags = /(?:--require|-r|--loader|--import)[= ]([^\s&]+)/g;
    const rutas = [...comando.matchAll(flags)].map((m) => en(m, 1));

    expect(
      rutas.length,
      "no se encontró ningún flag de precarga en el startCommand"
    ).toBeGreaterThan(0);

    const sinPrefijo = rutas.filter((r) => !r.startsWith("./") && !r.startsWith("/"));
    expect(
      sinPrefijo,
      `sin ./ ni / — se resuelve como paquete, no como archivo: ${sinPrefijo.join(", ")}`
    ).toEqual([]);
  });

  it("NODE_ENV nunca es una env var del servicio — rompe pnpm install en el build", () => {
    expect(envDeclaradas().has("NODE_ENV")).toBe(false);
  });

  it("el startCommand fija NODE_ENV=production inline, para el proceso del servidor", () => {
    expect(servicioApi().startCommand ?? "").toMatch(/\bNODE_ENV=production\b/);
  });
});

describe("render.yaml — buildCommand instala devDependencies pase lo que pase", () => {
  it.each([
    ["propnexus-api", servicioApi],
    ["propnexus-web", servicioWeb]
  ])("%s fuerza NODE_ENV=development antes de pnpm install", (_nombre, servicio) => {
    const comando = servicio().buildCommand ?? "";
    expect(comando).toMatch(/NODE_ENV=development\s+pnpm install/);
  });
});

describe("render.yaml — ningún deploy con CI en rojo", () => {
  it.each([
    ["propnexus-api", servicioApi],
    ["propnexus-web", servicioWeb]
  ])("%s despliega solo cuando pasan los checks", (_nombre, servicio) => {
    expect(servicio().autoDeployTrigger).toBe("checksPass");
  });
});
