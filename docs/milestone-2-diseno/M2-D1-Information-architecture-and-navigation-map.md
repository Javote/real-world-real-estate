# Information Architecture & Navigation Map

## Conventions

### Role abbreviations

Code | Role | Real-world responsibility

INV | Investor / Buyer | Acquires a unit under construction; tracks progress and evidence.

DEV | Developer | Builds the project; uploads evidence; manages contracts and releases.

NOT | Notary (Escribano) | Reviews and signs final dossiers prior to deed and registration.

CER | Certifier | Verifies construction stages technically; certifies or observes evidence.

---

## System Overview

### Public vs authenticated surface

Surface: Public

What it exposes: Multi-role login portal (Investor /
Developer / Notary / Certifier tabs).
Future: public dossier preview links.

Auth requirement: None

Surface: Authenticated

What it exposes: All role panels, navigation, modals,
evidence views, dossiers, audit logs.

Auth requirement: AuthGuard with role-scoped patterns
(INVESTOR_ROLES, DEV_ROLES, NOTARY_ROLES,CERTIFIER_ROLES).

---

## Primary platform characteristics

• Mobile-first design with portrait-oriented primary layouts; responsive desktop layout swaps bottom-nav for a left sidebar and uses multi-column grids.

• Bilingual surface — Spanish (es-AR voseo, default) and English (en-US). Language toggle visible on the login screen and on every profile screen across all four roles.

• Maquette uses mock blockchain interactions (mockHash, mockTxid). All TXIDs and Merkle roots displayed are placeholders; real anchoring is Milestone 3 scope.

• Notifications are role-scoped and category-filtered (Construction progress, Documents, Payments, etc.). The unread count is surfaced via NotificationBell in role headers.

---

## Permission tokens

Token: R | W | A | —

Meaning: Read. Role can view this resource. | Write. Role can create or modify this resource. | Act. Role can perform a state-changing action (anchor, certify, sign, release, accept, observe). | — (no access at this scope).

### Role Permission Matrix

| Resource | INV | DEV | NOT | CER | Scope notes |
|---|---:|---:|---:|---:|---|
| Project (own) | — | R W | — | — | Developer manages own portfolio. |
| Project (browsing public listings) | R | — | — | — | Investor sees pre-construction and delivered projects on Buy surface. |
| Unit (assigned) | R | R W | — | — | Investor sees only their own unit; developer manages all units in their projects. |
| Unit (manage all in project) | — | R W | — | — | Developer-only resource for portfolio management. |
| Invitation | R A | W | — | — | Developer issues; investor accepts or declines. |
| Construction stage | R | R W | — | R A | Developer defines and progresses; certifier certifies or observes. |
| Evidence bundle (per stage) | R | W A | R | R | Developer uploads and anchors; certifier and notary read to verify. |
| Document (registry, permits, certificates) | R | R W | R | R | All authenticated roles can view verified documents. |
| Contract (per investor unit) | R | R W | R | — | Notary reviews as part of dossier; visible to assigned investor. |
| Payment release (per stage) | R | A | — | — | Developer triggers release after stage certification. |
| Stage certification | — | — | — | A | Certifier-exclusive action. |
| Stage observation (rejection) | — | R | — | A | Certifier sends observations back to developer. |
| Final dossier compilation | R | — | — | — | System-assembled; investor owns and shares. |
| Final dossier signing | R | — | A | — | Notary verify-and-sign action. |
| Audit log (own scope) | R | R | — | — | Investor sees own events; developer sees project-scoped events. |
| Profile and notification preferences | R W | R W | R W | R W | All roles manage their own profile. |

Legend: R = read, W = create or modify, A = act/state change, — = no access.

---

## Navigation Map by Role: Investor

### Bottom navigation


| #   | Tab       | Purpose                                                                                                        |
| --- | --------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Menu      | Aggregator: Explore (Buy, Map, Favorites), My Account (Profile, Notifications), Information (Security, Help), View mode, Log out. |
| 2   | Favorites | Saved projects.                                                                                                  |
| 3   | **Buy**   | Center action — primary landing. Browse all available projects with map / search / filter modes.               |
| 4   | Units     | My Units — investor's portfolio of acquired units with progress and dossier access.                            |
| 5   | User      | Profile and account preferences. 


### Screen tree

| Path | Screen / modal | Proofs |
|---|---|---|
| **Buy (tab 3)** | Browse listings with NotificationBell + unread badge in header. | — |
| Buy → Map | Geo view; project popovers with View project CTA. | — |
| Buy → Search | Search by zone with typeahead. | — |
| Buy → Filters | Filter by status (Pre-construction / Under construction / Delivered) and sort. | — |
| /project/:projectId | Project detail: gallery, developer card with rating, price summary, map, Verified Documentation summary, Progress timeline. | Verified docs, progress |
| /project/:projectId/progress | All construction stages with photo and document counts per stage. | Stage state |
| /project/:projectId/stage/:stageId | Stage detail: photographic evidence with GPS + timestamp; supporting documentation with VerificationBadge; document viewer. | Verified badge, GPS + time, doc hash |
| Developer profile (linked from project) | Developer reputation: years in business, projects delivered, previous projects, active projects. | — |
| **Favorites (tab 2)** | My Favorites — saved projects with full info. | — |
| **Units (tab 4)** | My Units — portfolio summary (total invested, units, projects, avg progress) and list of unit cards. | — |
| /unit/:unitId | Acquired unit detail: gallery, location map, "View my Unit in the building" CTA, developer link, unit details, status, progress timeline, news. | Progress timeline |
| /unit/:unitId → ImageGallery | Modal: full-screen photo carousel. | — |
| /unit/:unitId → LocationMap | Modal: full-screen interactive map. | — |
| /unit/:unitId → BuildingSchematic | Modal: building grid showing user's unit position highlighted vs occupied vs available. | — |
| /unit/:unitId/notifications | Notification inbox with category filters and read state. | — |
| /unit/:unitId/contract | My contract and payments: contract summary with HashChip, payment schedule, Releases by Stage with per-stage TXID HashChips. | Contract hash, stage TXIDs |
| /unit/:unitId/contract → TxidModal | Modal: Blockchain verification — anchoring date, TXID, View in explorer. | Full TXID |
| /unit/:unitId/stage/:stageId | Stage milestone modal: verified documents per stage with file hashes + Package Merkle root. | File hashes, Merkle root |
| /unit/:unitId/dossier | Final dossier: Cryptographic Certification with Dossier Hash; Dossier Completeness; Project and Unit Summary; Milestones Timeline (all 10 stages); Blockchain Traceability per milestone; Document Index. | Dossier hash, per-milestone hashes |
| /unit/:unitId/dossier → ShareModal | Modal: share read-only link with third parties (notaries, banks). | — |
| **User (tab 5)** | Profile: avatar, role pill, edit, notification preferences (per-category toggles), security (change password), log out. Language toggle in header. | — |
| **Menu (tab 1)** | Aggregator menu with Explore, My Account, Information sections plus view-mode selector and log-out. Language toggle in header. | — |
| **Notifications (header bell)** | Reachable from Buy and Menu headers via NotificationBell. Invitation appears pinned as a special purple-accent card. | Anchored invitation |
| Notifications → InvitationAcceptModal | Modal: project, assigned unit, total amount, estimated handover, payment schedule summary, "Anchored on-chain" tag, Decline / Accept. | Anchored badge |

---

## Navigation Map by Role: Developer

### Bottom navigation


| # | Tab | Purpose |
|---|-----|---------|
| 1 | **Panel** | Developer dashboard — primary landing. KPI overview and entry point to New project. |
| 2 | Projects | My Projects list with status badges. |
| 3 | Capital | Capital raised dashboard with charts and per-project breakdown. |
| 4 | Units | Cross-project unit inventory. |
| 5 | Progress | Construction progress dashboard across portfolio. |


### Screen Tree

| Path | Screen / modal | Proofs |
|---|---|---|
| **Panel (tab 1)** | Developer KPI grid: New project CTA, Active Projects, Capital Raised, Total Units, Average Progress, Verified Documents, Active Investors, Verified events anchored on-chain. | Verified docs count, anchored events count |
| /developer/project/new | New project form: name, location with map preview, number of units, estimated delivery date, Stage template (Standard, 10 stages), Create project. | — |
| **Projects (tab 2)** | My Projects list: cards per project with status pills (Pre-construction / Under construction / Delivered) and Construction progress bar. | Stage state |
| /developer/project/:projectId | Project detail with 4 action cards (Manage units, Invite investor, Upload evidence, View contracts) and 3 stat cards (Progress, Capital, Investors). | — |
| /developer/project/:projectId/units | Manage units: stats (Total, Sold, Reserved, Available), Add unit form, populated unit list with status pills and assigned investor. | — |
| /developer/project/:projectId/invite | Invite investor form: email, name, assigned unit (select), amount, Send invitation. | — |
| /developer/project/:projectId/upload | Upload evidence: stage selector (1-10), file drop zone, notes, Anchor evidence. | — |
| Upload → AnchoringSuccessModal | Modal: Evidence anchored — Merkle root + TXID + View on explorer. | Merkle root, TXID |
| /developer/project/:projectId/contracts | Contracts and releases: stats (Active, Released, In dispute), per-investor cards with stage-release HashChips and Release stage N payment CTA. | Stage-release TXIDs |
| **Capital (tab 3)** | Capital Raised dashboard: total raised, Monthly evolution bar chart, By Project breakdown with share-of-total bars. | — |
| **Units (tab 4)** | Cross-project units: Total / Sold / Available stats, per-project breakdown with occupancy bars. | — |
| **Progress (tab 5)** | Construction Progress: stage counts (Completed, In progress, Pending), Overall Progress bar, full stage detail per project with completion pills. | Stage state |
| /developer/documentation | Documentation: verified-on-blockchain section with full hash chips per document; Pending Verification section. | Full document hashes |
| /developer/investors | Investors list: stats (Active, Pending, Completed), per-investor cards with investment, assigned unit, project link. | — |
| /developer/audit-log | Audit log: filter tabs (All / Stages / Documents / Releases / Signatures), per-event cards with timestamp, role pill, category pill, TXID HashChip. | Per-event TXIDs |
| Audit log → TxidModal | Modal: Blockchain verification for the selected event. | Full TXID |


---

## Navigation Map by Role: Notary

### Bottom navigation

| # | Tab | Purpose |
|---|---|---|
| 1 | Panel | Notary dashboard with workload KPIs and pending review queue. |
| 2 | Dossiers | Pending dossiers for review and signing. |
| 3 | Signed | Signature history. |
| 4 | Profile | Notary identity, credentials & license, settings. |

### Screen Tree

| Path | Screen / modal | Proofs |
|---|---|---|
| Panel (tab 1) | Notary Panel KPI grid: Pending dossiers, Verified, Signed, Units under review. List of Dossiers pending review with completeness bars and Review CTA. | — |
| /notary/dossier/:dossierid | Dossier review: investor identification (ID, proof of address, sworn declaration), unit legal documentation (sale agreement, subdivision plan, land registry report), financial documentation. Reject and Verify-and-sign actions. | Dossier hash |
| Signed (tab 3) | Signed dossiers history: per-dossier card with date, dossier hash and signature TXID HashChips. | Dossier hash, signature TXID |
| Profile (tab 4) | Notary profile: personal information, credentials & license, notifications, settings, log out. | — |

---

## Navigation Map by Role: Certifier

### Bottom Navigation

| # | Tab | Purpose |
|---|---|---|
| 1 | Panel | Certifier dashboard with workload and assigned stages. |
| 2 | Assigned | Stages awaiting certification. |
| 3 | Issued | Issued certificates history. |
| 4 | Profile | Certifier identity and credentials. |

### Screen Tree

| Path | Screen / modal | Proofs |
|---|---|---|
| Panel (tab 1) | Certifier Panel KPI grid: Assigned, Certified, Observed, Total stages. Assigned stages list with per-stage Certify CTA. | — |
| /certifier/stage/:stageId | Certify stage: stage info, assigned-to, evidence uploaded by the developer (empty state shown when none anchored yet), Observe and Certify actions. | — |
| Certify stage → ObserveModal | Modal: Observe stage — observations textarea, Cancel / Send. | — |
| Issued (tab 3) | Issued certificates: per-certificate card with stage label, date, certificate hash and TXID HashChips, Certified pill. | Certificate hash, TXID |

---

## Cross-role Flows

### Onboarding flow — invitation to acceptance

| Step | Role | Screen | Action | Proof emitted |
|------|------|--------|--------|---------------|
| 1 | DEV | Developer Panel → New project | Defines project, units, and 10-stage template. | — |
| 2 | DEV | Project detail → Manage units | Adds units to the project inventory. | — |
| 3 | DEV | Project detail → Invite investor | Sends invitation with assigned unit and amount. | Invitation anchor |
| 4 | INV | Notifications | Sees invitation as pinned purple-accent notification card with View invitation CTA. | Anchored badge |
| 5 | INV | InvitationAcceptModal | Reviews terms, accepts. | Acceptance event |
| 6 | INV | My Units → Unit detail | Unit now appears in investor's portfolio with progress timeline visible. | — |

### Evidence flow — upload → certify → release

| Step | Role | Screen | Action | Proof emitted |
|------|------|--------|--------|---------------|
| 1 | DEV | Project detail → Upload evidence | Selects stage, uploads files, anchors. | File hashes |
| 2 | DEV | AnchoringSuccessModal | Confirmation surface shows the cryptographic record. | Merkle root + TXID |
| 3 | INV | Notifications | Receives "Construction progress — stage verified" notification. | — |
| 4 | CER | Certifier Panel → Certify stage | Reviews evidence; either Certifies or Observes. | Certificate hash + TXID |
| 5 | DEV | Project detail → Contracts and releases | After certification, Release stage N payment is enabled. | Stage-release TXID |
| 6 | INV | Unit → Contract and payments | Sees stage-release TXID listed under Releases by Stage. | Same TXID surfaced |
| 7 | DEV | Audit log | Three audit-log events are recorded for the cycle: evidence upload, certification, release. | Three TXIDs indexed |

### Closing flow — dossier compilation to notary signing

| Step | Role | Screen | Action | Proof emitted |
|------|------|--------|--------|---------------|
| 1 | System | — | Aggregates all stage proofs, contract hash, and documents into a Final Dossier when project nears completion. | Dossier hash |
| 2 | INV | Unit → Dossier | Reviews dossier completeness; can Share read-only link or Export PDF. | — |
| 3 | NOT | Notary Panel → Dossier review | Reviews investor identification, legal documentation, and financial documentation sections. | — |
| 4 | NOT | Dossier review → Verify and sign | Verifies and signs; or Rejects with observations. | Signature TXID |
| 5 | NOT | Signed dossiers | Signed dossier appears in history with dossier hash and signature TXID. | Both surfaced |
| 6 | DEV | Audit log | Signature event is logged with role pill "escribano" and category pill "firma". | Signature TXID |

---

## Authentication and Role Gating

### Login surface

• Single login page with four role tabs: Investor / Developer / Notary / Certifier.

• Each tab presents the same form (username + password) but on submission routes to the role-
appropriate panel.

• The language toggle is visible in the top-right corner of the login screen so locale can be set
before authentication.

### AuthGuard role groups

Routes are wrapped in an AuthGuard component which accepts a roles= pattern matching one of these named groups. Each group is treated as canonical for that role:

| Role group | Code identifier | Used for |
|---|---|---|
| Investor | INVESTOR_ROLES | All /investor/* routes plus public Buy surface. |
| Developer | DEV_ROLES | All /developer/* routes. |
| Notary | NOTARY_ROLES | All /notary/* routes. |
| Certifier | CERTIFIER_ROLES | All /certifier/* routes. |

### Cross-role data isolation

• Investors only see units assigned to them; the My Units list cannot expose other investors' units.

• Developers only see projects owned by their organization; cross-developer access is not exposed by the navigation.

• Notaries see dossiers assigned for their review; signed-history is scoped to their own signatures.

• Certifiers see stages explicitly assigned to them; issued-certificates history is scoped to their own
certifications.

---

## Cross-cutting concerns

### Reusable navigation components

The following components anchor the navigation surface across all four roles. Full specifications are in (Component Library Documentation); this list maps each component to where it appears in navigation.

| Component | Navigation role | Roles |
|---|---|---|
| GradientHeader | Purple gradient header with Back button and screen title. Appears on every screen. | All |
| BottomNav | Role-scoped bottom navigation; tab count and labels vary by role. Hides on desktop responsive layout in favor of left sidebar. | All |
| NotificationBell | Header-mounted bell with unread badge; tapping opens the role's notifications page. | INV (Buy, Menu) |
| LanguageToggle | ES / EN switch; persists in localStorage under propnexus.lang. | Login + Profile (all roles) |
| StatusPill | Consistent state-indicator pill (Pre-construction, Verified, Pending, Sold, Active, Released, etc.). Helps users orient within navigation. | All |
| HashChip | Truncated hex chip with copy-icon; used wherever a TXID, Merkle root, or document hash needs to be referenced in-line. | All |
| VerificationBadge | Teal "Verified" pill on documents and stages whose hash is anchored. | All |
| TxidModal | Blockchain-verification modal with full TXID and View in explorer link. | INV, DEV |
| AncoringSuccessModal | Post-anchor confirmation with Merkle root + TXID. | DEV |


### Responsive behavior

• Mobile-first portrait is the primary surface for all four roles; every flow is designed to work on a single-column ~380px viewport.

• On desktop viewports the BottomNav is replaced by a left sidebar containing the same items in the same order; content area expands to multi-column grids where appropriate. 

• All transactional flows (upload evidence, accept invitation, sign dossier, certify stage) work identically on both surfaces.

### Localization

• Default locale is es-AR (voseo register). en-US is the secondary locale.

• Locale persists in localStorage under propnexus.lang.

• Locale-aware formatters are used for currency (US$), dates, and relative-time strings.

• The language toggle is visible on the login screen header and on every role's profile screen so locale can be changed at any time.

### Notifications model

• Notifications are role-scoped: each role sees only events relevant to its surface.

• Categories surfaced for the investor: Construction progress, Documents, Payments, Schedule changes, Developer messages, Project invitation. Investor profile exposes per-category toggles
for opting out.

• Project invitations are surfaced as a special purple-accent card distinct from regular notifications; the rest of the card list uses neutral background.

• NotificationBell is mounted in the role's primary headers (e.g. Investor Buy, Menu) and reflects the unread count.
