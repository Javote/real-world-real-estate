import { z } from "zod";

// La marca es solo de tipo: en el JSON Schema y en el OpenAPI siguen siendo `string`. Lo que agrega
// es que `tsc` no deja pasar un `UnitId` donde se espera un `StageId`.
// Con el tipo anotado: inferido, el `.d.ts` despliega `string` como un objeto y deja de ser asignable a
// `string` del lado que lo importa.
export type IdConMarca<Marca extends string> = z.core.$ZodBranded<z.ZodString, Marca>;

export const userIdSchema: IdConMarca<"UserId"> = z.string().brand<"UserId">();
export const organizationIdSchema: IdConMarca<"OrganizationId"> = z
  .string()
  .brand<"OrganizationId">();
export const projectIdSchema: IdConMarca<"ProjectId"> = z.string().brand<"ProjectId">();
export const stageIdSchema: IdConMarca<"StageId"> = z.string().brand<"StageId">();
export const unitIdSchema: IdConMarca<"UnitId"> = z.string().brand<"UnitId">();
export const evidenceIdSchema: IdConMarca<"EvidenceId"> = z.string().brand<"EvidenceId">();
export const bundleIdSchema: IdConMarca<"BundleId"> = z.string().brand<"BundleId">();
export const dossierIdSchema: IdConMarca<"DossierId"> = z.string().brand<"DossierId">();
export const contractIdSchema: IdConMarca<"ContractId"> = z.string().brand<"ContractId">();
export const invitationIdSchema: IdConMarca<"InvitationId"> = z.string().brand<"InvitationId">();
export const certifierInvitationIdSchema: IdConMarca<"CertifierInvitationId"> = z
  .string()
  .brand<"CertifierInvitationId">();
export const notificationIdSchema: IdConMarca<"NotificationId"> = z
  .string()
  .brand<"NotificationId">();
export const onChainEventIdSchema: IdConMarca<"OnChainEventId"> = z
  .string()
  .brand<"OnChainEventId">();

export type UserId = z.infer<typeof userIdSchema>;
export type OrganizationId = z.infer<typeof organizationIdSchema>;
export type ProjectId = z.infer<typeof projectIdSchema>;
export type StageId = z.infer<typeof stageIdSchema>;
export type UnitId = z.infer<typeof unitIdSchema>;
export type EvidenceId = z.infer<typeof evidenceIdSchema>;
export type BundleId = z.infer<typeof bundleIdSchema>;
export type DossierId = z.infer<typeof dossierIdSchema>;
export type ContractId = z.infer<typeof contractIdSchema>;
export type InvitationId = z.infer<typeof invitationIdSchema>;
export type CertifierInvitationId = z.infer<typeof certifierInvitationIdSchema>;
export type NotificationId = z.infer<typeof notificationIdSchema>;
export type OnChainEventId = z.infer<typeof onChainEventIdSchema>;
