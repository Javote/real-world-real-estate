// `import "dotenv/config"` (no `import dotenv from "dotenv"; dotenv.config();`
// intercalado): TypeScript hoistea TODOS los `import` al principio del
// archivo compilado, en orden de declaración, así que un `dotenv.config()`
// escrito entre dos imports corre DESPUÉS de que ya se resolvieron — acá,
// después de `./routes/auth.routes`, que carga `lib/jwt.ts` y explota antes de
// que `JWT_SECRET` exista en `process.env`. El import de efecto secundario
// ejecuta `config()` en su propia posición hoisteada, que es lo que hace falta
// que corra primero. Mismo patrón que `db/migrate.ts` y `db/seed.ts`.
import "dotenv/config";

import express from "express";
import helmet from "helmet";
import { db } from "./lib/db";
import { sql } from "./lib/kysely";
import { errorHandler } from "./middlewares/errorHandler";
import { trustProxyHops } from "./middlewares/rateLimit";
import auditRoutes from "./routes/audit.routes";
import authRoutes from "./routes/auth.routes";
import evidenceRoutes from "./routes/evidence.routes";
import milestonesRoutes from "./routes/milestones.routes";
import projectsRoutes from "./routes/projects.routes";
import usersRoutes from "./routes/users.routes";

const app = express();

// De cuántos saltos de proxy sale la IP del cliente. Tiene que estar ANTES de
// cualquier limiter: es lo que decide qué IP se usa como clave. Ver D-045.
app.set("trust proxy", trustProxyHops());

// Esta API contesta JSON, nunca HTML, así que la mayoría de las cabeceras de
// helmet (CSP, frame options) protegen algo que no existe acá. Se deja el set
// completo igual: no cuesta nada, y las que sí importan —`nosniff`, HSTS,
// `Referrer-Policy`— quedan puestas sin tener que acordarse de cuáles eran.
app.use(helmet());

// Anunciar el framework y su versión no ayuda a nadie salvo a quien busca un
// exploit conocido. helmet ya lo saca; esto lo deja explícito y a prueba de que
// alguien cambie la config de helmet sin darse cuenta.
app.disable("x-powered-by");

app.use(express.json());

/**
 * Healthcheck. **Consulta la base a propósito.**
 *
 * Antes devolvía `{ok:true}` sin tocar nada, así que Render daba el servicio por
 * sano mientras cada request fallaba por una `DATABASE_URL` mal cargada o una
 * base inalcanzable — que es exactamente el modo de falla que un healthcheck
 * existe para detectar, y el más probable en el primer deploy.
 *
 * Un `SELECT 1` contra Turso es una lectura por chequeo: irrelevante contra los
 * 500M/mes del plan gratuito (D-040).
 */
app.get("/health", async (_req, res) => {
  try {
    await sql`select 1`.execute(db);
    return res.json({ ok: true });
  } catch (error) {
    console.error("[health] la base no responde", error);
    return res.status(503).json({ ok: false, message: "Database unavailable" });
  }
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/projects", projectsRoutes);
app.use("/api/v1", milestonesRoutes);
app.use("/api/v1", evidenceRoutes);
app.use("/api/v1/audit-logs", auditRoutes);

// Una ruta que no existe tiene que contestar JSON como todo el resto: sin esto,
// Express devuelve su página HTML por defecto, que además anuncia el framework.
// Va después de todas las rutas y antes del errorHandler.
app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use(errorHandler);

export default app;
