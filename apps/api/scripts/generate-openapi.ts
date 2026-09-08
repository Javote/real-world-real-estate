import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  addProjectMemberSchema,
  anchorDocumentSchema,
  auditLogQuerySchema,
  createDeveloperProjectSchema,
  createInvitationSchema,
  createProjectSchema,
  createUnitSchema,
  createUserSchema,
  cursorPaginationSchema,
  developerDocumentListQuerySchema,
  loginRequestSchema,
  notificationQuerySchema,
  observeStageSchema,
  projectListQuerySchema,
  rejectDossierSchema,
  releasePaymentSchema,
  stageEvidenceUploadSchema,
  stageTransitionSchema,
  updateEvidenceSchema,
  updateNotificationPrefsSchema,
  updateProfileSchema,
  updateProjectSchema,
  updateStageSchema,
  updateUnitSchema,
  updateUserSchema
} from "@plataforma/shared";
import { type ZodType, z } from "zod";
import { createDocument } from "zod-openapi";
import { describir, leerMontaje } from "../src/lib/route-inventory";

// El otro consumidor de `route-inventory` (junto a `generate-api-docs.ts` y
// `test/route-guards.test.ts`): un documento OpenAPI 3.1, leído del MISMO
// router montado — no un mapa mantenido a mano que envejece en silencio.
//
// **Esto era imposible hasta el commit anterior.** 23 de los 26 endpoints que
// validan con Zod tenían su schema declarado INLINE, dentro del handler — sin
// una referencia importable, no hay nada que pasarle a `zod-openapi`. Migrar
// esos schemas a `packages/shared` (regla 6, que ya lo pedía por otro motivo)
// es lo que habilita este generador: hoy los 26 `safeParse` de la API resuelven
// a un export con nombre, y este archivo solo los mapea a su ruta.
//
// **La ambición es la misma que la del Postman: acotada, y a propósito.**
// Body/query van con su schema real donde existe — que es la parte que un
// reviewer necesita para armar un request válido. Las *respuestas* quedan
// genéricas (200/201/204 sin schema): documentarlas pediría que cada handler
// devolviera un tipo Zod, y hoy la mayoría devuelve un tipo TS inferido de
// Kysely (`DeveloperKpis`, `NotarySignature`...) que no es un schema en
// runtime — no hay de dónde derivar un JSON Schema sin inventarlo. Ese es un
// proyecto aparte que nadie pidió todavía.
//
// **El código de éxito se lee del handler, no se adivina por verbo HTTP.**
// La primera versión de este generador usaba una convención (`POST → 201`,
// `DELETE → 204`, resto `200`) y mentía en al menos tres rutas reales:
// `POST /auth/login` (200, no crea nada), `POST /evidence/reconcile` (200, es
// un disparador de mantenimiento) y `POST /invitations/:id/decline` (204, no
// 201). `codigoDeExito` (abajo) regexea el `res.status(2xx)` real del handler
// terminal — que `leerMontaje` ahora expone en `handlers` para esto. Sigue sin
// cubrir las respuestas **secundarias** de un handler idempotente (`200` si
// ya existía, `201` si se creó ahora): documenta la de creación, que es la
// más informativa — mismo tipo de límite que `EJEMPLOS_CAMINO_FELIZ` en
// `generate-api-docs.ts`.

type SchemaEntry = { body?: ZodType; bodyContentType?: string; query?: ZodType };

/**
 * Ruta → sus schemas de entrada. Una entrada por cada uno de los 26
 * `safeParse(req.body|query)` que hay en `apps/api/src/routes`.
 *
 * `test/openapi-freshness.test.ts` (mismo patrón que la de Postman) prueba
 * que el JSON commiteado sea el que este archivo generaría hoy — pero no
 * prueba que esta lista esté completa: si un `safeParse` nuevo no se agrega
 * acá, el documento generado simplemente no cambia y el test sigue verde. La
 * única defensa real es la misma que sostiene el literal de
 * `route-guards.test.ts`: se edita el mismo día que se agrega el `safeParse`.
 */
const REQUEST_SCHEMAS: Record<string, SchemaEntry> = {
  "POST /api/v1/auth/login": { body: loginRequestSchema },
  "GET /api/v1/projects": { query: projectListQuerySchema },
  "POST /api/v1/projects": { body: createProjectSchema },
  "PATCH /api/v1/projects/:id": { body: updateProjectSchema },
  "POST /api/v1/projects/:id/members": { body: addProjectMemberSchema },
  "PATCH /api/v1/stages/:id": { body: updateStageSchema },
  "PATCH /api/v1/stages/:id/state": { body: stageTransitionSchema },
  "PATCH /api/v1/evidence/:id": { body: updateEvidenceSchema },
  "PATCH /api/v1/profile": { body: updateProfileSchema },
  "PATCH /api/v1/profile/notifications": { body: updateNotificationPrefsSchema },
  "POST /api/v1/users": { body: createUserSchema },
  "PATCH /api/v1/users/:id": { body: updateUserSchema },
  "GET /api/v1/investor/notifications": { query: notificationQuerySchema },
  "GET /api/v1/developer/documents": { query: developerDocumentListQuerySchema },
  "GET /api/v1/developer/audit-log": { query: auditLogQuerySchema },
  "POST /api/v1/developer/documents": { body: anchorDocumentSchema },
  "POST /api/v1/developer/projects": { body: createDeveloperProjectSchema },
  "POST /api/v1/developer/projects/:id/units": { body: createUnitSchema },
  "PATCH /api/v1/developer/units/:id": { body: updateUnitSchema },
  "POST /api/v1/developer/projects/:id/invitations": { body: createInvitationSchema },
  "POST /api/v1/developer/contracts/:id/releases/:stageNum": { body: releasePaymentSchema },
  // Multipart: el archivo es un campo aparte (`req.file`, Multer) que este
  // schema no valida — valida los demás campos del form, que Express entrega
  // como string. Documentado en `bodyContentType`, no en el schema.
  "POST /api/v1/developer/projects/:id/stages/:stageId/evidence": {
    body: stageEvidenceUploadSchema,
    bodyContentType: "multipart/form-data"
  },
  "GET /api/v1/certifier/certificates": { query: cursorPaginationSchema },
  "POST /api/v1/certifier/stages/:id/observe": { body: observeStageSchema },
  "GET /api/v1/notary/signatures": { query: cursorPaginationSchema },
  "POST /api/v1/notary/dossiers/:id/reject": { body: rejectDossierSchema }
};

/** La forma exacta de `ZodError.flatten()`, que es lo que devuelve todo 400. */
const zodErrorSchema = z
  .object({
    formErrors: z.array(z.string()),
    fieldErrors: z.record(z.string(), z.array(z.string()))
  })
  .meta({ id: "ValidationError" });

/**
 * El código de éxito real, leído del propio handler — no una convención por
 * verbo HTTP. Se probó la convención (`POST → 201`, `DELETE → 204`, resto
 * `200`) primero y mentía en al menos tres rutas reales: `POST /auth/login`
 * (200, no crea nada), `POST /evidence/reconcile` (200, es un disparador de
 * mantenimiento) y `POST /invitations/:id/decline` (204, no 201). La única
 * fuente que no miente es el código fuente del handler.
 *
 * Cuando el handler tiene más de un código de éxito (el patrón idempotente:
 * `200` si ya existía, `201` si se creó ahora — `POST /evidence/:id/anchor`,
 * `POST /notary/dossiers/:id/sign`), se documenta el de **creación**: es la
 * rama más informativa, y la limitación queda declarada arriba en la
 * descripción del documento.
 */
function codigoDeExito(handler: unknown): string {
  if (typeof handler !== "function") return "200";
  const codigos = [...handler.toString().matchAll(/res\.status\((2\d\d)\)/g)].map((m) => m[1]);
  if (codigos.includes("201")) return "201";
  if (codigos.includes("204")) return "204";
  // Sin `.status()` explícito, `res.json(...)` responde 200 — el default de
  // Express, no una adivinanza.
  return codigos[0] ?? "200";
}

function parametrosDePath(ruta: string): string[] {
  return [...ruta.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1]);
}

function aPathOpenApi(ruta: string): string {
  return ruta.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

export function buildOpenApiDocument() {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const { rutas, handlers } of leerMontaje()) {
    for (const [clave, guards] of rutas) {
      const [metodo, ruta] = clave.split(" ");
      const params = parametrosDePath(ruta);
      const entrada = REQUEST_SCHEMAS[clave];
      const autenticado = guards.length > 0;
      const exito = codigoDeExito(handlers.get(clave));

      const requestParams =
        params.length > 0 || entrada?.query
          ? {
              ...(params.length > 0 && {
                path: z.object(Object.fromEntries(params.map((p) => [p, z.string()])))
              }),
              ...(entrada?.query && { query: entrada.query })
            }
          : undefined;

      const pathOpenApi = aPathOpenApi(ruta);
      paths[pathOpenApi] ??= {};
      paths[pathOpenApi][metodo.toLowerCase()] = {
        summary: clave,
        description: guards.map(describir).join(" + ") || "Sin sesión — pública (M2-D5 §2.2)",
        ...(requestParams && { requestParams }),
        ...(entrada?.body && {
          requestBody: {
            content: { [entrada.bodyContentType ?? "application/json"]: { schema: entrada.body } }
          }
        }),
        ...(autenticado && { security: [{ bearerAuth: [] }] }),
        responses: {
          [exito]: { description: exito === "204" ? "Sin contenido" : "OK" },
          ...(entrada && {
            "400": {
              description: "Body o query no pasan el schema",
              content: { "application/json": { schema: zodErrorSchema } }
            }
          }),
          ...(autenticado && {
            "401": { description: "Sin sesión o token inválido" },
            "403": { description: "Rol o membresía insuficiente" }
          })
        }
      };
    }
  }

  return createDocument({
    openapi: "3.1.0",
    info: {
      title: "PropNexus API",
      version: "1.0.0",
      description:
        "Generado desde el router montado (`pnpm --filter @plataforma/api docs:openapi`), " +
        "no mantenido a mano — ver apps/api/scripts/generate-openapi.ts. El código de éxito " +
        "se lee del `res.status(2xx)` real del handler (con el de creación si el handler " +
        "tiene más de uno, caso idempotente); las respuestas no traen schema (ver el " +
        "comentario del generador). Body y query sí son el schema Zod real donde existe."
    },
    servers: [{ url: "http://localhost:3001/api/v1", description: "Local (pnpm dev)" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
      }
    },
    paths
  });
}

function main() {
  const salida = path.join(__dirname, "..", "..", "..", "specs", "openapi");
  mkdirSync(salida, { recursive: true });
  const archivo = path.join(salida, "propnexus.openapi.json");
  writeFileSync(archivo, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
  console.log(`[docs:openapi] escrito ${archivo}`);
}

if (require.main === module) main();
