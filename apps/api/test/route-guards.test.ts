import { afterAll, describe, expect, it } from "vitest";
import { MONTAJE } from "../src/app";
import { db } from "../src/lib/db";
import { type GuardDescriptor, leerGuard, type ReglaDeAcceso } from "../src/middlewares/auth";

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
  "GET /api/v1/auth/me": "auth",
  "GET /api/v1/users": "auth + rol(admin)",
  "POST /api/v1/users": "auth + rol(admin)",
  "GET /api/v1/users/:id": "auth + rol(admin)",
  "PATCH /api/v1/users/:id": "auth + rol(admin)",
  "DELETE /api/v1/users/:id": "auth + rol(admin)",
  "GET /api/v1/projects": "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · soloRol)",
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
  "GET /api/v1/projects/:id/stages":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · proyecto(id → developer|buyer|verifier))",
  "POST /api/v1/projects/:id/stages":
    "auth + autoriza(rol(admin|developer) · proyecto(id → developer))",
  "POST /api/v1/projects/:id/stages/:stageId/retry-anchor":
    "auth + autoriza(rol(admin) · proyecto(id → developer|buyer|verifier))",
  "GET /api/v1/projects/:id/stages/:stageId":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · proyecto(id → developer|buyer|verifier))",
  "GET /api/v1/projects/:id/evidence":
    "auth + autoriza(rol(admin|developer|buyer|verifier|notary) · proyecto(id → developer|buyer|verifier))",
  "POST /api/v1/projects/:id/evidence":
    "auth + autoriza(rol(admin|developer) · proyecto(id → developer))",
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
  "GET /api/v1/contracts/:contractId/releases": "auth",
  "GET /api/v1/notifications/unread-count": "auth",
  "PATCH /api/v1/notifications/:id/read": "auth",
  "GET /api/v1/profile": "auth",
  "PATCH /api/v1/profile": "auth",
  "PATCH /api/v1/profile/notifications": "auth",
  "GET /api/v1/audit-logs": "auth + rol(admin)",
  "GET /api/v1/public/dossier/:shareToken": "—",
  "GET /api/v1/investor/favorites": "auth + autoriza(rol(admin|buyer) · soloRol)",
  "POST /api/v1/investor/favorites/:projectId": "auth + autoriza(rol(admin|buyer) · soloRol)",
  "DELETE /api/v1/investor/favorites/:projectId": "auth + autoriza(rol(admin|buyer) · soloRol)",
  "GET /api/v1/investor/units": "auth + autoriza(rol(admin|buyer) · soloRol)",
  "GET /api/v1/investor/units/:id": "auth + autoriza(rol(admin|buyer) · dueño(Unit:id))",
  "GET /api/v1/investor/units/:id/news": "auth + autoriza(rol(admin|buyer) · dueño(Unit:id))",
  "GET /api/v1/investor/units/:id/dossier": "auth + autoriza(rol(admin|buyer) · dueño(Unit:id))",
  "GET /api/v1/investor/units/:id/dossier/export.pdf":
    "auth + autoriza(rol(admin|buyer) · dueño(Unit:id))",
  "POST /api/v1/investor/units/:id/dossier/share":
    "auth + autoriza(rol(admin|buyer) · dueño(Unit:id))",
  "GET /api/v1/investor/notifications": "auth + autoriza(rol(admin|buyer) · soloRol)",
  "GET /api/v1/investor/invitations/:id":
    "auth + autoriza(rol(admin|buyer) · dueño(Invitation:id))",
  "POST /api/v1/investor/invitations/:id/accept":
    "auth + autoriza(rol(admin|buyer) · dueño(Invitation:id))",
  "POST /api/v1/investor/invitations/:id/decline":
    "auth + autoriza(rol(admin|buyer) · dueño(Invitation:id))",
  "GET /api/v1/investor/contracts/:unitId":
    "auth + autoriza(rol(admin|buyer) · dueño(ContractOfUnit:unitId))",
  "GET /api/v1/developer/projects": "auth + autoriza(rol(admin|developer) · soloRol)",
  "GET /api/v1/developer/projects/:id":
    "auth + autoriza(rol(admin|developer) · proyecto(id → developer))",
  "POST /api/v1/developer/projects": "auth + autoriza(rol(admin|developer) · soloRol)",
  "GET /api/v1/developer/progress": "auth + autoriza(rol(admin|developer) · soloRol)",
  "GET /api/v1/developer/documents": "auth + autoriza(rol(admin|developer) · soloRol)",
  "GET /api/v1/developer/audit-log": "auth + autoriza(rol(admin|developer) · soloRol)",
  "POST /api/v1/developer/documents": "auth + autoriza(rol(admin|developer) · soloRol)",
  "GET /api/v1/developer/kpis": "auth + autoriza(rol(admin|developer) · soloRol)",
  "GET /api/v1/developer/projects/:id/units":
    "auth + autoriza(rol(admin|developer) · proyecto(id → developer))",
  "POST /api/v1/developer/projects/:id/units":
    "auth + autoriza(rol(admin|developer) · proyecto(id → developer))",
  "PATCH /api/v1/developer/units/:id":
    "auth + autoriza(rol(admin|developer) · proyecto(Unit:id → developer))",
  "GET /api/v1/developer/units": "auth + autoriza(rol(admin|developer) · soloRol)",
  "POST /api/v1/developer/projects/:id/invitations":
    "auth + autoriza(rol(admin|developer) · proyecto(id → developer))",
  "GET /api/v1/developer/projects/:id/contracts":
    "auth + autoriza(rol(admin|developer) · proyecto(id → developer))",
  "POST /api/v1/developer/contracts/:id/releases/:stageNum":
    "auth + autoriza(rol(admin|developer) · proyecto(Contract:id → developer))",
  "POST /api/v1/developer/projects/:id/stages/:stageId/evidence":
    "auth + autoriza(rol(admin|developer) · proyecto(id → developer))",
  "GET /api/v1/developer/capital/summary": "auth + autoriza(rol(admin|developer) · soloRol)",
  "GET /api/v1/developer/capital/monthly": "auth + autoriza(rol(admin|developer) · soloRol)",
  "GET /api/v1/developer/capital/by-project": "auth + autoriza(rol(admin|developer) · soloRol)",
  "GET /api/v1/developer/investors": "auth + autoriza(rol(admin|developer) · soloRol)",
  "GET /api/v1/notary/kpis": "auth + rol(admin|notary) + rol(admin|notary)",
  "GET /api/v1/notary/dossiers/pending": "auth + rol(admin|notary) + rol(admin|notary)",
  "GET /api/v1/notary/dossiers/:id": "auth + rol(admin|notary)",
  "POST /api/v1/notary/dossiers/:id/sign": "auth + rol(admin|notary)",
  "POST /api/v1/notary/dossiers/:id/reject": "auth + rol(admin|notary)",
  "GET /api/v1/notary/signatures": "auth + rol(admin|notary)",
  "GET /api/v1/certifier/kpis": "auth + rol(admin|verifier)",
  "GET /api/v1/certifier/assignments": "auth + rol(admin|verifier)",
  "GET /api/v1/certifier/stages/:id": "auth + rol(admin|verifier) + proyecto(Stage:id → verifier)",
  "POST /api/v1/certifier/stages/:id/certify":
    "auth + rol(admin|verifier) + proyecto(Stage:id → verifier)",
  "POST /api/v1/certifier/stages/:id/observe":
    "auth + rol(admin|verifier) + proyecto(Stage:id → verifier)",
  "GET /api/v1/certifier/certificates": "auth + rol(admin|verifier)"
};

/**
 * Las dos únicas rutas sin sesión del backlog (M2-D5 §2.2): el login, y el link
 * público del dossier, que existe para que alguien de afuera verifique sin cuenta.
 * Cualquier tercera es un olvido hasta que se agregue acá a mano.
 */
const SIN_SESION = new Set(["POST /api/v1/auth/login", "GET /api/v1/public/dossier/:shareToken"]);

// Lo que Express expone del router ya armado. `Layer` no conserva el path de
// montaje (lo compila a un matcher), por eso el prefijo sale de MONTAJE.
type Capa = {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] };
  handle: unknown;
};

function describirAcceso(acceso: ReglaDeAcceso): string {
  if (acceso === "soloRol") return "soloRol";
  if ("proyecto" in acceso) {
    const s = acceso.proyecto;
    const origen = "via" in s ? `${s.via}:${s.param}` : s.param;
    return `proyecto(${origen} → ${acceso.membresias.join("|")})`;
  }
  if ("dueño" in acceso) return `dueño(${acceso.dueño.via}:${acceso.dueño.param})`;
  return `alguna[${acceso.alguna.map(describirAcceso).join(" | ")}]`;
}

function describir(guard: GuardDescriptor): string {
  if (guard.kind === "authenticate") return "auth";
  if (guard.kind === "role") return `rol(${guard.roles.join("|")})`;
  if (guard.kind === "ownership") return `dueño(${guard.source.via}:${guard.source.param})`;
  if (guard.kind === "authorize")
    return `autoriza(rol(${guard.roles.join("|")}) · ${describirAcceso(guard.acceso)})`;

  const origen =
    "via" in guard.source ? `${guard.source.via}:${guard.source.param}` : guard.source.param;
  return `proyecto(${origen} → ${guard.memberships.join("|")})`;
}

type Montaje = {
  prefijo: string;
  guardsDeRouter: GuardDescriptor[];
  rutas: Map<string, GuardDescriptor[]>;
};

function leerMontaje(): Montaje[] {
  return MONTAJE.map(({ prefijo, router }) => {
    const guardsDeRouter: GuardDescriptor[] = [];
    const rutas = new Map<string, GuardDescriptor[]>();

    for (const capa of (router as unknown as { stack: Capa[] }).stack) {
      if (!capa.route) {
        // Middleware a nivel de router (`router.use(...)`): aplica a TODA request
        // que entra, matcheen o no sus rutas. Se acumula para las que siguen.
        const guard = leerGuard(capa.handle);
        if (guard) guardsDeRouter.push(guard);
        continue;
      }

      const propios = capa.route.stack
        .map((s) => leerGuard(s.handle))
        .filter((g): g is GuardDescriptor => g !== null);
      const path = `${prefijo}${capa.route.path}`.replace(/\/$/, "") || "/";

      for (const metodo of Object.keys(capa.route.methods)) {
        rutas.set(`${metodo.toUpperCase()} ${path}`, [...guardsDeRouter, ...propios]);
      }
    }

    return { prefijo, guardsDeRouter, rutas };
  });
}

function matrizViva(): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const { rutas } of leerMontaje()) {
    for (const [clave, guards] of rutas) {
      salida[clave] = guards.map(describir).join(" + ") || "—";
    }
  }
  return salida;
}

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
    // Una lista vacía no es "cualquiera": `requireRole()` rechaza a todos y
    // `projectScope` con `[]` deniega todo. Es fail-closed, así que no abre nada
    // — pero es una ruta muerta que contesta 403 a todo el mundo, y eso siempre
    // es un error de tipeo, nunca una intención.
    const vacias: string[] = [];
    for (const { rutas } of leerMontaje()) {
      for (const [clave, guards] of rutas) {
        for (const guard of guards) {
          if (guard.kind === "role" && guard.roles.length === 0) vacias.push(`${clave} · rol`);
          if (guard.kind === "projectAccess" && guard.memberships.length === 0)
            vacias.push(`${clave} · proyecto`);
        }
      }
    }

    expect(vacias).toEqual([]);
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
