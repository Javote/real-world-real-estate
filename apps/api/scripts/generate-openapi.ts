import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  cuidParamSchema,
  EVIDENCE_MAX_FILES,
  hex64ParamSchema,
  positiveIntParamSchema,
  projectCoverResultSchema,
  stageEvidenceUploadResultSchema,
  stageEvidenceUploadSchema
} from "@plataforma/shared";
import { type ZodType, z } from "zod";
import { createDocument } from "zod-openapi";
import { en } from "../src/lib/arrays.js";
import { OpenAPIGenerator, os, ZodToJsonSchemaConverter } from "../src/lib/orpc.js";
import { esPuntoDeEntrada } from "../src/lib/punto-de-entrada.js";
import { describeGuardEn, leerMontaje } from "../src/lib/route-inventory.js";
import { auditOrpcRouter } from "../src/routes/audit.routes.js";
import { type AuthContext, authOrpcRouter } from "../src/routes/auth.routes.js";
import { capitalOrpcRouter } from "../src/routes/capital.routes.js";
import { type CertifierContext, certifierOrpcRouter } from "../src/routes/certifier.routes.js";
import { contractsOrpcRouter } from "../src/routes/contracts.routes.js";
import { type DeveloperContext, developerOrpcRouter } from "../src/routes/developer.routes.js";
import { developerComercialOrpcRouter } from "../src/routes/developer-comercial.routes.js";
import { type EvidenceContext, evidenceOrpcRouter } from "../src/routes/evidence.routes.js";
import { type InvestorContext, investorOrpcRouter } from "../src/routes/investor.routes.js";
import { type NotaryContext, notaryOrpcRouter } from "../src/routes/notary.routes.js";
import {
  type NotificationsContext,
  notificationsOrpcRouter
} from "../src/routes/notifications.routes.js";
import { type ProfileContext, profileOrpcRouter } from "../src/routes/profile.routes.js";
import { type ProjectsContext, projectsOrpcRouter } from "../src/routes/projects.routes.js";
import {
  type ProjectsObraContext,
  projectsObraOrpcRouter
} from "../src/routes/projects-obra.routes.js";
import { publicOrpcRouter } from "../src/routes/public.routes.js";
import { type StagesContext, stagesOrpcRouter } from "../src/routes/stages.routes.js";
import { type UsersContext, usersOrpcRouter } from "../src/routes/users.routes.js";

type SchemaEntry = { body?: ZodType; bodyContentType?: string; query?: ZodType };

const REQUEST_SCHEMAS: Record<string, SchemaEntry> = {
  "POST /api/v1/developer/projects/:id/stages/:stageId/evidence": {
    body: stageEvidenceUploadSchema.extend({
      file: z.array(z.file()).min(1).max(EVIDENCE_MAX_FILES)
    }),
    bodyContentType: "multipart/form-data"
  },
  "PUT /api/v1/developer/projects/:id/cover": {
    body: z.object({ file: z.file() }),
    bodyContentType: "multipart/form-data"
  }
};

const RESPONSE_SCHEMAS: Record<string, ZodType> = {
  "POST /api/v1/developer/projects/:id/stages/:stageId/evidence": stageEvidenceUploadResultSchema,
  "PUT /api/v1/developer/projects/:id/cover": projectCoverResultSchema
};

const zodErrorSchema = z
  .object({
    formErrors: z.array(z.string()),
    fieldErrors: z.record(z.string(), z.array(z.string()))
  })
  .meta({ id: "ValidationError" });

function codigoDeExito(handler: unknown): string {
  if (typeof handler !== "function") return "200";
  const codigos = [...handler.toString().matchAll(/res\.status\((2\d\d)\)/g)].map((m) => m[1]);
  if (codigos.includes("201")) return "201";
  if (codigos.includes("204")) return "204";
  return codigos[0] ?? "200";
}

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
  return [...ruta.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => en(m, 1));
}

function aPathOpenApi(ruta: string): string {
  return ruta.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

const ORPC_MIGRADAS = new Set([
  "GET /api/v1/auth/me",
  "POST /api/v1/auth/login",
  "GET /api/v1/public/dossier/:shareToken",
  "GET /api/v1/public/projects/:id/cover",
  "GET /api/v1/profile",
  "PATCH /api/v1/profile",
  "PATCH /api/v1/profile/notifications",
  "GET /api/v1/notifications/unread-count",
  "PATCH /api/v1/notifications/:id/read",
  "GET /api/v1/audit-logs",
  "GET /api/v1/audit-logs/telemetry/reservation-to-escrow",
  "GET /api/v1/contracts/:contractId/releases",
  "GET /api/v1/stages/:id",
  "PATCH /api/v1/stages/:id",
  "PATCH /api/v1/stages/:id/state",
  "GET /api/v1/projects",
  "POST /api/v1/projects",
  "GET /api/v1/projects/:id",
  "PATCH /api/v1/projects/:id",
  "DELETE /api/v1/projects/:id",
  "GET /api/v1/projects/:id/members",
  "POST /api/v1/projects/:id/members",
  "GET /api/v1/projects/:id/documents",
  "GET /api/v1/projects/:id/building-schematic",
  "GET /api/v1/projects/:id/stages",
  "POST /api/v1/projects/:id/stages/:stageId/retry-anchor",
  "GET /api/v1/projects/:id/stages/:stageId",
  "GET /api/v1/evidence/:id",
  "GET /api/v1/evidence/:id/download",
  "PATCH /api/v1/evidence/:id",
  "POST /api/v1/evidence/reconcile",
  "POST /api/v1/evidence/:id/anchor",
  "DELETE /api/v1/evidence/:id",
  "GET /api/v1/evidence/:bundleId/proof/:fileHash",
  "GET /api/v1/evidence/:bundleId/files",
  "GET /api/v1/users",
  "POST /api/v1/users",
  "GET /api/v1/users/:id",
  "PATCH /api/v1/users/:id",
  "DELETE /api/v1/users/:id",
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
  "GET /api/v1/investor/units/:id/dossier/export.pdf",
  "GET /api/v1/developer/projects",
  "GET /api/v1/developer/projects/:id",
  "POST /api/v1/developer/projects",
  "GET /api/v1/developer/progress",
  "GET /api/v1/developer/documents",
  "GET /api/v1/developer/audit-log",
  "POST /api/v1/developer/documents",
  "GET /api/v1/developer/kpis",
  "GET /api/v1/developer/projects/:id/units",
  "POST /api/v1/developer/projects/:id/units",
  "PATCH /api/v1/developer/units/:id",
  "GET /api/v1/developer/units",
  "POST /api/v1/developer/projects/:id/invitations",
  "GET /api/v1/developer/projects/:id/contracts",
  "POST /api/v1/developer/contracts/:id/releases/:stageNum",
  "GET /api/v1/developer/capital/summary",
  "GET /api/v1/developer/capital/monthly",
  "GET /api/v1/developer/capital/by-project",
  "GET /api/v1/developer/investors"
]);

export async function buildOpenApiDocument() {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const { rutas, handlers } of leerMontaje()) {
    for (const [clave, guards] of rutas) {
      if (ORPC_MIGRADAS.has(clave)) continue;

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
        description:
          guards.map(describeGuardEn).join(" + ") || "No session required — public (M2-D5 §2.2)",
        ...(requestParams && { requestParams }),
        ...(entrada?.body && {
          requestBody: {
            content: { [entrada.bodyContentType ?? "application/json"]: { schema: entrada.body } }
          }
        }),
        ...(autenticado && { security: [{ bearerAuth: [] }] }),
        responses: {
          [exito]: {
            description: exito === "204" ? "No Content" : "OK",
            ...(RESPONSE_SCHEMAS[clave] && {
              content: { "application/json": { schema: RESPONSE_SCHEMAS[clave] } }
            })
          },
          ...(entrada && {
            "400": {
              description: "Body or query failed schema validation",
              content: { "application/json": { schema: zodErrorSchema } }
            }
          }),
          ...(autenticado && {
            "401": { description: "No session or invalid token" },
            "403": { description: "Insufficient role or project membership" }
          })
        }
      };
    }
  }

  const generadorOrpc = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
  });

  const documentoAuth = await generadorOrpc.generate(
    os.$context<AuthContext>().prefix("/api/v1/auth").router(authOrpcRouter),
    {
      info: { title: "PropNexus API — auth (oRPC)", version: "1.0.0" }
    }
  );
  Object.assign(paths, documentoAuth.paths);

  const documentoPublic = await generadorOrpc.generate(
    os.prefix("/api/v1/public").router(publicOrpcRouter),
    {
      info: { title: "PropNexus API — public (oRPC)", version: "1.0.0" }
    }
  );
  Object.assign(paths, documentoPublic.paths);

  const documentoProfile = await generadorOrpc.generate(
    os.$context<ProfileContext>().prefix("/api/v1/profile").router(profileOrpcRouter),
    {
      info: { title: "PropNexus API — profile (oRPC)", version: "1.0.0" }
    }
  );
  Object.assign(paths, documentoProfile.paths);

  const documentoNotifications = await generadorOrpc.generate(
    os
      .$context<NotificationsContext>()
      .prefix("/api/v1/notifications")
      .router(notificationsOrpcRouter),
    {
      info: { title: "PropNexus API — notifications (oRPC)", version: "1.0.0" }
    }
  );
  Object.assign(paths, documentoNotifications.paths);

  const documentoAudit = await generadorOrpc.generate(
    os.prefix("/api/v1/audit-logs").router(auditOrpcRouter),
    {
      info: { title: "PropNexus API — audit (oRPC)", version: "1.0.0" }
    }
  );
  Object.assign(paths, documentoAudit.paths);

  const documentoContracts = await generadorOrpc.generate(
    os.prefix("/api/v1/contracts").router(contractsOrpcRouter),
    {
      info: { title: "PropNexus API — contracts (oRPC)", version: "1.0.0" }
    }
  );
  Object.assign(paths, documentoContracts.paths);

  const documentoStages = await generadorOrpc.generate(
    os.$context<StagesContext>().prefix("/api/v1/stages").router(stagesOrpcRouter),
    {
      info: { title: "PropNexus API — stages (oRPC)", version: "1.0.0" }
    }
  );
  Object.assign(paths, documentoStages.paths);

  const documentoProjects = await generadorOrpc.generate(
    os.$context<ProjectsContext>().prefix("/api/v1/projects").router(projectsOrpcRouter),
    {
      info: { title: "PropNexus API — projects (oRPC)", version: "1.0.0" }
    }
  );
  Object.assign(paths, documentoProjects.paths);

  const documentoProjectsObra = await generadorOrpc.generate(
    os.$context<ProjectsObraContext>().prefix("/api/v1/projects").router(projectsObraOrpcRouter),
    {
      info: { title: "PropNexus API — projects-obra (oRPC)", version: "1.0.0" }
    }
  );
  Object.assign(paths, documentoProjectsObra.paths);

  const documentoEvidence = await generadorOrpc.generate(
    os.$context<EvidenceContext>().prefix("/api/v1/evidence").router(evidenceOrpcRouter),
    {
      info: { title: "PropNexus API — evidence (oRPC)", version: "1.0.0" }
    }
  );
  Object.assign(paths, documentoEvidence.paths);

  const documentoUsers = await generadorOrpc.generate(
    os.$context<UsersContext>().prefix("/api/v1/users").router(usersOrpcRouter),
    {
      info: { title: "PropNexus API — users (oRPC)", version: "1.0.0" }
    }
  );
  Object.assign(paths, documentoUsers.paths);

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

  const documentoDeveloper = await generadorOrpc.generate(
    os.$context<DeveloperContext>().prefix("/api/v1/developer").router(developerOrpcRouter),
    {
      info: { title: "PropNexus API — developer (oRPC)", version: "1.0.0" }
    }
  );
  Object.assign(paths, documentoDeveloper.paths);

  const documentoDeveloperComercial = await generadorOrpc.generate(
    os
      .$context<DeveloperContext>()
      .prefix("/api/v1/developer")
      .router(developerComercialOrpcRouter),
    {
      info: { title: "PropNexus API — developer comercial (oRPC)", version: "1.0.0" }
    }
  );
  Object.assign(paths, documentoDeveloperComercial.paths);

  const documentoCapital = await generadorOrpc.generate(
    os.$context<DeveloperContext>().prefix("/api/v1/developer").router(capitalOrpcRouter),
    {
      info: { title: "PropNexus API — capital (oRPC)", version: "1.0.0" }
    }
  );
  Object.assign(paths, documentoCapital.paths);

  return createDocument({
    openapi: "3.1.0",
    info: {
      title: "PropNexus API",
      version: "1.0.0",
      description:
        "Generated from the mounted router (`pnpm --filter @plataforma/api docs:openapi`), " +
        "not maintained by hand — see apps/api/scripts/generate-openapi.ts. The success code " +
        "is read from the handler's actual `res.status(2xx)` (the creation code when the " +
        "handler has more than one, the idempotent case). Bodies, queries and 76 of the 85 " +
        "success responses are the real Zod schema, validated at runtime before responding — " +
        "the remaining 9 legitimately have no JSON body (`204 No Content` or a binary file)."
    },
    servers: [{ url: "http://localhost:8787", description: "Local (pnpm dev)" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
      }
    },
    paths
  });
}

// El vivo. El de `specs/evidencia-m3/2-api/` es la foto de M3 y no se regenera (D-103).
export const ARCHIVO_OPENAPI = path.join(
  import.meta.dirname,
  "..",
  "api-docs",
  "propnexus.openapi.json"
);

async function main() {
  const archivo = ARCHIVO_OPENAPI;
  mkdirSync(path.dirname(archivo), { recursive: true });
  writeFileSync(archivo, `${JSON.stringify(await buildOpenApiDocument(), null, 2)}\n`);
  console.log(`[docs:openapi] escrito ${archivo}`);
}

if (esPuntoDeEntrada(import.meta.url)) main();
