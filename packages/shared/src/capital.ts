import { z } from "zod";

export const capitalSummarySchema = z.strictObject({
  raisedMinorUnits: z.number().int().nonnegative(),
  releasedMinorUnits: z.number().int().nonnegative(),
  pendingMinorUnits: z.number().int().nonnegative(),
  contracts: z.number().int().nonnegative(),
  currency: z.string().nullable()
});
export type CapitalSummary = z.infer<typeof capitalSummarySchema>;

export const capitalMonthlyPointSchema = z.strictObject({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  raisedMinorUnits: z.number().int().nonnegative(),
  releasedMinorUnits: z.number().int().nonnegative()
});
export type CapitalMonthlyPoint = z.infer<typeof capitalMonthlyPointSchema>;

export const capitalByProjectSchema = z.strictObject({
  projectId: z.string(),
  projectName: z.string(),
  raisedMinorUnits: z.number().int().nonnegative(),
  releasedMinorUnits: z.number().int().nonnegative(),
  unitsSold: z.number().int().nonnegative(),
  totalUnits: z.number().int().nonnegative(),
  investors: z.number().int().nonnegative(),
  currency: z.string().nullable()
});
export type CapitalByProject = z.infer<typeof capitalByProjectSchema>;

export const investorDirectoryEntrySchema = z.strictObject({
  id: z.string(),
  fullName: z.string(),
  email: z.string(),
  units: z.number().int().nonnegative(),
  investedMinorUnits: z.number().int().nonnegative(),
  currency: z.string().nullable(),
  projects: z.array(z.string())
});
export type InvestorDirectoryEntry = z.infer<typeof investorDirectoryEntrySchema>;
