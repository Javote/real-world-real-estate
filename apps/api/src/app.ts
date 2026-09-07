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
import developerComercialRoutes from "./routes/developer-comercial.routes";
import developerEvidenciaRoutes from "./routes/developer-evidencia.routes";
import evidenceRoutes from "./routes/evidence.routes";
import investorRoutes from "./routes/investor.routes";
import notaryRoutes from "./routes/notary.routes";
import notificationsRoutes from "./routes/notifications.routes";
import profileRoutes from "./routes/profile.routes";
import projectsRoutes from "./routes/projects.routes";
import projectsObraRoutes from "./routes/projects-obra.routes";
import publicRoutes from "./routes/public.routes";
import stagesRoutes from "./routes/stages.routes";
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
    // Falso positivo de Semgrep: la regla ve `origen` (derivado de un header)
    // llegando a `Access-Control-Allow-Origin` sin ver el `if` de arriba, que
    // es exactamente la lista blanca explícita que la regla pide.
    // nosemgrep: javascript.express.security.cors-misconfiguration.cors-misconfiguration
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

// ── Montaje: UN PREFIJO POR ROUTER ─────────────────────────────────────────
//
// **El orden de este bloque no importa, y ese es el punto** (SPEC-015 §4).
//
// Antes casi todos los routers colgaban de `/api/v1` pelado y el orden era
// carga estructural: un `router.use(guard)` corre para TODA request que entra
// al router —matcheen o no sus rutas—, así que el
// `requireRole("admin","developer")` de la superficie del developer contestaba
// 403 a `GET /api/v1/investor/favorites` de un buyer antes de que el router de
// favoritos existiera para esa request. Lo mismo mataba con 401 el link público
// del dossier, que el backlog declara sin sesión.
//
// Con un prefijo propio, ningún router ve una request que no le pertenece y esa
// clase de bug no puede volver. El precio es agrupar por PREFIJO y no por
// concepto de dominio: la superficie del investor está junta aunque toque
// unidades, dossier, contratos e invitaciones. Está bien — es como agrupa
// M2-D5 §4-6, que es el contrato.
//
// **El montaje es un dato y no una secuencia de llamadas**, para que se pueda
// leer desde afuera: `test/route-guards.test.ts` lo recorre para reconstruir la
// matriz de permisos de las ~87 rutas montadas. Si esto fueran 22 `app.use(...)`
// sueltos, el test tendría que repetir los prefijos en su propia tabla y un
// cambio de prefijo acá lo dejaría auditando rutas que ya no existen, en
// silencio. Express 5 no conserva el path de montaje en el router (`Layer` lo
// compila a un matcher y lo tira), así que no hay forma de recuperarlo del otro
// lado — comprobado, no supuesto.
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
  // **Varios routers sobre el mismo prefijo, y no chocan**: sus paths son
  // disjuntos y ninguno tiene middleware catch-all que no le pertenezca. Se
  // mantienen separados por concern —el ciclo comercial, la subida anclada, el
  // capital— porque un solo archivo de 900 líneas por prefijo esconde las
  // costuras (SPEC-015 §6).
  //
  // Lo que sí importa y el test asienta: los que comparten prefijo tienen que
  // declarar los MISMOS guards a nivel de router. Una request que va al segundo
  // entra igual por el primero —un `router.use(guard)` corre para toda request
  // que le llega, matcheen o no sus rutas— así que un guard más estricto en el
  // primero contesta por el segundo antes de que exista.
  { prefijo: "/api/v1/developer", router: developerRoutes },
  { prefijo: "/api/v1/developer", router: developerComercialRoutes },
  { prefijo: "/api/v1/developer", router: developerEvidenciaRoutes },
  { prefijo: "/api/v1/developer", router: capitalRoutes },
  { prefijo: "/api/v1/notary", router: notaryRoutes },
  { prefijo: "/api/v1/certifier", router: certifierRoutes }
] as const;

for (const { prefijo, router } of MONTAJE) {
  app.use(prefijo, router);
}

// Una ruta que no existe tiene que contestar JSON como todo el resto: sin esto,
// Express devuelve su página HTML por defecto, que además anuncia el framework.
// Va después de todas las rutas y antes del errorHandler.
app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use(errorHandler);

export default app;
