import type { UserRole } from "../auth";
import type { MembershipRole } from "../project";

// La regla de autorización como dato (D-088): la declara la `meta` de cada procedimiento del contrato y
// la evalúa la API (`apps/api/src/middlewares/auth.ts`). Vive acá para escribirse una sola vez.

export type EntidadConProyecto = "Stage" | "Evidence" | "EvidenceBundle" | "Unit" | "Contract";

export type ProjectSource =
  | { param: string }
  | {
      via: EntidadConProyecto;
      param: string;
      en?: "path" | "body";
      nombre?: string;
    };

export type OwnerSource =
  | { via: "Unit"; param: string }
  | { via: "Invitation"; param: string }
  | { via: "CertifierInvitation"; param: string }
  | { via: "ContractOfUnit"; param: string }
  | { via: "Contract"; param: string };

export type ReglaSimple =
  | { proyecto: ProjectSource; membresias: MembershipRole[] }
  | { dueño: OwnerSource }
  | { scopeEnQuery: string }
  | "soloRol";

export type ReglaDeAcceso = ReglaSimple | { alguna: [ReglaSimple, ReglaSimple, ...ReglaSimple[]] };

export type ReglaDeAutorizacion = { roles: UserRole[]; acceso: ReglaDeAcceso };

/** Las rutas públicas lo dicen explícito con `sinSesion`: ninguna queda abierta por omisión. */
export type Guard = ReglaDeAutorizacion | { sinSesion: true };

export type MetaDeProcedimiento = { guard?: Guard };
