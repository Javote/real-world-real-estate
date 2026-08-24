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
import capitalRoutes from "./routes/capital.routes";
import certifierRoutes from "./routes/certifier.routes";
import contractsRoutes from "./routes/contracts.routes";
import developerRoutes from "./routes/developer.routes";
import dossierRoutes from "./routes/dossier.routes";
import evidenceRoutes from "./routes/evidence.routes";
import favoritesRoutes from "./routes/favorites.routes";
import invitationsRoutes from "./routes/invitations.routes";
import notaryRoutes from "./routes/notary.routes";
import notificationsRoutes from "./routes/notifications.routes";
import panelsRoutes from "./routes/panels.routes";
import profileRoutes from "./routes/profile.routes";
import projectsRoutes from "./routes/projects.routes";
import stagesRoutes from "./routes/stages.routes";
import unitsRoutes from "./routes/units.routes";
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

// CORS, y por qué recién ahora: hasta D-065 el web era un servicio SSR que
// proxeaba `/api` desde su propio origen, así que el browser nunca hacía una
// request cross-origin. Como SPA estática, el web vive en otro origen y manda
// `Authorization: Bearer` — una cabecera no simple, o sea preflight, o sea CORS.
//
// **Lista blanca explícita, nunca `*`.** `WEB_ORIGIN` acepta orígenes separados
// por coma; en local el default cubre el puerto del dev server. Un origen que no
// esté en la lista no recibe cabecera y el browser corta: es el
// comportamiento correcto, no un error a "arreglar" con un comodín.
//
// `credentials` queda en false a propósito: la sesión viaja en el header, no en
// cookies (D-050 ya nos costó una tarde por asumir lo contrario).
const origenesPermitidos = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origen = req.headers.origin;

  if (origen && origenesPermitidos.includes(origen)) {
    res.setHeader("Access-Control-Allow-Origin", origen);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
  }

  // El preflight no lleva token ni body: se contesta y se corta acá.
  if (req.method === "OPTIONS") return res.sendStatus(204);

  return next();
});

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
// **Primero de todos los `/api/v1`, y por la misma razón que el bloque de
// abajo:** `GET /public/dossier/:token` es uno de los dos endpoints sin sesión
// del backlog (M2-D5 §2.2), y casi todos los routers que siguen tienen un
// `router.use(authenticate)` que contesta 401 a cualquier request que les
// entre, matcheen o no. Montado más abajo, el link público que un investor le
// pasa a un notario sin cuenta devolvía 401.
app.use("/api/v1", dossierRoutes);

app.use("/api/v1", stagesRoutes);
app.use("/api/v1", evidenceRoutes);
app.use("/api/v1", certifierRoutes);
app.use("/api/v1", unitsRoutes);
app.use("/api/v1", invitationsRoutes);
app.use("/api/v1", contractsRoutes);
app.use("/api/v1", notificationsRoutes);
app.use("/api/v1", favoritesRoutes);
app.use("/api/v1", profileRoutes);

// **Los paneles ANTES que los routers con prefijo propio, y no es cosmético.**
// `/notary/dossiers/pending` (panel) y `/notary/dossiers/:id` (notaryRoutes)
// comparten forma: montado al revés, `:id` matchea `"pending"` y la cola de
// revisión devuelve 404.
app.use("/api/v1", panelsRoutes);

// **Estos tres van montados bajo SU prefijo, no bajo `/api/v1` pelado.**
//
// Los tres tienen un `router.use(requireRole(...))` a nivel de router, y un
// middleware de router corre para TODA request que entra al router — no solo
// para las que matchean alguna de sus rutas. Montados en `/api/v1`, el guard
// del developer contestaba 403 a `GET /api/v1/investor/favorites` de un buyer
// antes de que ese router siquiera se consultara: el rol global de OTRA
// superficie cortaba la request. No lo vio nadie porque la suite no tenía
// ningún fixture activo que no fuera developer o admin.
//
// Con el prefijo, el guard solo alcanza lo que el router realmente sirve. La
// alternativa —bajar el guard a cada ruta— deja la puerta abierta a que una
// ruta nueva se olvide de ponerlo, que es exactamente lo que D-042 evita.
app.use("/api/v1/developer", developerRoutes);
app.use("/api/v1/developer", capitalRoutes);
app.use("/api/v1/notary", notaryRoutes);
app.use("/api/v1/audit-logs", auditRoutes);

// Una ruta que no existe tiene que contestar JSON como todo el resto: sin esto,
// Express devuelve su página HTML por defecto, que además anuncia el framework.
// Va después de todas las rutas y antes del errorHandler.
app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use(errorHandler);

export default app;
