import { z } from "zod";

// SPEC-207 (B-09): antes, `writeAuditLog` tomaba `action`/`entityType` como
// `string` a secas. Del otro lado, `auditScope` (apps/api/src/middlewares/auth.ts)
// es fail-closed: un `entityType` que no esté en su mapeo **no se muestra
// nunca**, en silencio. Y las 29 `action` tienen que estar espejadas a mano en
// el diccionario del front o la UI muestra el literal. Coincidían porque
// alguien se acordó, no porque algo lo obligara — mismo argumento que
// `ALL_MEMBERSHIPS`/`TODOS_LOS_ROLES` en `middlewares/auth.ts`: "ampliar un
// permiso tiene que ser un acto deliberado; el trabajo de escribir un renglón
// es exactamente el punto".
//
// **Esto gobierna la ESCRITURA, no la lectura histórica.** Una fila vieja con
// un valor que ya no está acá se sigue leyendo igual — por eso
// `auditLogEntrySchema`/`auditLogRowSchema` (`pagination.ts`) siguen con
// `action`/`entityType` como `z.string()` pelado. Achicar cualquiera de las
// dos uniones no puede romper una lectura, solo impedir que se vuelva a
// escribir.

/**
 * Toda `action` que `writeAuditLog` puede escribir hoy — contadas sobre los 29
 * call sites reales de `src` (27 literales + `CERTIFY_STAGE`/`OBSERVE_STAGE`,
 * que llegan vía el parámetro `auditAction` de `transitionStage`, y
 * `CHANGE_STAGE_STATE`, su default cuando no se pasa ninguno).
 */
export const AUDIT_ACTIONS = [
  "ACCEPT_CERTIFIER_INVITATION",
  "ACCEPT_INVITATION",
  "ADD_PROJECT_MEMBER",
  "ANCHOR_DOCUMENT",
  "ANCHOR_EVIDENCE",
  "CERTIFY_STAGE",
  "CHANGE_STAGE_STATE",
  "CREATE_INVITATION",
  "CREATE_PROJECT",
  "CREATE_UNIT",
  "CREATE_USER",
  "DECLINE_CERTIFIER_INVITATION",
  "DECLINE_INVITATION",
  "DELETE_EVIDENCE",
  "DELETE_PROJECT",
  "DELETE_USER",
  "EXPORT_DOSSIER",
  "INVITE_CERTIFIER",
  "LOGIN",
  "OBSERVE_STAGE",
  "REJECT_DOSSIER",
  "RELEASE_PAYMENT",
  "RETRY_STAGE_ANCHOR",
  "SHARE_DOSSIER",
  "SIGN_DOSSIER",
  "STAGE_WORK_INITIATED",
  "UPDATE_EVIDENCE",
  "UPDATE_PROFILE",
  "UPDATE_PROJECT",
  "UPDATE_STAGE",
  "UPDATE_UNIT",
  "UPDATE_USER",
  "UPLOAD_STAGE_EVIDENCE"
] as const;
export const auditActionSchema = z.enum(AUDIT_ACTIONS);
export type AuditAction = z.infer<typeof auditActionSchema>;

/**
 * Todo `entityType` que `writeAuditLog` puede escribir hoy. `User` está
 * incluida acá —es una `action` real, `CREATE_USER`/`UPDATE_USER`/`DELETE_USER`
 * la escriben— pero queda **fuera del scope del developer a propósito**:
 * crear usuarios o cambiar roles no pertenece a ningún proyecto. `auditScope`
 * la excluye explícitamente, no por omisión (ver ese archivo).
 */
export const AUDIT_ENTITY_TYPES = [
  "CertifierInvitation",
  "Dossier",
  "Evidence",
  "Invitation",
  "PaymentAttestation",
  "Project",
  "ProjectMember",
  "Stage",
  "Unit",
  "User"
] as const;
export const auditEntityTypeSchema = z.enum(AUDIT_ENTITY_TYPES);
export type AuditEntityType = z.infer<typeof auditEntityTypeSchema>;
