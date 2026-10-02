import "dotenv/config";

import express from "express";
import helmet from "helmet";
import { Sentry } from "./instrumentation";
import { db } from "./lib/db";
import { statusDeError } from "./lib/error-status";
import { sql } from "./lib/kysely";
import { errorHandler } from "./middlewares/errorHandler";
import { trustProxyHops } from "./middlewares/rateLimit";
import auditRoutes from "./routes/audit.routes";
import authRoutes from "./routes/auth.routes";
import capitalRoutes from "./routes/capital.routes";
import certifierRoutes from "./routes/certifier.routes";
import contractsRoutes from "./routes/contracts.routes";
import developerRoutes from "./routes/developer.routes";
import developerComercialRoutes from "./routes/developer-comercial.routes";
import developerEvidenciaRoutes from "./routes/developer-evidencia.routes";
import evidenceRoutes from "./routes/evidence.routes";
import investorRoutes from "./routes/investor.routes";
import notaryRoutes from "./routes/notary.routes";
import notificationsRoutes from "./routes/notifications.routes";
import profileRoutes from "./routes/profile.routes";
import projectCoverRoutes from "./routes/project-cover.routes";
import projectsRoutes from "./routes/projects.routes";
import projectsObraRoutes from "./routes/projects-obra.routes";
import publicRoutes from "./routes/public.routes";
import stagesRoutes from "./routes/stages.routes";
import usersRoutes from "./routes/users.routes";

const app = express();

app.set("trust proxy", trustProxyHops());

app.use(helmet());

app.disable("x-powered-by");

const origenesPermitidos = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origen = req.headers.origin;

  if (origen && origenesPermitidos.includes(origen)) {
    // nosemgrep: javascript.express.security.cors-misconfiguration.cors-misconfiguration
    res.setHeader("Access-Control-Allow-Origin", origen);
    res.setHeader("Vary", "Origin");
    // `curl` no hace preflight: un método que falte acá solo falla en el navegador.
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
  }

  if (req.method === "OPTIONS") return res.sendStatus(204);

  return next();
});

app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await sql`select 1`.execute(db);
    return res.json({ ok: true });
  } catch (error) {
    console.error("[health] la base no responde", error);
    return res.status(503).json({ ok: false, message: "Database unavailable" });
  }
});

// El orden es semántico: dos routers con el mismo prefijo comparten pipeline, y el test de guards lee esta tabla.
export const MONTAJE = [
  { prefijo: "/api/v1/auth", router: authRoutes },
  { prefijo: "/api/v1/users", router: usersRoutes },
  { prefijo: "/api/v1/projects", router: projectsRoutes },
  { prefijo: "/api/v1/projects", router: projectsObraRoutes },
  { prefijo: "/api/v1/stages", router: stagesRoutes },
  { prefijo: "/api/v1/evidence", router: evidenceRoutes },
  { prefijo: "/api/v1/contracts", router: contractsRoutes },
  { prefijo: "/api/v1/notifications", router: notificationsRoutes },
  { prefijo: "/api/v1/profile", router: profileRoutes },
  { prefijo: "/api/v1/audit-logs", router: auditRoutes },
  { prefijo: "/api/v1/public", router: publicRoutes },
  { prefijo: "/api/v1/investor", router: investorRoutes },
  { prefijo: "/api/v1/developer", router: developerRoutes },
  { prefijo: "/api/v1/developer", router: developerComercialRoutes },
  { prefijo: "/api/v1/developer", router: developerEvidenciaRoutes },
  { prefijo: "/api/v1/developer", router: capitalRoutes },
  { prefijo: "/api/v1/developer", router: projectCoverRoutes },
  { prefijo: "/api/v1/notary", router: notaryRoutes },
  { prefijo: "/api/v1/certifier", router: certifierRoutes }
] as const;

for (const { prefijo, router } of MONTAJE) {
  app.use(prefijo, router);
}

// Antes de `errorHandler`, para ver el error crudo; por eso la misma clasificación por status.
Sentry.setupExpressErrorHandler(app, {
  shouldHandleError: (err) => statusDeError(err) >= 500
});

app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use(errorHandler);

export default app;
