import { z } from "zod";

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
  "UPDATE_PROJECT_COVER",
  "UPDATE_STAGE",
  "UPDATE_UNIT",
  "UPDATE_USER",
  "UPLOAD_STAGE_EVIDENCE"
] as const;
export const auditActionSchema = z.enum(AUDIT_ACTIONS);
export type AuditAction = z.infer<typeof auditActionSchema>;

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
