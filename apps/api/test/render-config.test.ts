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
  plan?: string;
  envVars?: EnvVar[];
  startCommand?: string;
  buildCommand?: string;
  autoDeployTrigger?: string;
  buildFilter?: { paths?: string[]; ignoredPaths?: string[] };
}

const PREPROD = "render.yaml";
const MAINNET = "render.mainnet.yaml";

function servicios(archivo: string): Servicio[] {
  return (load(readFileSync(join(RAIZ, archivo), "utf8")) as { services: Servicio[] }).services;
}

function servicioPorNombre(nombre: string, archivo = PREPROD): Servicio {
  const servicio = servicios(archivo).find((s) => s.name === nombre);
  if (!servicio) throw new Error(`${archivo} no declara el servicio \`${nombre}\``);
  return servicio;
}

const servicioApi = () => servicioPorNombre("propnexus-api");
const servicioWeb = () => servicioPorNombre("propnexus-web");
const servicioApiMainnet = () => servicioPorNombre("propnexus-api-mainnet", MAINNET);
const servicioWebMainnet = () => servicioPorNombre("propnexus-web-mainnet", MAINNET);

const envDe = (servicio: Servicio): Map<string, EnvVar> =>
  new Map((servicio.envVars ?? []).map((v) => [v.key, v]));

const APIS = [
  ["propnexus-api", servicioApi, "Preprod"],
  ["propnexus-api-mainnet", servicioApiMainnet, "Mainnet"]
] as const;

const TODOS = [
  ["propnexus-api", servicioApi],
  ["propnexus-web", servicioWeb],
  ["propnexus-api-mainnet", servicioApiMainnet],
  ["propnexus-web-mainnet", servicioWebMainnet]
] as const;

describe.each(APIS)("%s — el anclaje que quedaría desplegado", (_nombre, servicio, red) => {
  const guardadas = {
    ANCHOR_MODE: process.env.ANCHOR_MODE,
    DATABASE_URL: process.env.DATABASE_URL,
    CARDANO_NETWORK: process.env.CARDANO_NETWORK
  };

  afterEach(() => {
    for (const [clave, valor] of Object.entries(guardadas)) {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    }
  });

  it("no queda inhabilitado con el ANCHOR_MODE y la red que declara el Blueprint", () => {
    const env = envDe(servicio());
    const modo = env.get("ANCHOR_MODE");
    expect(modo?.value, "ANCHOR_MODE tiene que estar declarado con `value:`").toBeDefined();

    process.env.ANCHOR_MODE = String(modo?.value);
    process.env.CARDANO_NETWORK = String(env.get("CARDANO_NETWORK")?.value);
    process.env.DATABASE_URL = "libsql://propnexus-javote.aws-us-east-1.turso.io";

    expect(motivoParaNoAnclar()).toBeNull();
  });

  it("declara el modo en el Blueprint y no lo deja librado al dashboard", () => {
    expect(envDe(servicio()).get("ANCHOR_MODE")).toMatchObject({ value: expect.anything() });
  });

  it("declara los dos secretos del modo real, y como secretos", () => {
    const env = envDe(servicio());
    for (const clave of ["BLOCKFROST_API_KEY", "SERVICE_WALLET_PRIVATE_KEY"]) {
      expect(env.get(clave), `${clave} no está declarada`).toBeDefined();
      expect(env.get(clave), `${clave} no puede viajar con \`value:\``).toMatchObject({
        sync: false
      });
    }
  });

  it(`apunta a ${red}`, () => {
    expect(envDe(servicio()).get("CARDANO_NETWORK")).toMatchObject({ value: red });
  });
});

describe("las dos redes no se cruzan (D-013)", () => {
  it("render.yaml no declara ningún servicio fuera de Preprod", () => {
    const redes = servicios(PREPROD)
      .map((s) => envDe(s).get("CARDANO_NETWORK")?.value)
      .filter((v) => v !== undefined);

    expect(redes).toEqual(["Preprod"]);
  });

  it("render.mainnet.yaml no declara ningún servicio fuera de Mainnet", () => {
    const redes = servicios(MAINNET)
      .map((s) => envDe(s).get("CARDANO_NETWORK")?.value)
      .filter((v) => v !== undefined);

    expect(redes).toEqual(["Mainnet"]);
  });

  it("los nombres de los servicios no se repiten entre los dos Blueprints", () => {
    const preprod = servicios(PREPROD).map((s) => s.name);
    const mainnet = servicios(MAINNET).map((s) => s.name);

    expect(mainnet.every((n) => n.endsWith("-mainnet"))).toBe(true);
    expect(preprod.some((n) => n.endsWith("-mainnet"))).toBe(false);
  });

  it("el bucket de mainnet no es el de Preprod", () => {
    const bucket = (s: Servicio) => envDe(s).get("S3_BUCKET")?.value;

    expect(bucket(servicioApiMainnet())).toBeDefined();
    expect(bucket(servicioApiMainnet())).not.toBe(bucket(servicioApi()));
  });

  it("la web de mainnet lleva sus TXID al explorador de mainnet", () => {
    expect(envDe(servicioWebMainnet()).get("VITE_EXPLORER_BASE")).toMatchObject({
      value: "https://cardanoscan.io"
    });
  });

  it("la API de mainnet no duerme (D-105)", () => {
    expect(servicioApiMainnet().plan).toBe("starter");
  });
});

describe("render.mainnet.yaml es render.yaml con otra red, no otra receta", () => {
  it.each([
    ["la API", servicioApi, servicioApiMainnet],
    ["la web", servicioWeb, servicioWebMainnet]
  ])("%s: mismo buildCommand y startCommand", (_cual, preprod, mainnet) => {
    expect(mainnet().buildCommand).toBe(preprod().buildCommand);
    expect(mainnet().startCommand).toBe(preprod().startCommand);
  });

  it.each([
    ["la API", servicioApi, servicioApiMainnet],
    ["la web", servicioWeb, servicioWebMainnet]
  ])("%s: mismo buildFilter, salvo el nombre del Blueprint", (_cual, preprod, mainnet) => {
    const propio = (s: Servicio) =>
      (s.buildFilter?.paths ?? []).map((p) => (p === MAINNET ? PREPROD : p));

    expect(propio(mainnet())).toEqual(preprod().buildFilter?.paths);
    expect(mainnet().buildFilter?.ignoredPaths).toEqual(preprod().buildFilter?.ignoredPaths);
  });

  it("la API: las mismas variables, y los mismos secretos como secretos", () => {
    const preprod = envDe(servicioApi());
    const mainnet = envDe(servicioApiMainnet());

    expect([...mainnet.keys()].sort()).toEqual([...preprod.keys()].sort());
    for (const [clave, variable] of preprod) {
      if (variable.sync === false) expect(mainnet.get(clave), clave).toMatchObject({ sync: false });
    }
  });

  it("la web: las mismas variables, más el explorador", () => {
    const preprod = [...envDe(servicioWeb()).keys(), "VITE_EXPLORER_BASE"].sort();

    expect([...envDe(servicioWebMainnet()).keys()].sort()).toEqual(preprod);
  });
});

describe("render.yaml — cobertura de variables", () => {
  // `PORT` lo pone Render, `NODE_ENV` va inline en el startCommand y `BLOCKFROST_URL` tiene default
  // en el adaptador. Los `SEED_*` son del seed de producción, que se corre a mano (RUNBOOK §1.3).
  const OPCIONALES = new Set([
    "PORT",
    "BLOCKFROST_URL",
    "NODE_ENV",
    "SEED_ADMIN_EMAIL",
    "SEED_ADMIN_PASSWORD",
    "SEED_DEMO_PASSWORD"
  ]);

  it.each(APIS)(
    "%s declara toda variable del schema del entorno, salvo las opcionales conocidas",
    (_nombre, servicio) => {
      const declaradas = envDe(servicio());
      const faltantes = VARIABLES_DEL_ENTORNO.filter(
        (v) => !OPCIONALES.has(v) && !declaradas.has(v)
      );

      expect(faltantes, `sin declarar: ${faltantes.join(", ")}`).toEqual([]);
    }
  );

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

describe.each(APIS)("%s — startCommand", (_nombre, servicio) => {
  it("toda ruta de --require/-r/--loader/--import empieza con ./ o /", () => {
    const comando = servicio().startCommand ?? "";
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
    expect(envDe(servicio()).has("NODE_ENV")).toBe(false);
  });

  it("el startCommand fija NODE_ENV=production inline, para el proceso del servidor", () => {
    expect(servicio().startCommand ?? "").toMatch(/\bNODE_ENV=production\b/);
  });
});

describe("render.yaml — buildCommand instala devDependencies pase lo que pase", () => {
  it.each(TODOS)("%s fuerza NODE_ENV=development antes de pnpm install", (_nombre, servicio) => {
    const comando = servicio().buildCommand ?? "";
    expect(comando).toMatch(/NODE_ENV=development\s+pnpm install/);
  });
});

describe("render.yaml — ningún deploy con CI en rojo", () => {
  it.each(TODOS)("%s despliega solo cuando pasan los checks", (_nombre, servicio) => {
    expect(servicio().autoDeployTrigger).toBe("checksPass");
  });
});
