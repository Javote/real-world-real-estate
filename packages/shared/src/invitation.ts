import { z } from "zod";

export const createInvitationSchema = z.strictObject({
  unitId: z.string().min(1),
  investorEmail: z.email(),
  amountMinorUnits: z.number().int().positive(),
  currency: z.string().length(3)
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const INVITATION_STATUSES = ["pending", "accepted", "declined"] as const;
export const invitationStatusSchema = z.enum(INVITATION_STATUSES);
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

export const invitationSchema = z.strictObject({
  id: z.string(),
  projectId: z.string(),
  unitId: z.string(),
  investorEmail: z.email(),
  amountMinorUnits: z.number().int().positive(),
  currency: z.string(),
  status: invitationStatusSchema,
  createdById: z.string().nullable(),
  createdAt: z.coerce.date(),
  respondedAt: z.number().nullable()
});
export type InvitationResponse = z.infer<typeof invitationSchema>;

export const investorInvitationDetailSchema = z.strictObject({
  id: z.string(),
  investorEmail: z.email(),
  amountMinorUnits: z.number().int().positive(),
  currency: z.string(),
  status: invitationStatusSchema,
  createdAt: z.coerce.date(),
  unitReference: z.string(),
  projectName: z.string()
});
export type InvestorInvitationDetail = z.infer<typeof investorInvitationDetailSchema>;
