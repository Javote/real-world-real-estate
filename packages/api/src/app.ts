import dotenv from "dotenv";
dotenv.config();

import express from "express";
import authRoutes from "./routes/auth.routes";
import usersRoutes from "./routes/users.routes";
import projectsRoutes from "./routes/projects.routes";
import milestonesRoutes from "./routes/milestones.routes";
import evidenceRoutes from "./routes/evidence.routes";
import auditRoutes from "./routes/audit.routes";
import { errorHandler } from "./middlewares/errorHandler";
import { trustProxyHops } from "./middlewares/rateLimit";

const app = express();

// De cuántos saltos de proxy sale la IP del cliente. Tiene que estar ANTES de
// cualquier limiter: es lo que decide qué IP se usa como clave. Ver D-045.
app.set("trust proxy", trustProxyHops());

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/projects", projectsRoutes);
app.use("/api/v1", milestonesRoutes);
app.use("/api/v1", evidenceRoutes);
app.use("/api/v1/audit-logs", auditRoutes);

app.use(errorHandler);

export default app;
