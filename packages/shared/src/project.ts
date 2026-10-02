import { z } from "zod";
import { userRoleSchema } from "./auth";
import { onChainEventSchema, stageSchema } from "./stage";

export const PROJECT_STATUSES = ["planning", "in_progress", "delayed", "completed"] as const;
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const MEMBERSHIP_ROLES = ["developer", "buyer", "verifier"] as const;
export const membershipRoleSchema = z.enum(MEMBERSHIP_ROLES);
export type MembershipRole = z.infer<typeof membershipRoleSchema>;

export const projectListQuerySchema = z.object({
  status: projectStatusSchema.optional(),
  city: z.string().min(1).optional(),
  q: z.string().min(1).max(120).optional(),
  sort: z.enum(["recent", "name", "delivery"]).optional(),
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/)
    .optional()
});
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;

export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);

export const createProjectSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  totalUnits: z.number().int().nonnegative().default(0),
  estimatedDelivery: z.iso.datetime().optional(),
  status: projectStatusSchema.default("planning")
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  totalUnits: z.number().int().nonnegative().optional(),
  estimatedDelivery: z.iso.datetime().optional(),
  status: projectStatusSchema.optional()
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const addProjectMemberSchema = z.object({
  userId: z.string().min(1),
  membershipRole: membershipRoleSchema
});
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;

export const createDeveloperProjectSchema = z.strictObject({
  name: z.string().min(1),
  slug: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  totalUnits: z.number().int().nonnegative().optional(),
  estimatedDelivery: z.string().optional()
});
export type CreateDeveloperProjectInput = z.infer<typeof createDeveloperProjectSchema>;

export const geocodeQuerySchema = z.strictObject({
  q: z.string().trim().min(3).max(200)
});
export type GeocodeQuery = z.infer<typeof geocodeQuerySchema>;

export const geocodeResultSchema = z.strictObject({
  match: z
    .strictObject({ latitude: latitudeSchema, longitude: longitudeSchema, label: z.string() })
    .nullable()
});
export type GeocodeResult = z.infer<typeof geocodeResultSchema>;

export const projectSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  totalUnits: z.number().int().nonnegative(),
  estimatedDelivery: z.coerce.date().nullable(),
  status: projectStatusSchema,
  organizationId: z.string().nullable(),
  coverUpdatedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type ProjectResponse = z.infer<typeof projectSchema>;

export const projectCoverResultSchema = z.strictObject({
  coverUpdatedAt: z.coerce.date()
});
export type ProjectCoverResult = z.infer<typeof projectCoverResultSchema>;

export const projectListItemSchema = projectSchema.extend({
  stages: z.array(stageSchema)
});
export type ProjectListItem = z.infer<typeof projectListItemSchema>;

export const projectMemberWithUserSchema = z.strictObject({
  id: z.string(),
  userId: z.string(),
  projectId: z.string(),
  membershipRole: membershipRoleSchema,
  createdAt: z.coerce.date(),
  user: z.strictObject({
    id: z.string(),
    email: z.email(),
    fullName: z.string(),
    role: userRoleSchema
  })
});
export type ProjectMemberWithUser = z.infer<typeof projectMemberWithUserSchema>;

export const projectDetailSchema = projectSchema.extend({
  stages: z.array(stageSchema),
  members: z.array(projectMemberWithUserSchema)
});
export type ProjectDetail = z.infer<typeof projectDetailSchema>;

export const projectMemberSchema = z.strictObject({
  id: z.string(),
  userId: z.string(),
  projectId: z.string(),
  membershipRole: membershipRoleSchema,
  createdAt: z.coerce.date()
});
export type ProjectMemberResponse = z.infer<typeof projectMemberSchema>;

export const developerProjectListItemSchema = projectSchema.extend({
  stageCount: z.number().int().nonnegative(),
  progress: z.number().int().min(0).max(100),
  priceFromMinorUnits: z.number().int().nonnegative().nullable(),
  priceCurrency: z.string().nullable()
});
export type DeveloperProjectListItem = z.infer<typeof developerProjectListItemSchema>;

export const developerProfileProjectSchema = developerProjectListItemSchema.extend({
  sizeMinM2: z.number().int().positive().nullable(),
  sizeMaxM2: z.number().int().positive().nullable()
});
export type DeveloperProfileProject = z.infer<typeof developerProfileProjectSchema>;

export const developerProfileSchema = z.strictObject({
  organization: z
    .strictObject({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      bio: z.string().nullable(),
      foundedYear: z.number().int().nullable()
    })
    .nullable(),
  stats: z.strictObject({
    projectsDelivered: z.number().int().nonnegative(),
    unitsSold: z.number().int().nonnegative(),
    investors: z.number().int().nonnegative(),
    yearsInBusiness: z.number().int().nonnegative().nullable()
  }),
  previousProjects: z.array(developerProfileProjectSchema),
  activeProjects: z.array(developerProfileProjectSchema)
});
export type DeveloperProfile = z.infer<typeof developerProfileSchema>;

export const developerProjectDetailSchema = projectSchema.extend({
  stages: z.array(stageSchema),
  evidenceCount: z.number().int().nonnegative()
});
export type DeveloperProjectDetail = z.infer<typeof developerProjectDetailSchema>;

export const developerProjectCreateResultSchema = projectSchema.extend({
  stages: z.array(stageSchema.extend({ anchor: onChainEventSchema }))
});
export type DeveloperProjectCreateResult = z.infer<typeof developerProjectCreateResultSchema>;
