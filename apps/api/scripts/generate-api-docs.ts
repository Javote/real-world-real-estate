import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { en } from "../src/lib/arrays.js";
import { esPuntoDeEntrada } from "../src/lib/punto-de-entrada.js";
import { describeGuardEn, leerMontaje } from "../src/lib/route-inventory.js";

type EjemploBody =
  | { modo: "raw"; body: Record<string, unknown> }
  | { modo: "formdata"; campos: { key: string; value?: string; type: "text" | "file" }[] };

const EJEMPLOS_CAMINO_FELIZ: Record<string, EjemploBody> = {
  "POST /api/v1/auth/login": {
    modo: "raw",
    body: { email: "developer@example.com", password: "{{password}}" }
  },
  "POST /api/v1/projects": {
    modo: "raw",
    body: {
      name: "Torre Ejemplo",
      slug: "torre-ejemplo",
      city: "Buenos Aires",
      country: "Argentina",
      latitude: -34.5781,
      longitude: -58.4265,
      totalUnits: 24,
      status: "planning"
    }
  },
  "POST /api/v1/investor/invitations/:id/accept": { modo: "raw", body: {} },
  "PATCH /api/v1/stages/:id/state": { modo: "raw", body: { state: "InProgress" } },
  "POST /api/v1/developer/contracts/:id/releases/:stageNum": {
    modo: "raw",
    body: { amountMinorUnits: 1_000_000 }
  }
};

interface PostmanRequestItem {
  name: string;
  request: {
    method: string;
    header: { key: string; value: string }[];
    url: { raw: string; host: string[]; path: string[] };
    description: string;
    body?:
      | { mode: "raw"; raw: string; options: { raw: { language: "json" } } }
      | { mode: "formdata"; formdata: { key: string; value?: string; type: "text" | "file" }[] };
  };
}

interface PostmanFolder {
  name: string;
  item: PostmanRequestItem[];
}

function agruparPorPrefijo(): Map<string, Map<string, string>> {
  const porPrefijo = new Map<string, Map<string, string>>();

  for (const { prefijo, rutas } of leerMontaje()) {
    const existente = porPrefijo.get(prefijo) ?? new Map<string, string>();
    for (const [clave, guards] of rutas) {
      existente.set(clave, guards.map(describeGuardEn).join(" + ") || "—");
    }
    porPrefijo.set(prefijo, existente);
  }

  return porPrefijo;
}

function aItemPostman(clave: string, descripcionGuards: string): PostmanRequestItem {
  const partes = clave.split(" ");
  const metodo = en(partes, 0);
  const ruta = en(partes, 1);
  const segmentos = ruta.split("/").filter(Boolean);
  const ejemplo = EJEMPLOS_CAMINO_FELIZ[clave];

  return {
    name: clave,
    request: {
      method: metodo,
      header:
        descripcionGuards === "—" ? [] : [{ key: "Authorization", value: "Bearer {{token}}" }],
      url: {
        raw: `{{baseUrl}}${ruta}`,
        host: ["{{baseUrl}}"],
        path: segmentos
      },
      description: descripcionGuards,
      ...(ejemplo?.modo === "raw" && {
        body: {
          mode: "raw",
          raw: JSON.stringify(ejemplo.body, null, 2),
          options: { raw: { language: "json" } }
        }
      }),
      ...(ejemplo?.modo === "formdata" && {
        body: { mode: "formdata", formdata: ejemplo.campos }
      })
    }
  };
}

export function buildPostmanCollection(): object {
  const porPrefijo = agruparPorPrefijo();
  const montadas = new Set([...porPrefijo.values()].flatMap((rutas) => [...rutas.keys()]));
  const huerfanos = Object.keys(EJEMPLOS_CAMINO_FELIZ).filter((clave) => !montadas.has(clave));
  if (huerfanos.length > 0) {
    throw new Error(`[docs:api] ejemplo de una ruta que no está montada: ${huerfanos.join(", ")}`);
  }

  const folders: PostmanFolder[] = [...porPrefijo]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([prefijo, rutas]) => ({
      name: prefijo,
      item: [...rutas]
        .map(([clave, desc]) => aItemPostman(clave, desc))
        .sort((a, b) => a.name.localeCompare(b.name))
    }));

  return {
    info: {
      name: "PropNexus API",
      description:
        "Generated from the mounted router (`pnpm --filter @plataforma/api docs:api`), " +
        "not maintained by hand — see apps/api/scripts/generate-api-docs.ts. " +
        "Each request's description is the guard chain `authorize()` declares: " +
        'allowed role(s) and the per-project access rule. "—" means a public endpoint.',
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    variable: [
      { key: "baseUrl", value: "http://localhost:3001" },
      { key: "token", value: "" },
      { key: "password", value: "" }
    ],
    item: folders
  };
}

function main() {
  const salida = path.join(
    import.meta.dirname,
    "..",
    "..",
    "..",
    "specs",
    "evidencia-m3",
    "2-api",
    "postman"
  );
  mkdirSync(salida, { recursive: true });
  const archivo = path.join(salida, "propnexus.postman_collection.json");
  writeFileSync(archivo, `${JSON.stringify(buildPostmanCollection(), null, 2)}\n`);
  console.log(`[docs:api] escrito ${archivo}`);
}

if (esPuntoDeEntrada(import.meta.url)) main();
