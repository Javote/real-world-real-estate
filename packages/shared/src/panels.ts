import { z } from "zod";

const kpiPendiente = z.number().int().nonnegative().nullable();

export const developerKpisSchema = z.strictObject({
  activeProjects: z.number().int().nonnegative(),
  totalUnits: kpiPendiente,
  capitalRaisedMinorUnits: kpiPendiente,
  averageProgress: z.number().int().min(0).max(100),
  verifiedDocuments: z.number().int().nonnegative()
});
export type DeveloperKpis = z.infer<typeof developerKpisSchema>;

export const certifierKpisSchema = z.strictObject({
  assigned: z.number().int().nonnegative(),
  certified: z.number().int().nonnegative(),
  observed: z.number().int().nonnegative(),
  totalStages: z.number().int().nonnegative()
});
export type CertifierKpis = z.infer<typeof certifierKpisSchema>;

export const certifierAssignmentSchema = z.strictObject({
  stageId: z.string(),
  projectName: z.string(),
  stageName: z.string(),
  sequenceOrder: z.number().int().positive()
});
export type CertifierAssignment = z.infer<typeof certifierAssignmentSchema>;

export const notaryKpisSchema = z.strictObject({
  pendingDossiers: kpiPendiente,
  verified: kpiPendiente,
  signed: kpiPendiente,
  unitsUnderReview: kpiPendiente
});
export type NotaryKpis = z.infer<typeof notaryKpisSchema>;

export const pendingDossierSchema = z.strictObject({
  dossierId: z.string(),
  unitLabel: z.string(),
  investorName: z.string(),
  completeness: z.number().int().min(0).max(100)
});
export type PendingDossier = z.infer<typeof pendingDossierSchema>;
