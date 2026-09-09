import { z } from "zod";

// El proyecto: su CRUD genérico (`/projects`, admin) y la superficie del
// developer (`/developer/projects`, que además mintea el Stage template —
// ver `stage.ts`). Dos endpoints de creación, dos schemas: los campos que
// acepta cada uno no son los mismos (el CRUD admin permite fijar
// `latitude`/`longitude`/`status`; el del developer no).

/** Espeja el estado comercial del proyecto en la migración (D-016). */
export const PROJECT_STATUSES = ["planning", "in_progress", "delayed", "completed"] as const;
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

/** Espeja `ProjectMember.membershipRole` en la migración. */
export const MEMBERSHIP_ROLES = ["developer", "buyer", "verifier"] as const;
export const membershipRoleSchema = z.enum(MEMBERSHIP_ROLES);
export type MembershipRole = z.infer<typeof membershipRoleSchema>;

/**
 * Filtros de `GET /projects`. Los cinco son opcionales y un valor inválido es
 * 400, no un filtro ignorado en silencio (ver el comentario original en
 * `projects.routes.ts`: un `status=activo` que no existe tiene que
 * enterarse quien lo pidió, no recibir el listado entero).
 */
export const projectListQuerySchema = z.object({
  status: projectStatusSchema.optional(),
  city: z.string().min(1).optional(),
  /** Fila 04 — el typeahead. Busca en nombre y ciudad. */
  q: z.string().min(1).max(120).optional(),
  /** Fila 05 — el orden del `SelectDropdown`. */
  sort: z.enum(["recent", "name", "delivery"]).optional(),
  /**
   * Fila 03 — el viewport del mapa: `minLon,minLat,maxLon,maxLat`. Un bbox
   * mal formado es 400 y no un filtro que se ignora en silencio.
   */
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/)
    .optional()
});
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;

/** Body de `POST /api/v1/projects` (CRUD genérico, admin-only). */
export const createProjectSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  totalUnits: z.number().int().nonnegative().default(0),
  estimatedDelivery: z.iso.datetime().optional(),
  status: projectStatusSchema.default("planning")
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/** Body de `PATCH /api/v1/projects/:id`. Mismos campos, todos opcionales. */
export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  totalUnits: z.number().int().nonnegative().optional(),
  estimatedDelivery: z.iso.datetime().optional(),
  status: projectStatusSchema.optional()
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

/** Body de `POST /api/v1/projects/:id/members`. */
export const addProjectMemberSchema = z.object({
  userId: z.string().min(1),
  membershipRole: membershipRoleSchema
});
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;

/**
 * Body de `POST /api/v1/developer/projects` — fila 34b-34c, el "Stage
 * template". Sin `latitude`/`longitude`/`status`: esta superficie no los
 * pide (nace siempre en `planning`) y `z.strictObject` lo hace explícito en
 * vez de dejarlos pasar y ser ignorados en silencio.
 */
export const createDeveloperProjectSchema = z.strictObject({
  name: z.string().min(1),
  slug: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  totalUnits: z.number().int().nonnegative().optional(),
  estimatedDelivery: z.string().optional()
});
export type CreateDeveloperProjectInput = z.infer<typeof createDeveloperProjectSchema>;

/**
 * La fila de `Project` completa, tal como la devuelven la mayoría de los
 * endpoints que la exponen (`selectAll()`/`returningAll()`). Sin nada que
 * ocultar — a diferencia de `Evidence`, ninguna columna de `Project` es
 * sensible. `estimatedDelivery`/`createdAt`/`updatedAt` ya son `Date`
 * (`SqliteTypeCoercionPlugin`).
 */
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
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type ProjectResponse = z.infer<typeof projectSchema>;
