import { z } from "zod";
import { userRoleSchema } from "./auth";
import { onChainEventSchema, stageSchema } from "./stage";

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
  /**
   * La organización desarrolladora (migración 0010, SPEC-220). Anulable: los
   * proyectos anteriores a esa migración no tienen una y no se les inventa.
   *
   * **Va acá porque `projectSchema` es `strictObject`**: las rutas que hacen
   * `projectSchema.parse(fila)` sobre un `returningAll()` rechazarían la fila
   * entera por una clave que el schema no declara. Una columna nueva en
   * `Project` es, por construcción, un campo nuevo en este contrato.
   */
  organizationId: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type ProjectResponse = z.infer<typeof projectSchema>;

/** `GET /api/v1/projects` (array): cada proyecto con sus stages, ya ordenados. */
export const projectListItemSchema = projectSchema.extend({
  stages: z.array(stageSchema)
});
export type ProjectListItem = z.infer<typeof projectListItemSchema>;

/**
 * Un miembro de proyecto, con el usuario embebido. Misma forma en
 * `GET /projects/:id` (dentro de `members`) y `GET /projects/:id/members`.
 */
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

/** `GET /api/v1/projects/:id`: el proyecto con sus stages y sus miembros. */
export const projectDetailSchema = projectSchema.extend({
  stages: z.array(stageSchema),
  members: z.array(projectMemberWithUserSchema)
});
export type ProjectDetail = z.infer<typeof projectDetailSchema>;

/** `POST /api/v1/projects/:id/members`: la fila de `ProjectMember`, sin el usuario. */
export const projectMemberSchema = z.strictObject({
  id: z.string(),
  userId: z.string(),
  projectId: z.string(),
  membershipRole: membershipRoleSchema,
  createdAt: z.coerce.date()
});
export type ProjectMemberResponse = z.infer<typeof projectMemberSchema>;

/**
 * Fila 35-36 — `GET /developer/projects`. `priceFromMinorUnits` es una
 * agregación (el mínimo de `Unit.priceMinorUnits` del proyecto), no una
 * columna: `null` si el proyecto no tiene ninguna unidad con precio, o si
 * tiene precios en más de una moneda (comparar unidades mínimas de monedas
 * distintas no da un número con significado — regla 17, antes ningún precio
 * que uno falso).
 */
export const developerProjectListItemSchema = projectSchema.extend({
  stageCount: z.number().int().nonnegative(),
  progress: z.number().int().min(0).max(100),
  priceFromMinorUnits: z.number().int().nonnegative().nullable(),
  priceCurrency: z.string().nullable()
});
export type DeveloperProjectListItem = z.infer<typeof developerProjectListItemSchema>;

/**
 * **Capturas 59-60 de M2-D2 (`DEVELOPER-REPUTATION-A/B`) — `GET
 * /projects/:id/developer`.** SPEC-220.
 *
 * Es la única superficie del producto que **no tiene fila en M2-D5**: está
 * diseñada en M2-D2 y el backlog de M3 nunca la recogió. Por eso no hay test
 * IDs que transcribir y los de acá son nuestros, con la misma forma que los
 * del entregable.
 *
 * **Sin `rating` ni conteo de inversores en el pill** (D-094). Las capturas
 * muestran "4.8 / 5.0 · 127 investors" junto al nombre; un rating es una
 * afirmación sobre la calidad del desarrollador, y D-026 limita lo que la
 * plataforma sostiene a cuatro afirmaciones sobre documentos y atestaciones.
 * No hay reseñas ni quién las firme: el número solo podría escribirse a mano.
 * Mismo criterio que D-070 con "Release stage N payment".
 *
 * El resto **sí se sostiene, porque se deriva del registro** y no de un campo
 * que alguien mantiene: las obras entregadas son los proyectos en `completed`,
 * las unidades vendidas son las `Unit` en `sold`, y los dos listados son esos
 * mismos proyectos partidos por estado.
 */
export const developerProfileProjectSchema = developerProjectListItemSchema.extend({
  /** `MIN`/`MAX` de `Unit.sizeM2` — el "60 m² to 150 m²" de la captura 60. */
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
  /**
   * Todo derivado, nada almacenado. `yearsInBusiness` sale de `foundedYear`
   * contra el año actual: `null` si el desarrollador no lo declaró, nunca 0.
   */
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

/** Fila 37 — `GET /developer/projects/:id`. */
export const developerProjectDetailSchema = projectSchema.extend({
  stages: z.array(stageSchema),
  evidenceCount: z.number().int().nonnegative()
});
export type DeveloperProjectDetail = z.infer<typeof developerProjectDetailSchema>;

/**
 * Fila 34b-34c — `POST /developer/projects`. Las 10 etapas del Stage template,
 * cada una con su mint (D-059: la declaración off-chain nunca depende del
 * anclaje — un mint que falló deja igual la etapa en la lista, con su
 * `anchor.status` en `"Failed"`).
 */
export const developerProjectCreateResultSchema = projectSchema.extend({
  stages: z.array(stageSchema.extend({ anchor: onChainEventSchema }))
});
export type DeveloperProjectCreateResult = z.infer<typeof developerProjectCreateResultSchema>;
