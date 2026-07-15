# 02 — Modelo de dominio y base de datos

## Entidades conceptuales aprobadas

`Account`, `UnitForSale`, `Certifier`, `Milestone`, `EvidenceBundle`, `EvidenceItem`, `OnChainEvent` — más las entidades operativas que exige el backlog: `Project`, `ProjectMembership`, `Invitation`, `Contract`, `Release`, `Notification`, `AuditLog`, `Dossier/ShareToken`, `Favorite`.

## Diagrama (cardinalidades del modelo conceptual)

```
Account 1 ──── 0..* UnitForSale
Account 1 ──── 0..* Certifier (perfil profesional)
UnitForSale 1 ──── 1..* Milestone
Certifier 1 ──── 0..* Milestone (certifica)
Milestone 1 ──── 0..* EvidenceBundle
EvidenceBundle 1 ──── 1..* EvidenceItem
Milestone 1 ──── 0..* EvidenceItem (directa, opcional)
Milestone 1 ──── 0..* OnChainEvent
EvidenceBundle 1 ──── 1 OnChainEvent (ancla del root)
EvidenceItem 1 ──── 0..1 OnChainEvent (ancla individual, opcional)
```

## Máquina de estados de Milestone

Estados user-facing: **Pending** (definido, no iniciado) → **In Progress** (juntando evidencia) → **Certified** (validado con pruebas ancladas). **Observed** = flagged para remediación, con notas y evidencia trazables.

```
Pending ──start──▶ InProgress ──certify──▶ Certified
                      │  ▲                    │
                   flag│  │reopen         flag│
                      ▼  │                    ▼
                     Observed ◀───────────────┘
```

Reglas de transición (backend, no on-chain en fase 1):

| Transición | Precondiciones | Actor | Efectos |
|---|---|---|---|
| `Pending → InProgress` | — | developer del proyecto | audit_log |
| `InProgress → Certified` | ≥1 evidencia asociada; certificador asignado | certifier | `certified_at`, OnChainEvent (M3-SC-05), audit_log, notificación |
| `InProgress → Observed` | nota obligatoria | certifier | audit_log, notificación |
| `Certified → Observed` | nota obligatoria | certifier | audit_log, notificación |
| `Observed → InProgress` | remediación registrada | developer | audit_log |

Implementar como función pura `transition(milestone, action, actor) → Result` en `packages/shared` (testeable sin DB) + persistencia en `packages/api`.

## Esquema Drizzle (referencia — `packages/db/src/schema.ts`)

```ts
import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, pgEnum, numeric } from "drizzle-orm/pg-core";

export const accountType = pgEnum("account_type", ["investor", "developer", "notary", "certifier", "admin"]);
export const milestoneState = pgEnum("milestone_state", ["pending", "in_progress", "certified", "observed"]);
export const onchainEventType = pgEnum("onchain_event_type", [
  "evidence_item_anchor",    // M3-SC-06 / metadata
  "evidence_bundle_anchor",  // M3-SC-02
  "stage_certification",     // M3-SC-05
  "notary_signature",        // M3-SC-04
  "invitation_anchor",       // M3-SC-01
  "stage_release",           // M3-SC-03
]);

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  type: accountType("type").notNull(),
  displayName: text("display_name").notNull(),
  locale: text("locale").notNull().default("es"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const certifiers = pgTable("certifiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  professionalRole: text("professional_role").notNull(),
  licenseReference: text("license_reference").notNull(),
  // clave pública de la wallet usada para firmar commits on-chain (fase B)
  signingKeyHash: text("signing_key_hash"),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  developerId: uuid("developer_id").notNull().references(() => accounts.id),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  geoLat: numeric("geo_lat"), geoLng: numeric("geo_lng"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const units = pgTable("units_for_sale", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  ownerAccountId: uuid("owner_account_id").references(() => accounts.id), // investor
  unitReference: text("unit_reference").notNull(),
  status: text("status").notNull().default("available"),
});

export const milestones = pgTable("milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  unitId: uuid("unit_id").references(() => units.id), // null = milestone de proyecto
  name: text("name").notNull(),
  sequenceOrder: integer("sequence_order").notNull(),
  state: milestoneState("state").notNull().default("pending"),
  validationCritical: boolean("validation_critical").notNull().default(false),
  certifierId: uuid("certifier_id").references(() => certifiers.id),
  certifiedAt: timestamp("certified_at"),
});

export const evidenceBundles = pgTable("evidence_bundles", {
  id: uuid("id").primaryKey().defaultRandom(),
  milestoneId: uuid("milestone_id").notNull().references(() => milestones.id),
  bundleCommitmentHash: text("bundle_commitment_hash").notNull(), // merkle root hex
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const evidenceItems = pgTable("evidence_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  bundleId: uuid("bundle_id").references(() => evidenceBundles.id),
  milestoneId: uuid("milestone_id").notNull().references(() => milestones.id),
  evidenceType: text("evidence_type").notNull(),
  category: text("category").notNull(), // ver taxonomía abajo
  authoritative: boolean("authoritative").notNull().default(false),
  sha256Hash: text("sha256_hash").notNull(),
  storageKey: text("storage_key").notNull(), // key S3, nunca pública
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedBy: uuid("uploaded_by").notNull().references(() => accounts.id),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const onchainEvents = pgTable("onchain_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: onchainEventType("event_type").notNull(),
  txId: text("tx_id").notNull().unique(),
  blockTimestamp: timestamp("block_timestamp"),
  milestoneId: uuid("milestone_id").references(() => milestones.id),
  bundleId: uuid("bundle_id").references(() => evidenceBundles.id),
  evidenceId: uuid("evidence_id").references(() => evidenceItems.id),
  payload: jsonb("payload").notNull(), // metadata anclada (solo commitments)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: text("category").notNull(), // auth | project | evidence | milestone | governance
  action: text("action").notNull(),
  actorId: uuid("actor_id").references(() => accounts.id),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}); // append-only: sin UPDATE/DELETE; enforced por rol de DB o trigger

// + project_memberships, invitations, contracts, releases,
//   notifications, favorites, dossier_share_tokens (mismos patrones)
```

## Taxonomía de evidencia (aprobada)

| Categoría (`category`) | Ejemplos | Fuente típica | Método de prueba |
|---|---|---|---|
| `technical_plans` | planos, versiones aprobadas | developer/arquitecto | hash por archivo; commitment de bundle anclado |
| `site_progress` | fotos, reportes fechados | developer/equipo de obra | bundle anclado con timestamp |
| `certifications` | certificados, informes de inspección | certificador profesional | evidencia firmada + fingerprints anclados |
| `permits` | permisos y aprobaciones municipales | autoridad gubernamental | fingerprints anclados + metadata de procedencia |
| `subdivision` | documento de subdivisión | developer | documento commiteado y anclado |

Restricciones de intake: whitelist de MIME (pdf, png, jpg, webp, docx), tamaño máx configurable (default 25 MB), antivirus opcional en pipeline.
