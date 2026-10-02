import { z } from "zod";
import { passwordSchema, userRoleSchema } from "./auth";

export const createUserSchema = z.object({
  email: z.email(),
  password: passwordSchema,
  role: userRoleSchema,
  fullName: z.string().min(1)
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
  password: passwordSchema.optional()
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userSummarySchema = z.strictObject({
  id: z.string(),
  email: z.email(),
  role: userRoleSchema,
  fullName: z.string(),
  isActive: z.boolean(),
  createdAt: z.coerce.date()
});
export type UserSummary = z.infer<typeof userSummarySchema>;

export const userMutationResultSchema = z.strictObject({
  id: z.string(),
  email: z.email(),
  role: userRoleSchema,
  fullName: z.string(),
  isActive: z.boolean()
});
export type UserMutationResult = z.infer<typeof userMutationResultSchema>;
