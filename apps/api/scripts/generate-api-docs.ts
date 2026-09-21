import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { en } from "../src/lib/arrays";
import { describeGuardEn, leerMontaje } from "../src/lib/route-inventory";

// M3 §2 — "endpoints documentados". No hay oRPC todavía (D-066 es
// aspiracional, ver `packages/shared/CLAUDE.md`) y escribir un Postman a mano
// para 87 rutas envejece mal: el día que una cambie, nadie se acuerda de
// actualizar un JSON aparte.
//
// Este generador no adivina nada nuevo: lee la MISMA introspección que
// sostiene `test/route-guards.test.ts` (`leerMontaje`, que interroga el
// router que Express armó de verdad) y la vuelca a una colección Postman.
// Si mañana se agrega una ruta o cambia un guard, `pnpm docs:api` lo ve
// porque lee el árbol real, no un mapa mantenido a mano — la misma garantía
// que la matriz de permisos, aplicada a la documentación.
//
// **Bodies de ejemplo: acotados a propósito.** Automatizarlos para las 87
// rutas pediría que cada handler exportara su schema en un lugar
// introspectable — varios lo definen como `z.object` local (ver
// `POST /projects/:id/stages`), y migrarlos todos es un proyecto aparte que
// nadie pidió. `EJEMPLOS_CAMINO_FELIZ` cubre a mano el puñado de endpoints
// que un reviewer de Catalyst va a ejercitar de verdad —login, crear
// proyecto, crear stage, subir evidencia, aceptar invitación, transicionar
// un stage, liberar un pago— transcritos del `schema.safeParse` real de cada
// ruta. El resto de las 88 rutas queda con método+path+auth, que alcanza
// para navegar aunque no para copiar y pegar un body.

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
      totalUnits: 24,
      status: "planning"
    }
  },
  "POST /api/v1/projects/:id/stages": {
    modo: "raw",
    body: { name: "Cimentación", sequenceOrder: 1, progressPercentage: 15 }
  },
  "POST /api/v1/projects/:id/evidence": {
    modo: "formdata",
    campos: [
      { key: "file", type: "file" },
      { key: "stageId", type: "text", value: "" },
      { key: "evidenceType", type: "text", value: "document" },
      { key: "category", type: "text", value: "permits" },
      { key: "authoritative", type: "text", value: "false" }
    ]
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

/** Agrupa por prefijo: varios routers pueden compartir uno (`/developer`). */
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
  // "MÉTODO /ruta", siempre — es esta misma inventiva la que arma `clave`.
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
  const folders: PostmanFolder[] = [...agruparPorPrefijo()]
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
      // Nunca un literal acá: la password de demo vive en apps/api/.env
      // (D-047) o se pide al dueño para el ambiente real. Ver
      // apps/api/CLAUDE.md — "las credenciales del seed son públicas".
      { key: "password", value: "" }
    ],
    item: folders
  };
}

function main() {
  const salida = path.join(
    __dirname,
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

if (require.main === module) main();
