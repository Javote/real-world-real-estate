import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describir, leerMontaje } from "../src/lib/route-inventory";

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
// **Lo que NO genera:** bodies de request/response. Esos salen de los schemas
// Zod de `packages/shared` donde existen; agregarlos es la iteración
// siguiente, endpoint por endpoint, no un bloqueante para tener el resto.

interface PostmanRequestItem {
  name: string;
  request: {
    method: string;
    header: { key: string; value: string }[];
    url: { raw: string; host: string[]; path: string[] };
    description: string;
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
      existente.set(clave, guards.map(describir).join(" + ") || "—");
    }
    porPrefijo.set(prefijo, existente);
  }

  return porPrefijo;
}

function aItemPostman(clave: string, descripcionGuards: string): PostmanRequestItem {
  const [metodo, ruta] = clave.split(" ");
  const segmentos = ruta.split("/").filter(Boolean);

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
      description: descripcionGuards
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
        "Generado desde el router montado (`pnpm --filter @plataforma/api docs:api`), " +
        "no mantenido a mano — ver apps/api/scripts/generate-api-docs.ts. " +
        "La descripción de cada request es la cadena de guards que " +
        "`authorize()` declara: rol(es) y regla de acceso por proyecto.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    variable: [
      { key: "baseUrl", value: "http://localhost:3001" },
      { key: "token", value: "" }
    ],
    item: folders
  };
}

function main() {
  const salida = path.join(__dirname, "..", "..", "..", "specs", "postman");
  mkdirSync(salida, { recursive: true });
  const archivo = path.join(salida, "propnexus.postman_collection.json");
  writeFileSync(archivo, `${JSON.stringify(buildPostmanCollection(), null, 2)}\n`);
  console.log(`[docs:api] escrito ${archivo}`);
}

if (require.main === module) main();
