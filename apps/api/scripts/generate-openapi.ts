import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  addProjectMemberSchema,
  anchorDocumentSchema,
  auditLogEntrySchema,
  auditLogQuerySchema,
  auditLogRowSchema,
  buildingSchematicFloorSchema,
  bundleFilesSchema,
  capitalByProjectSchema,
  capitalMonthlyPointSchema,
  capitalSummarySchema,
  contractReleaseSchema,
  createDeveloperProjectSchema,
  createInvitationSchema,
  createProjectSchema,
  createUnitSchema,
  createUserSchema,
  cuidParamSchema,
  developerContractSchema,
  developerDocumentListQuerySchema,
  developerDocumentSchema,
  developerKpisSchema,
  developerProgressItemSchema,
  developerProjectCreateResultSchema,
  developerProjectDetailSchema,
  developerProjectListItemSchema,
  developerUnitDirectoryEntrySchema,
  evidenceBundleSummarySchema,
  evidenceProofSchema,
  evidenceSchema,
  hex64ParamSchema,
  investorDirectoryEntrySchema,
  invitationSchema,
  loginRequestSchema,
  loginResponseSchema,
  meResponseSchema,
  notificationPrefsSchema,
  onChainEventSchema,
  paginatedResponseSchema,
  paymentReleaseResultSchema,
  positiveIntParamSchema,
  profileSchema,
  projectDetailSchema,
  projectDocumentSchema,
  projectListItemSchema,
  projectListQuerySchema,
  projectMemberSchema,
  projectMemberWithUserSchema,
  projectSchema,
  publicDossierSchema,
  reconciliationResultSchema,
  releasePaymentSchema,
  reservationToEscrowTelemetrySchema,
  stageEventSummarySchema,
  stageEvidenceSummarySchema,
  stageEvidenceUploadResultSchema,
  stageEvidenceUploadSchema,
  stageSchema,
  stageTransitionSchema,
  stageWithThreadSchema,
  unitSchema,
  unreadCountSchema,
  updateEvidenceSchema,
  updateNotificationPrefsSchema,
  updateProfileSchema,
  updateProjectSchema,
  updateStageSchema,
  updateUnitSchema,
  updateUserSchema,
  userMutationResultSchema,
  userSummarySchema
} from "@plataforma/shared";
import { type ZodType, z } from "zod";
import { createDocument } from "zod-openapi";
import { en } from "../src/lib/arrays";
import { OpenAPIGenerator, os, ZodToJsonSchemaConverter } from "../src/lib/orpc";
import { describir, leerMontaje } from "../src/lib/route-inventory";
import { type CertifierContext, certifierOrpcRouter } from "../src/routes/certifier.routes";
import { type InvestorContext, investorOrpcRouter } from "../src/routes/investor.routes";
import { type NotaryContext, notaryOrpcRouter } from "../src/routes/notary.routes";

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
// reviewer necesita para armar un request válido.
//
// **Las respuestas — Tanda 1 y Tanda 2 del plan
// (`specs/PLAN-2026-09-08-documentar-api-completa.md`), cerradas.** Tanda 1
// conectó las ~24 que ya tenían un schema Zod real en `packages/shared`
// —antes solo usado para tipar en compile-time (`satisfies`) o ni eso—; Tanda
// 2 escribió el schema que faltaba para las ~61 restantes, archivo por
// archivo. Las dos VALIDAN en runtime (`schema.parse(...)` antes de
// responder) y se documentan acá en `RESPONSE_SCHEMAS`. De las rutas que no
// migraron a oRPC, solo quedan sin entrada las que legítimamente no tienen
// cuerpo JSON: `204 No Content` (borrados) y la que devuelve un archivo
// binario (`/evidence/:id/download`) — `/dossier/export.pdf` migró a oRPC
// con un `File` como body (SPEC-212 §C) y ya no pasa por acá.
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
  }
  // Las rutas de `notary` (§A), `certifier` (§B) e `investor` (§C, salvo
  // `export.pdf`) ya NO están acá: su schema se declara una sola vez en el
  // procedimiento oRPC (`notary.routes.ts`, `certifier.routes.ts`,
  // `investor.routes.ts`) y de ahí sale tanto la validación como el
  // fragmento de OpenAPI — ver `ORPC_MIGRADAS` y el merge al final de
  // `buildOpenApiDocument`.
};

/**
 * Ruta → su schema de respuesta de éxito. Tanda 1 del plan: solo las que ya
 * tenían un schema Zod real antes de este cambio — ninguno se escribió acá,
 * solo se conectó. Si el handler devuelve una lista, el valor es
 * `z.array(...)`; si es la forma `{ items, nextCursor }`, `paginatedResponseSchema(...)`.
 */
const RESPONSE_SCHEMAS: Record<string, ZodType> = {
  "POST /api/v1/auth/login": loginResponseSchema,
  "GET /api/v1/auth/me": meResponseSchema,
  "GET /api/v1/notifications/unread-count": unreadCountSchema,
  "GET /api/v1/developer/documents": z.array(developerDocumentSchema),
  "GET /api/v1/developer/kpis": developerKpisSchema,
  "GET /api/v1/developer/capital/summary": capitalSummarySchema,
  "GET /api/v1/developer/capital/monthly": z.array(capitalMonthlyPointSchema),
  "GET /api/v1/developer/capital/by-project": z.array(capitalByProjectSchema),
  "GET /api/v1/developer/investors": z.array(investorDirectoryEntrySchema),
  "GET /api/v1/profile": profileSchema,
  "PATCH /api/v1/profile": profileSchema,
  "PATCH /api/v1/profile/notifications": notificationPrefsSchema,
  "GET /api/v1/evidence/:bundleId/proof/:fileHash": evidenceProofSchema,
  "GET /api/v1/audit-logs/telemetry/reservation-to-escrow": reservationToEscrowTelemetrySchema,
  "GET /api/v1/users": z.array(userSummarySchema),
  "POST /api/v1/users": userMutationResultSchema,
  "GET /api/v1/users/:id": userSummarySchema,
  "PATCH /api/v1/users/:id": userMutationResultSchema,
  // Mismo `.extend(...)` que arma `stages.routes.ts` — no un schema aparte.
  "GET /api/v1/stages/:id": stageSchema.extend({
    evidences: z.array(evidenceSchema),
    project: projectSchema,
    hasOnChainThread: z.boolean()
  }),
  "PATCH /api/v1/stages/:id": stageSchema,
  "PATCH /api/v1/stages/:id/state": stageSchema.extend({ anchor: onChainEventSchema }),
  // Mismo `.extend(...)` que `evidence.routes.ts` — no un schema aparte.
  "GET /api/v1/evidence/:id": evidenceSchema.extend({
    project: projectSchema,
    stage: stageSchema.nullable(),
    uploadedBy: z.strictObject({ id: z.string(), email: z.email(), fullName: z.string() })
  }),
  "PATCH /api/v1/evidence/:id": evidenceSchema,
  "POST /api/v1/evidence/reconcile": reconciliationResultSchema,
  // Documenta el 201 (creación); el 200 (idempotente, ya anclada) es el mismo
  // schema — ver el comentario de `codigoDeExito`.
  "POST /api/v1/evidence/:id/anchor": onChainEventSchema,
  "GET /api/v1/evidence/:bundleId/files": bundleFilesSchema,
  "GET /api/v1/projects": z.array(projectListItemSchema),
  "POST /api/v1/projects": projectSchema,
  "GET /api/v1/projects/:id": projectDetailSchema,
  "PATCH /api/v1/projects/:id": projectSchema,
  "GET /api/v1/projects/:id/members": z.array(projectMemberWithUserSchema),
  "POST /api/v1/projects/:id/members": projectMemberSchema,
  "GET /api/v1/projects/:id/documents": z.array(projectDocumentSchema),
  "GET /api/v1/projects/:id/building-schematic": z.array(buildingSchematicFloorSchema),
  "POST /api/v1/developer/projects/:id/stages/:stageId/evidence": stageEvidenceUploadResultSchema,
  "GET /api/v1/developer/projects": z.array(developerProjectListItemSchema),
  "GET /api/v1/developer/projects/:id": developerProjectDetailSchema,
  "POST /api/v1/developer/projects": developerProjectCreateResultSchema,
  "GET /api/v1/developer/progress": z.array(developerProgressItemSchema),
  "GET /api/v1/developer/audit-log": paginatedResponseSchema(auditLogEntrySchema),
  // Las dos ramas (200 idempotente, 201 recién anclado) son el mismo OnChainEvent.
  "POST /api/v1/developer/documents": onChainEventSchema,
  "GET /api/v1/developer/projects/:id/units": z.array(unitSchema),
  "POST /api/v1/developer/projects/:id/units": unitSchema,
  "PATCH /api/v1/developer/units/:id": unitSchema,
  "GET /api/v1/developer/units": z.array(developerUnitDirectoryEntrySchema),
  "POST /api/v1/developer/projects/:id/invitations": invitationSchema,
  "GET /api/v1/developer/projects/:id/contracts": z.array(developerContractSchema),
  // Documenta el 201 (recién liberada); el 200 (idempotente) es
  // paymentAttestationSchema solo, sin `anchor`.
  "POST /api/v1/developer/contracts/:id/releases/:stageNum": paymentReleaseResultSchema,
  "GET /api/v1/projects/:id/stages": z.array(stageWithThreadSchema),
  "POST /api/v1/projects/:id/stages/:stageId/retry-anchor": stageSchema.extend({
    anchor: onChainEventSchema
  }),
  "GET /api/v1/projects/:id/stages/:stageId": stageSchema.extend({
    evidences: z.array(stageEvidenceSummarySchema),
    bundle: evidenceBundleSummarySchema.nullable(),
    hasOnChainThread: z.boolean(),
    events: z.array(stageEventSummarySchema)
  }),
  "GET /api/v1/contracts/:contractId/releases": z.array(contractReleaseSchema),
  "GET /api/v1/audit-logs": z.array(auditLogRowSchema),
  "GET /api/v1/public/dossier/:shareToken": publicDossierSchema
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

/**
 * La forma real de cada param, **por nombre** — no por ruta. En este dominio
 * el nombre alcanza: cualquier `:id`/`:projectId`/`:stageId`/`:contractId`/
 * `:unitId`/`:bundleId` es un `cuid2` (`createId()`, la única forma en que
 * este código genera ids); `:fileHash` y `:shareToken` comparten la forma
 * hex64 sin compartir origen (ver `packages/shared/src/params.ts`); `:stageNum`
 * es el único numérico. Es la misma tabla que sostiene los
 * `router.param(...)` de cada archivo de rutas — si un param nuevo aparece acá
 * y no ahí (o viceversa), documentación y runtime divergen en silencio.
 */
const PARAM_SCHEMAS: Record<string, ZodType> = {
  id: cuidParamSchema,
  projectId: cuidParamSchema,
  stageId: cuidParamSchema,
  contractId: cuidParamSchema,
  unitId: cuidParamSchema,
  bundleId: cuidParamSchema,
  fileHash: hex64ParamSchema,
  shareToken: hex64ParamSchema,
  stageNum: positiveIntParamSchema
};

function parametrosDePath(ruta: string): string[] {
  // El grupo de captura no es opcional en el patrón — siempre matchea si `m` existe.
  return [...ruta.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => en(m, 1));
}

function aPathOpenApi(ruta: string): string {
  return ruta.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

/**
 * Las rutas de `notary` (§A), `certifier` (§B) e `investor` (§C, las 14), ya
 * migradas a oRPC — el bucle de abajo las saltea y su fragmento sale, aparte,
 * de sus routers oRPC combinados con `OpenAPIGenerator` (ver el final de
 * esta función). Cuando `§D` migre, sus rutas se suman acá.
 */
const ORPC_MIGRADAS = new Set([
  "GET /api/v1/notary/kpis",
  "GET /api/v1/notary/dossiers/pending",
  "GET /api/v1/notary/dossiers/:id",
  "POST /api/v1/notary/dossiers/:id/sign",
  "POST /api/v1/notary/dossiers/:id/reject",
  "GET /api/v1/notary/signatures",
  "GET /api/v1/certifier/kpis",
  "GET /api/v1/certifier/assignments",
  "GET /api/v1/certifier/stages/:id",
  "POST /api/v1/certifier/stages/:id/certify",
  "POST /api/v1/certifier/stages/:id/observe",
  "GET /api/v1/certifier/certificates",
  "GET /api/v1/investor/favorites",
  "POST /api/v1/investor/favorites/:projectId",
  "DELETE /api/v1/investor/favorites/:projectId",
  "GET /api/v1/investor/units",
  "GET /api/v1/investor/units/:id",
  "GET /api/v1/investor/units/:id/news",
  "GET /api/v1/investor/units/:id/dossier",
  "POST /api/v1/investor/units/:id/dossier/share",
  "GET /api/v1/investor/notifications",
  "GET /api/v1/investor/invitations/:id",
  "POST /api/v1/investor/invitations/:id/accept",
  "POST /api/v1/investor/invitations/:id/decline",
  "GET /api/v1/investor/contracts/:unitId",
  "GET /api/v1/investor/units/:id/dossier/export.pdf"
]);

export async function buildOpenApiDocument() {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const { rutas, handlers } of leerMontaje()) {
    for (const [clave, guards] of rutas) {
      if (ORPC_MIGRADAS.has(clave)) continue;

      // "MÉTODO /ruta", siempre — es esta misma inventiva la que arma `clave`.
      const partesClave = clave.split(" ");
      const metodo = en(partesClave, 0);
      const ruta = en(partesClave, 1);
      const params = parametrosDePath(ruta);
      const entrada = REQUEST_SCHEMAS[clave];
      const autenticado = guards.length > 0;
      const exito = codigoDeExito(handlers.get(clave));

      const requestParams =
        params.length > 0 || entrada?.query
          ? {
              ...(params.length > 0 && {
                path: z.object(
                  Object.fromEntries(params.map((p) => [p, PARAM_SCHEMAS[p] ?? z.string()]))
                )
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
          [exito]: {
            description: exito === "204" ? "Sin contenido" : "OK",
            ...(RESPONSE_SCHEMAS[clave] && {
              content: { "application/json": { schema: RESPONSE_SCHEMAS[clave] } }
            })
          },
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

  // Las rutas de `notary` (§A) y `certifier` (§B): un router oRPC combinado
  // por vertical, prefijado al mismo path absoluto que `MONTAJE` usa para
  // montarlas de verdad (`os.prefix(...).router(...)`, no un string armado a
  // mano dos veces), y `OpenAPIGenerator` arma su fragmento desde ahí — el
  // mismo contrato Zod que valida en runtime, no una segunda copia.
  // `ZodToJsonSchemaConverter` tiene que ser el de `@orpc/zod/zod4`: el de
  // Zod v3 devuelve un schema vacío en silencio contra la forma interna de
  // Zod v4 (D-035) — ver `src/lib/orpc.ts`.
  const generadorOrpc = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
  });
  const documentoNotary = await generadorOrpc.generate(
    os.$context<NotaryContext>().prefix("/api/v1/notary").router(notaryOrpcRouter),
    {
      info: { title: "PropNexus API — notary (oRPC)", version: "1.0.0" }
    }
  );
  Object.assign(paths, documentoNotary.paths);

  const documentoCertifier = await generadorOrpc.generate(
    os.$context<CertifierContext>().prefix("/api/v1/certifier").router(certifierOrpcRouter),
    {
      info: { title: "PropNexus API — certifier (oRPC)", version: "1.0.0" }
    }
  );
  Object.assign(paths, documentoCertifier.paths);

  const documentoInvestor = await generadorOrpc.generate(
    os.$context<InvestorContext>().prefix("/api/v1/investor").router(investorOrpcRouter),
    {
      info: { title: "PropNexus API — investor (oRPC)", version: "1.0.0" }
    }
  );
  Object.assign(paths, documentoInvestor.paths);

  return createDocument({
    openapi: "3.1.0",
    info: {
      title: "PropNexus API",
      version: "1.0.0",
      description:
        "Generado desde el router montado (`pnpm --filter @plataforma/api docs:openapi`), " +
        "no mantenido a mano — ver apps/api/scripts/generate-openapi.ts. El código de éxito " +
        "se lee del `res.status(2xx)` real del handler (con el de creación si el handler " +
        "tiene más de uno, caso idempotente). Body, query y 76 de las 85 respuestas de éxito " +
        "son el schema Zod real, validado en runtime antes de responder — las 9 restantes " +
        "legítimamente no tienen cuerpo JSON (`204 No Content` o un archivo binario)."
    },
    // Sin `/api/v1`: los 70 paths ya lo traen (sale de `MONTAJE`, el prefijo es
    // parte de la clave). Con el prefijo acá TAMBIÉN, un cliente generado o el
    // botón "Try it" de Swagger UI arman `.../api/v1/api/v1/auth/login` — doble
    // prefijo, 404 (SPEC-204). El puerto sale de `apps/api/.env.example` (8787
    // es el puerto de dev), no del 3001 que no aparece en ningún otro lado del
    // repo.
    servers: [{ url: "http://localhost:8787", description: "Local (pnpm dev)" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
      }
    },
    paths
  });
}

async function main() {
  const salida = path.join(__dirname, "..", "..", "..", "specs", "openapi");
  mkdirSync(salida, { recursive: true });
  const archivo = path.join(salida, "propnexus.openapi.json");
  writeFileSync(archivo, `${JSON.stringify(await buildOpenApiDocument(), null, 2)}\n`);
  console.log(`[docs:openapi] escrito ${archivo}`);
}

if (require.main === module) main();
