import type { createId as CreateId } from "@paralleldrive/cuid2" with { "resolution-mode": "require" };
import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex
} from "drizzle-orm/sqlite-core";

// Mismos valores que los enums de `prisma/schema.prisma` (D-048 — migración a
// Drizzle). SQLite no tiene enum nativo: se modelan como `text` con el literal
// de valores válidos, que Drizzle usa para tipar (no para restringir en SQL —
// la restricción real la sigue haciendo Zod en `packages/shared`, regla 6).
export const USER_ROLES = ["admin", "developer", "buyer", "verifier"] as const;
export const PROJECT_STATUSES = ["planning", "in_progress", "delayed", "completed"] as const;
export const MEMBERSHIP_ROLES = ["developer", "buyer", "verifier"] as const;
export const MILESTONE_STATES = ["Pending", "InProgress", "Completed", "Observed"] as const;
export const EVIDENCE_TYPES = ["document", "photo", "certificate"] as const;

// `@paralleldrive/cuid2` es ESM puro (sin condición `require`). Con
// `moduleResolution: node16` en un package CJS, un `import` normal no
// typechequea (TS1479/TS1471). Se resuelve igual que el cliente libSQL (ver
// `lib/libsql-client.ts`): tipos vía `resolution-mode: "require"` + un
// `require()` en runtime, que Node 24 sabe cargar de forma síncrona aunque el
// módulo de destino sea ESM.
const { createId } = require("@paralleldrive/cuid2") as { createId: typeof CreateId };

export type UserRole = (typeof USER_ROLES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];
export type MilestoneState = (typeof MILESTONE_STATES)[number];
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

// `id` usa `@paralleldrive/cuid2` (`createId()`) como default de cada tabla —
// mismo rol que `cuid()` de Prisma, formato distinto (documentado aparte).
const id = () => text("id").primaryKey().$defaultFn(() => createId());

// Prisma actualizaba `updatedAt` solo en cada `update` (`@updatedAt`). Drizzle
// no lo hace solo: `$onUpdate` replica el comportamiento sin tocar cada
// `update()` a mano. Modo `timestamp_ms`, idiomático con libsql: en JS siempre
// se obtiene un `Date`, y las rutas siguen serializando a ISO string donde ya
// lo hacían.
const timestamps = {
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
};

export const users = sqliteTable("User", {
  id: id(),
  email: text("email").notNull(),
  passwordHash: text("passwordHash").notNull(),
  role: text("role", { enum: USER_ROLES }).notNull(),
  fullName: text("fullName").notNull(),
  isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt
}, (table) => [
  uniqueIndex("User_email_key").on(table.email)
]);

export const projects = sqliteTable("Project", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  totalUnits: integer("totalUnits").notNull().default(0),
  estimatedDelivery: integer("estimatedDelivery", { mode: "timestamp_ms" }),
  status: text("status", { enum: PROJECT_STATUSES }).notNull().default("planning"),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt
}, (table) => [
  uniqueIndex("Project_slug_key").on(table.slug)
]);

export const projectMembers = sqliteTable("ProjectMember", {
  id: id(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: text("projectId")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  membershipRole: text("membershipRole", { enum: MEMBERSHIP_ROLES }).notNull(),
  createdAt: timestamps.createdAt
}, (table) => [
  uniqueIndex("ProjectMember_userId_projectId_membershipRole_key").on(
    table.userId,
    table.projectId,
    table.membershipRole
  )
]);

export const milestones = sqliteTable("Milestone", {
  id: id(),
  projectId: text("projectId")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sequenceOrder: integer("sequenceOrder").notNull(),
  state: text("state", { enum: MILESTONE_STATES }).notNull().default("Pending"),
  validationCritical: integer("validationCritical", { mode: "boolean" }).notNull().default(false),
  certifiedAt: integer("certifiedAt", { mode: "timestamp_ms" }),
  certifiedById: text("certifiedById").references(() => users.id, { onDelete: "set null" }),
  scopeType: text("scopeType").notNull().default("project_wide"),
  scopeUnitCount: integer("scopeUnitCount").notNull().default(0),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt
}, (table) => [
  uniqueIndex("Milestone_projectId_sequenceOrder_key").on(table.projectId, table.sequenceOrder)
]);

export const evidences = sqliteTable("Evidence", {
  id: id(),
  projectId: text("projectId")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  milestoneId: text("milestoneId").references(() => milestones.id, { onDelete: "set null" }),
  uploadedById: text("uploadedById")
    .notNull()
    .references(() => users.id),
  evidenceType: text("evidenceType", { enum: EVIDENCE_TYPES }).notNull(),
  category: text("category").notNull(),
  authoritative: integer("authoritative", { mode: "boolean" }).notNull().default(false),
  originalFilename: text("originalFilename").notNull(),
  storedFilename: text("storedFilename").notNull(),
  mimeType: text("mimeType").notNull(),
  sizeBytes: integer("sizeBytes").notNull(),
  storagePath: text("storagePath").notNull(),
  sha256Hash: text("sha256Hash").notNull(),
  uploadedAt: integer("uploadedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt
}, (table) => [
  index("Evidence_projectId_idx").on(table.projectId),
  index("Evidence_milestoneId_idx").on(table.milestoneId)
]);

export const auditLogs = sqliteTable("AuditLog", {
  id: id(),
  actorUserId: text("actorUserId").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entityType").notNull(),
  entityId: text("entityId").notNull(),
  metadataJson: text("metadataJson"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
}, (table) => [
  index("AuditLog_createdAt_idx").on(table.createdAt)
]);

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(projectMembers),
  evidences: many(evidences, { relationName: "EvidenceUploadedBy" }),
  certifiedMilestones: many(milestones, { relationName: "MilestoneCertifiedBy" }),
  auditLogs: many(auditLogs, { relationName: "AuditActor" })
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  members: many(projectMembers),
  milestones: many(milestones),
  evidences: many(evidences)
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  user: one(users, { fields: [projectMembers.userId], references: [users.id] }),
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] })
}));

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
  project: one(projects, { fields: [milestones.projectId], references: [projects.id] }),
  certifiedBy: one(users, {
    fields: [milestones.certifiedById],
    references: [users.id],
    relationName: "MilestoneCertifiedBy"
  }),
  evidences: many(evidences)
}));

export const evidencesRelations = relations(evidences, ({ one }) => ({
  project: one(projects, { fields: [evidences.projectId], references: [projects.id] }),
  milestone: one(milestones, { fields: [evidences.milestoneId], references: [milestones.id] }),
  uploadedBy: one(users, {
    fields: [evidences.uploadedById],
    references: [users.id],
    relationName: "EvidenceUploadedBy"
  })
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
    relationName: "AuditActor"
  })
}));

// Nota sobre el ON DELETE de `Evidence.uploadedById`: la migración original de
// Prisma lo declara `ON DELETE RESTRICT` (el default de Prisma, no un
// `onDelete` explícito en el schema). No se replica acá porque SQLite con
// `PRAGMA foreign_keys` en libSQL ya rechaza el delete de un `User` con
// evidencia asociada al no haber ninguna acción declarada (el default de
// SQLite ES `RESTRICT` cuando la FK no dice `ON DELETE ...`), así que el
// comportamiento observable es el mismo.
