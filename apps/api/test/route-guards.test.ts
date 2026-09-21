import { afterAll, describe, expect, it } from "vitest";
import { db } from "../src/lib/db";
import { describir, leerMontaje, matrizViva, ramas } from "../src/lib/route-inventory";
import type { ReglaDeAcceso } from "../src/middlewares/auth";

afterAll(async () => {
  await db.destroy();
});

/**
 * La matriz de permisos, reconstruida del router ya montado.
 *
 * **Por qué existe.** La segunda capa (regla 5) tiene forma que no compila si te
 * la olvidás —`allowedMemberships` es obligatorio (D-042)— pero eso solo protege
 * a quien la escribe: nada obliga a *poner* el middleware. Los dos agujeros de
 * septiembre son el mismo modo de falla — `GET /evidence/:bundleId/files` sin
 * `requireProjectAccess`, y `POST /users` con su propio enum de roles — y los dos
 * los encontró una auditoría a mano, no una herramienta, porque no había ninguna.
 *
 * **Qué asienta y qué no.** Asienta los guards **declarados**: los que se leen en
 * la firma de la ruta. No prueba que la autorización sea correcta ni completa —
 * varias rutas autorizan adentro del handler (`contracts.routes.ts` llama a
 * `projectScope` a mano, `investor` compara `investorId` contra `req.user.id`) y
 * acá figuran como si solo tuvieran sesión. Esa diferencia es visible a propósito:
 * la columna de guards de esas rutas es corta, y esa es justamente la lista de
 * candidatas a subir a la firma.
 *
 * **Por qué no es el escáner que borró D-053.** Aquel grepeaba el fuente y
 * adivinaba; este interroga al router que Express armó de verdad, con los
 * middlewares que realmente van a correr. Es evidencia, no heurística sobre texto.
 */
const MATRIZ: Record<string, string> = {
  "POST /api/v1/auth/login": "—",
  "GET /api/v1/auth/me":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · scope(User.id = usuario))",
  "GET /api/v1/users": "auth + autoriza(rol(admin) · soloRol)",
  "POST /api/v1/users": "auth + autoriza(rol(admin) · soloRol)",
  "GET /api/v1/users/:id": "auth + autoriza(rol(admin) · soloRol)",
  "PATCH /api/v1/users/:id": "auth + autoriza(rol(admin) · soloRol)",
  "DELETE /api/v1/users/:id": "auth + autoriza(rol(admin) · soloRol)",
  "GET /api/v1/projects":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · scope(projectScope(cualquier membresía)))",
  "POST /api/v1/projects": "auth + autoriza(rol(admin) · soloRol)",
  "GET /api/v1/projects/:id":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · proyecto(id → developer|buyer|verifier))",
  "PATCH /api/v1/projects/:id": "auth + autoriza(rol(admin) · soloRol)",
  "DELETE /api/v1/projects/:id": "auth + autoriza(rol(admin) · soloRol)",
  "GET /api/v1/projects/:id/members":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · proyecto(id → developer|buyer|verifier))",
  "POST /api/v1/projects/:id/members": "auth + autoriza(rol(admin) · soloRol)",
  "GET /api/v1/projects/:id/documents":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · proyecto(id → developer|buyer|verifier))",
  "GET /api/v1/projects/:id/building-schematic":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · proyecto(id → developer|buyer|verifier))",
  // SPEC-220 · el perfil de la organización desarrolladora (capturas 59-60).
  // Cualquier miembro del proyecto lo ve: es información del desarrollador de
  // una obra en la que ya participa, no un directorio público.
  "GET /api/v1/projects/:id/developer":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · proyecto(id → developer|buyer|verifier))",
  "GET /api/v1/projects/:id/stages":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · proyecto(id → developer|buyer|verifier))",
  "POST /api/v1/projects/:id/stages/:stageId/retry-anchor":
    "auth + autoriza(rol(admin) · proyecto(id → developer|buyer|verifier))",
  "GET /api/v1/projects/:id/stages/:stageId":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · proyecto(id → developer|buyer|verifier))",
  "GET /api/v1/stages/:id":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · proyecto(Stage:id → developer|buyer|verifier))",
  "PATCH /api/v1/stages/:id":
    "auth + autoriza(rol(admin|developer) · proyecto(Stage:id → developer))",
  "PATCH /api/v1/stages/:id/state":
    "auth + autoriza(rol(admin|developer) · proyecto(Stage:id → developer))",
  "GET /api/v1/evidence/:id":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · proyecto(Evidence:id → developer|buyer|verifier))",
  "GET /api/v1/evidence/:id/download":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · proyecto(Evidence:id → developer|buyer|verifier))",
  "PATCH /api/v1/evidence/:id":
    "auth + autoriza(rol(admin|developer) · proyecto(Evidence:id → developer))",
  "POST /api/v1/evidence/reconcile": "auth + autoriza(rol(admin) · soloRol)",
  "POST /api/v1/evidence/:id/anchor":
    "auth + autoriza(rol(admin) · proyecto(Evidence:id → developer|buyer|verifier))",
  "DELETE /api/v1/evidence/:id": "auth + autoriza(rol(admin) · soloRol)",
  "GET /api/v1/evidence/:bundleId/proof/:fileHash":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · proyecto(EvidenceBundle:bundleId → developer|buyer|verifier))",
  "GET /api/v1/evidence/:bundleId/files":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · proyecto(EvidenceBundle:bundleId → developer|buyer|verifier))",
  "GET /api/v1/contracts/:contractId/releases":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · alguna[dueño(Contract:contractId) | proyecto(Contract:contractId → developer|buyer|verifier)])",
  "GET /api/v1/notifications/unread-count":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · scope(Notification.userId = usuario))",
  "PATCH /api/v1/notifications/:id/read":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · scope(Notification.userId = usuario))",
  "GET /api/v1/profile":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · scope(User.id = usuario))",
  "PATCH /api/v1/profile":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · scope(User.id = usuario))",
  "PATCH /api/v1/profile/notifications":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · scope(User.id = usuario))",
  "GET /api/v1/audit-logs": "auth + autoriza(rol(admin) · soloRol)",
  "GET /api/v1/audit-logs/telemetry/reservation-to-escrow": "auth + autoriza(rol(admin) · soloRol)",
  "GET /api/v1/public/dossier/:shareToken": "—",
  "GET /api/v1/investor/favorites":
    "auth + autoriza(rol(admin|buyer) · scope(Favorite.userId = usuario))",
  "POST /api/v1/investor/favorites/:projectId": "auth + autoriza(rol(admin|buyer) · soloRol)",
  "DELETE /api/v1/investor/favorites/:projectId":
    "auth + autoriza(rol(admin|buyer) · scope(Favorite.userId = usuario))",
  "GET /api/v1/investor/units":
    "auth + autoriza(rol(admin|buyer) · scope(Unit.investorId = usuario))",
  "GET /api/v1/investor/units/:id": "auth + autoriza(rol(admin|buyer) · dueño(Unit:id))",
  "GET /api/v1/investor/units/:id/news": "auth + autoriza(rol(admin|buyer) · dueño(Unit:id))",
  "GET /api/v1/investor/units/:id/dossier": "auth + autoriza(rol(admin|buyer) · dueño(Unit:id))",
  "GET /api/v1/investor/units/:id/dossier/export.pdf":
    "auth + autoriza(rol(admin|buyer) · dueño(Unit:id))",
  "POST /api/v1/investor/units/:id/dossier/share":
    "auth + autoriza(rol(admin|buyer) · dueño(Unit:id))",
  "GET /api/v1/investor/notifications":
    "auth + autoriza(rol(admin|buyer) · scope(Notification.userId = usuario))",
  "GET /api/v1/investor/invitations/:id":
    "auth + autoriza(rol(admin|buyer) · dueño(Invitation:id))",
  "POST /api/v1/investor/invitations/:id/accept":
    "auth + autoriza(rol(admin|buyer) · dueño(Invitation:id))",
  "POST /api/v1/investor/invitations/:id/decline":
    "auth + autoriza(rol(admin|buyer) · dueño(Invitation:id))",
  "GET /api/v1/investor/contracts/:unitId":
    "auth + autoriza(rol(admin|buyer) · dueño(ContractOfUnit:unitId))",
  "GET /api/v1/developer/projects":
    "auth + autoriza(rol(admin|developer) · scope(projectScope(developer)))",
  "GET /api/v1/developer/projects/:id":
    "auth + autoriza(rol(admin|developer) · proyecto(id → developer))",
  "POST /api/v1/developer/projects": "auth + autoriza(rol(admin|developer) · soloRol)",
  "GET /api/v1/developer/progress":
    "auth + autoriza(rol(admin|developer) · scope(projectScope(developer)))",
  "GET /api/v1/developer/documents":
    "auth + autoriza(rol(admin|developer) · scope(projectScope(developer)))",
  "GET /api/v1/developer/audit-log":
    "auth + autoriza(rol(admin|developer) · scope(auditScope(developer)))",
  "POST /api/v1/developer/documents":
    "auth + autoriza(rol(admin|developer) · proyecto(Evidence:evidenceId@body → developer))",
  "GET /api/v1/developer/kpis":
    "auth + autoriza(rol(admin|developer) · scope(projectScope(cualquier membresía)))",
  "GET /api/v1/developer/projects/:id/units":
    "auth + autoriza(rol(admin|developer) · proyecto(id → developer))",
  "POST /api/v1/developer/projects/:id/units":
    "auth + autoriza(rol(admin|developer) · proyecto(id → developer))",
  "PATCH /api/v1/developer/units/:id":
    "auth + autoriza(rol(admin|developer) · proyecto(Unit:id → developer))",
  "GET /api/v1/developer/units":
    "auth + autoriza(rol(admin|developer) · scope(projectScope(developer)))",
  "POST /api/v1/developer/projects/:id/invitations":
    "auth + autoriza(rol(admin|developer) · proyecto(id → developer))",
  "GET /api/v1/developer/projects/:id/contracts":
    "auth + autoriza(rol(admin|developer) · proyecto(id → developer))",
  "POST /api/v1/developer/contracts/:id/releases/:stageNum":
    "auth + autoriza(rol(admin|developer) · proyecto(Contract:id → developer))",
  "POST /api/v1/developer/projects/:id/stages/:stageId/evidence":
    "auth + autoriza(rol(admin|developer) · proyecto(id → developer))",
  "GET /api/v1/developer/capital/summary":
    "auth + autoriza(rol(admin|developer) · scope(projectScope(developer)))",
  "GET /api/v1/developer/capital/monthly":
    "auth + autoriza(rol(admin|developer) · scope(projectScope(developer)))",
  "GET /api/v1/developer/capital/by-project":
    "auth + autoriza(rol(admin|developer) · scope(projectScope(developer)))",
  "GET /api/v1/developer/investors":
    "auth + autoriza(rol(admin|developer) · scope(projectScope(developer)))",
  "GET /api/v1/notary/kpis":
    "auth + autoriza(rol(admin|notary) · scope(Dossier.signedById = usuario))",
  "GET /api/v1/notary/dossiers/pending": "auth + autoriza(rol(admin|notary) · soloRol)",
  "GET /api/v1/notary/dossiers/:id": "auth + autoriza(rol(admin|notary) · soloRol)",
  "POST /api/v1/notary/dossiers/:id/sign": "auth + autoriza(rol(admin|notary) · soloRol)",
  "POST /api/v1/notary/dossiers/:id/reject": "auth + autoriza(rol(admin|notary) · soloRol)",
  "GET /api/v1/notary/signatures":
    "auth + autoriza(rol(admin|notary) · scope(Dossier.signedById = usuario))",
  "GET /api/v1/certifier/kpis":
    "auth + autoriza(rol(admin|verifier) · scope(projectScope(cualquier membresía)))",
  "GET /api/v1/certifier/assignments":
    "auth + autoriza(rol(admin|verifier) · scope(projectScope(cualquier membresía)))",
  "GET /api/v1/certifier/stages/:id":
    "auth + autoriza(rol(admin|verifier) · proyecto(Stage:id → verifier))",
  "POST /api/v1/certifier/stages/:id/certify":
    "auth + autoriza(rol(admin|verifier) · proyecto(Stage:id → verifier))",
  "POST /api/v1/certifier/stages/:id/observe":
    "auth + autoriza(rol(admin|verifier) · proyecto(Stage:id → verifier))",
  "GET /api/v1/certifier/certificates":
    "auth + autoriza(rol(admin|verifier) · scope(Stage.certifiedById = usuario))"
};

/**
 * Las dos únicas rutas sin sesión del backlog (M2-D5 §2.2): el login, y el link
 * público del dossier, que existe para que alguien de afuera verifique sin cuenta.
 * Cualquier tercera es un olvido hasta que se agregue acá a mano.
 */
const SIN_SESION = new Set(["POST /api/v1/auth/login", "GET /api/v1/public/dossier/:shareToken"]);

// La introspección del router (`leerMontaje`, `describir`, `matrizViva`) vive
// en `src/lib/route-inventory.ts` — la comparte `scripts/generate-api-docs.ts`
// (M3 §2, "endpoints documentados") para no leer el árbol de Express dos veces.

describe("la matriz de permisos de las rutas montadas", () => {
  it("es exactamente la declarada — una ruta nueva no entra sin pasar por acá", () => {
    // Si este test se pone rojo por una ruta que agregaste: el diff de vitest
    // dice la clave y los guards que Express ve. Copiala a MATRIZ **después** de
    // mirar si los guards son los que querías, no antes. Ese vistazo es el punto
    // del test: es la revisión, y el commit es dónde queda registrada.
    expect(matrizViva()).toEqual(MATRIZ);
  });

  it("toda ruta exige sesión, salvo las dos declaradas sin ella", () => {
    const sinAuth = Object.entries(matrizViva())
      .filter(([, guards]) => !guards.includes("auth"))
      .map(([clave]) => clave);

    expect(new Set(sinAuth)).toEqual(SIN_SESION);
  });

  it("no hay listas de roles ni de membresías vacías", () => {
    // Una lista vacía no es "cualquiera": `authorize` con `roles: []` rechaza a
    // todos y `projectScope` con `[]` deniega todo. Es fail-closed, así que no
    // abre nada — pero es una ruta muerta que contesta 403 a todo el mundo, y
    // eso siempre es un error de tipeo, nunca una intención. Se recorre el árbol
    // de `acceso` entero: una rama vacía adentro de un `alguna` es igual de
    // muerta y bastante más difícil de ver leyendo.
    const membresiasVacias = (acceso: ReglaDeAcceso): boolean =>
      ramas(acceso).some(
        (regla) => regla !== "soloRol" && "proyecto" in regla && regla.membresias.length === 0
      );

    const vacias: string[] = [];
    for (const { rutas } of leerMontaje()) {
      for (const [clave, guards] of rutas) {
        for (const guard of guards) {
          if (guard.kind !== "authorize") continue;
          if (guard.roles.length === 0) vacias.push(`${clave} · rol`);
          if (membresiasVacias(guard.acceso)) vacias.push(`${clave} · proyecto`);
        }
      }
    }

    expect(vacias).toEqual([]);
  });

  it("toda ruta con `scopeEnQuery` nombra el filtro que aplica", () => {
    // El punto entero de la partición. `scopeEnQuery` sin texto sería
    // `"soloRol"` con otro nombre: la etiqueta volvería a poder decir "acá no
    // hay nada que mirar". Con el filtro escrito, la afirmación es concreta y
    // se puede contrastar contra el `where` del handler de al lado — no lo
    // verifica el compilador, pero deja de ser una casilla vacía.
    const sinNombrar: string[] = [];

    const enBlanco = (acceso: ReglaDeAcceso): boolean =>
      ramas(acceso).some(
        (regla) =>
          regla !== "soloRol" && "scopeEnQuery" in regla && regla.scopeEnQuery.trim().length === 0
      );

    for (const { rutas } of leerMontaje()) {
      for (const [clave, guards] of rutas) {
        for (const guard of guards) {
          if (guard.kind === "authorize" && enBlanco(guard.acceso)) sinNombrar.push(clave);
        }
      }
    }

    expect(sinNombrar).toEqual([]);
  });
});

describe("los routers que comparten prefijo", () => {
  it("declaran los mismos guards a nivel de router", () => {
    // El bug del 2026-08-24, como invariante. Una request que va al segundo
    // router entra igual por el primero —`router.use(guard)` corre para toda
    // request que le llega, matcheen o no sus rutas—, así que un guard más
    // estricto en el primero contesta por el segundo antes de que exista. Hoy
    // `/api/v1/developer` tiene cuatro routers y `/api/v1/projects` dos; que
    // coincidan es lo único que lo sostiene, y no hay nada que lo obligue.
    const porPrefijo = new Map<string, string[]>();
    for (const { prefijo, guardsDeRouter } of leerMontaje()) {
      const firma = guardsDeRouter.map(describir).join(" + ") || "—";
      porPrefijo.set(prefijo, [...(porPrefijo.get(prefijo) ?? []), firma]);
    }

    const divergentes = [...porPrefijo.entries()]
      .filter(([, firmas]) => new Set(firmas).size > 1)
      .map(([prefijo, firmas]) => `${prefijo}: ${[...new Set(firmas)].join("  ≠  ")}`);

    expect(divergentes).toEqual([]);
  });
});
