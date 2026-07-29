# UI Implementation Plan

Backlog mapping every screen and component in the Milestone 2 design package to its API or smart-
contract endpoint and test identifier, scheduled for the Milestone 3 build.

1. Purpose and SOM mapping
This document is the UI Implementation Plan for the Milestone 3 build. It catalogues every screen and
component produced during Milestone 2 and maps each to its API or smart-contract endpoint and to a
unique test identifier. Together with the design package (Deliverable #1), component library
(Deliverable #3), and UX documentation (Deliverable #4), it defines exactly what M3 must implement
and how each surface will be verified.
SOM acceptance criteria addressed
Output (item 5): UI Implementation Plan: backlog mapping screens/components → API/contract
endpoints → test IDs; build scheduled in Milestone 3.
Acceptance (item 5): UI Implementation Plan is approved (pilot developer + notary); each component
lists its endpoint/test ID and Milestone-3 build reference.
Evidence (item 5): Plan file (PDF/MD) in the repo + brief approval note; cross-link to Milestone 3: UI
Implementation & Integration.

---

2. Conventions
2.1 Backlog entry shape
Each backlog entry binds one surface (screen or modal from D1 §5) to its build artifacts. Every entry
has the same six fields:

• ID — screen identifier from the D1 §9 screenshot index. Ranges (e.g. 26-29) indicate a multi-
screen surface.

• Surface / path — the route or modal name. Routes use Wouter notation per D1 §2.
• Components — components from D3 §5 used on this surface.
• Endpoint(s) — HTTP method + path consumed or emitted. Endpoints that produce on-chain
artifacts are annotated with the artifact type (TXID, Merkle root, certificate hash, signature TXID).
• Test ID(s) — unique identifiers used in automated and manual M3 testing. Naming scheme:
ROLE-AREA-ACTION-NNN (e.g. INV-DOSSIER-VIEW-001).
• M3 build ref — the M3 work stream that implements this surface. Refs use M3-BE-NN (backend),
M3-SC-NN (smart contract), or M3-FE-NN (frontend). Full glossary in §7.
• Pat — proof-rendering pattern from D4 §5 if applicable. Patterns P1–P10 are defined in D4.
2.2 Endpoint conventions
• Base URL: /api/v1 (omitted from cells for brevity).
• Authentication: all endpoints except POST /auth/login and GET
/public/dossier/:shareToken require an authenticated session scoped by AuthGuard role
groups (D1 §7.2).
• Hash transport: full hashes always reach the client; client truncates for display per D4 §8.2.

• Locale: server returns translation keys; client renders per active locale (es-AR or en-US) per D4
§8.2.
• On-chain anchoring: client-initiated user actions; back end submits to Cardano; client awaits
success with TXID/Merkle root in the same response (D4 §8.2).
2.3 Test ID scheme
Format: ROLE-AREA-ACTION-NNN. ROLE is one of INV/DEV/NOT/CER/AUTH. AREA is the screen
group (BUY, UNIT, DOSSIER, EVIDENCE, etc.). ACTION is the verb (VIEW, LIST, CREATE,
ANCHOR, SIGN, etc.). NNN is a zero-padded sequence within (ROLE, AREA). IDs are globally unique.

---

2.4 Pattern legend (from D4 §5)
ID | Pattern | Purpose
P1 | VerificationBadge | Binary anchored/not signal
P2 | HashChip | Inline truncated hex reference
P3 | TxidModal | Full TXID + explorer link
P4 | AnchoringSuccessModal | Post-anchor confirmation (Merkle + TXID)
P5 | Merkle root | Bundle integrity + per-file hashes
P6 | Audit log | Append-only event ledger
P7 | Verified watermark | Diagonal stamp on document render
P8 | Dossier | Compiled-proof artifact with master hash
P9 | Stage anchoring chips | Per-stage on-chain state indicator
P10 | Per-release financial proof | Stage-release TXIDs

---

3. Architectural assumptions
This plan makes the following defaults where the M2 design package did not specify. Each must be
confirmed or overridden before sign-off.
[ASSUMPTION] REST over HTTPS with JSON request/response bodies. Base path /api/v1/. Endpoint paths are
scoped by role group where appropriate (/investor/, /developer/, /notary/, /certifier/).

[ASSUMPTION] Cardano explorer URL is environment-configurable via a single template variable
$EXPLORER_BASE; client builds $EXPLORER_BASE/tx/:txid for all explorer links (D4 §8.1, Pattern 3).
[ASSUMPTION] Evidence file storage is back-end managed (S3 or compatible). Files are not stored on-chain;
only Merkle roots are anchored per D4 §5 (Pattern 5). File hashes are computed back-end on upload and
returned to the client.
[ASSUMPTION] Dossier compilation is on-demand from authoritative back-end state. The dossier hash is
computed at the moment of fetch and is stable as long as the underlying anchored artifacts have not changed (D4
§4.4).
[ASSUMPTION] Audit log is a back-end append-only event ledger. Each event references the on-chain TXID that
produced it. The ledger is queryable; the chain is the source of truth (D4 §5, Pattern 6).
[ASSUMPTION] Notification delivery is server-driven with optional push (M3 may opt for polling on a 30-second
interval as the M3-FE-07 default; push is out of scope for M3).
[ASSUMPTION] All anchoring actions (invitation accept, evidence upload, certify, sign, release) submit to the
same Cardano network; environment selection (preprod for M3 pre-prod, mainnet for the Final Milestone) is
configuration.
[ASSUMPTION] Role profile endpoint is shared across roles. /profile and /profile/notifications operate on the
authenticated user regardless of role; role-specific fields (notary credentials, certifier credentials) are nested per
role.
[ASSUMPTION] Smart contract: per M1 architecture, a Plutus V2 state machine handles invitation acceptance,
evidence anchoring, certification, release, and signature commits. M3-SC-01 through M3-SC-06 are the six
logical operations that map to that state machine.

---

# 4. Backlog — Investor surfaces

24 backlog entries covering the investor's primary surfaces (Buy, Favorites, Units, User, Menu) and all reachable detail screens and modals per D1 §5.1.

| ID | Surface / path | Components (D3 §5) | Endpoint(s) | Test ID(s) | M3 build ref | Pat |
|---|---|---|---|---|---|---|
| 01 | `/login` (multi-role) | GradientHeader, LanguageToggle, TextInput, PrimaryButton | POST `/auth/login`<br>GET `/auth/me` | AUTH-LOGIN-001<br>AUTH-ME-001 | M3-BE-01<br>M3-FE-01 | — |
| 02 | `/investor/buy` (listing) | ProjectCard, NotificationBell, BottomNav, GradientHeader | GET `/projects?status=`<br>GET `/notifications/unread-count` | INV-BUY-LIST-001 | M3-BE-02<br>M3-FE-02 | — |
| 03 | `/investor/buy?view=map` | ProjectCard (popover), LocationMapModal | GET `/projects?bbox=` | INV-BUY-MAP-001 | M3-BE-02<br>M3-FE-02 | — |
| 04 | `/investor/buy?view=search` | TextInput (typeahead), ProjectCard | GET `/projects?q=` | INV-BUY-SEARCH-001 | M3-BE-02<br>M3-FE-02 | — |
| 05 | `/investor/buy?view=filter` | FilterPill, SelectDropdown | GET `/projects?status=&sort=` | INV-BUY-FILTER-001 | M3-BE-02<br>M3-FE-02 | — |
| 06-07 | `/project/:projectId` | ImageGalleryModal, ProgressTimeline, DocumentCard, VerificationBadge, LocationMapModal | GET `/projects/:id`<br>GET `/projects/:id/documents` | INV-PROJECT-DETAIL-001<br>INV-PROJECT-DOCS-002 | M3-BE-03<br>M3-FE-03 | P1, P2 |
| 08 | `/project/:projectId/progress` | ProgressTimeline, StatusPill, StatCard | GET `/projects/:id/stages` | INV-PROJECT-STAGES-001 | M3-BE-04<br>M3-FE-04 | — |
| 09-12 | `/project/:projectId/stage/:stageId` | DocumentCard, VerificationBadge, ImageGalleryModal, DocumentViewerModal, HashChip | GET `/projects/:id/stages/:stageId`<br>GET `/evidence/:bundleId` | INV-STAGE-DETAIL-001<br>INV-STAGE-DOCVIEW-002 | M3-BE-04<br>M3-FE-04 | P1, P2, P7 |
| 13 | `/investor/favorites` | ProjectCard (heart filled) | GET `/investor/favorites`<br>POST `/investor/favorites/:projectId`<br>DELETE `/investor/favorites/:projectId` | INV-FAV-LIST-001<br>INV-FAV-TOGGLE-002 | M3-BE-05<br>M3-FE-05 | — |
| 14 | `/investor/units` (My Units) | UnitCard, StatCard, BottomNav | GET `/investor/units` | INV-UNITS-LIST-001 | M3-BE-06<br>M3-FE-06 | — |
| 15-18 | `/investor/unit/:unitId` | ProgressTimeline, ImageGalleryModal, UnitCard, StageChip (10x) | GET `/investor/units/:id`<br>GET `/investor/units/:id/news` | INV-UNIT-DETAIL-001<br>INV-UNIT-NEWS-002 | M3-BE-06<br>M3-FE-06 | P9 |
| 19 | Unit gallery modal | ImageGalleryModal | GET `/investor/units/:id` (images[]) | INV-UNIT-GALLERY-001 | M3-FE-06 | — |
| 20 | Unit location modal | LocationMapModal | GET `/investor/units/:id` (geo) | INV-UNIT-LOC-001 | M3-FE-06 | — |
| 21 | Building schematic modal | BuildingSchematic | GET `/projects/:id/building-schematic` | INV-UNIT-BUILDING-001 | M3-BE-06<br>M3-FE-06 | — |
| 22 | `/investor/unit/:unitId/notifications` | NotificationCard, FilterPill (categories) | GET `/investor/notifications?unitId=&category=`<br>PATCH `/notifications/:id/read` | INV-NOTIF-UNIT-001<br>INV-NOTIF-READ-002 | M3-BE-07<br>M3-FE-07 | — |
| 23-24 | `/investor/unit/:unitId/contract` | HashChip, StatusPill, StageChip | GET `/investor/contracts/:unitId`<br>GET `/contracts/:contractId/releases` | INV-CONTRACT-VIEW-001<br>INV-RELEASES-LIST-002 | M3-BE-08<br>M3-FE-08 | P2, P10 |
| 25v | TXID verification modal | TxidModal, HashChip | Client-side: `$EXPLORER_BASE/tx/:txid` | INV-TXID-MODAL-001 | M3-FE-09 | P3 |
| 25m | Stage milestone modal (per-file hashes + Merkle root) | DocumentCard, HashChip, Merkle root display | GET `/evidence/:bundleId/files`<br>GET `/evidence/:bundleId/proof/:fileHash` | INV-STAGE-MILESTONE-001<br>INV-MERKLE-PROOF-002 | M3-BE-13<br>M3-FE-04 | P5 |
| 26-29 | `/investor/unit/:unitId/dossier` | HashChip, VerificationBadge, ProgressTimeline, DocumentCard | GET `/investor/units/:id/dossier`<br>GET `/investor/units/:id/dossier/export.pdf` | INV-DOSSIER-VIEW-001<br>INV-DOSSIER-EXPORT-002 | M3-BE-12<br>M3-FE-10 | P8 |
| 28s | Share dossier modal | ShareDossierModal, PrimaryButton | POST `/investor/units/:id/dossier/share`<br>GET `/public/dossier/:shareToken` | INV-DOSSIER-SHARE-001<br>INV-DOSSIER-PUBLIC-002 | M3-BE-12<br>M3-FE-10 | P8 |
| 30 | `/investor/profile` | ToggleSwitch, LanguageToggle, DangerButton, TextInput | GET `/profile`<br>PATCH `/profile`<br>PATCH `/profile/notifications` | INV-PROFILE-VIEW-001<br>INV-PROFILE-EDIT-002<br>INV-NOTIF-PREFS-003 | M3-BE-09<br>M3-FE-11 | — |
| 31-32 | `/investor/menu` | ActionCard (aggregator), BottomNav | n/a (client routing) | INV-MENU-001 | M3-FE-12 | — |
| 62 | `/investor/notifications` | NotificationCard, InvitationCard, FilterPill | GET `/investor/notifications`<br>PATCH `/notifications/:id/read` | INV-NOTIF-LIST-001 | M3-BE-07<br>M3-FE-07 | — |
| 63 | Invitation accept modal | InvitationAcceptModal, PrimaryButton, SecondaryButton, HashChip | GET `/investor/invitations/:id`<br>POST `/investor/invitations/:id/accept` (→ TXID)<br>POST `/investor/invitations/:id/decline` | INV-INVITE-VIEW-001<br>INV-INVITE-ACCEPT-002<br>INV-INVITE-DECLINE-003 | M3-BE-10<br>M3-SC-01<br>M3-FE-13 | — |

---

# 5. Backlog — Developer surfaces

17 backlog entries covering the developer's primary surfaces (Panel, Projects, Capital, Units, Progress) plus secondary surfaces (Documentation, Investors, Audit log, Profile) per D1 §5.2.

| ID | Surface / path | Components (D3 §5) | Endpoint(s) | Test ID(s) | M3 build ref | Pat |
|---|---|---|---|---|---|---|
| 33-34 | `/developer` (Panel) | StatCard, ActionCard (featured), NotificationBell, GradientHeader | GET `/developer/kpis`<br>GET `/notifications/unread-count` | DEV-PANEL-KPIS-001 | M3-BE-11<br>M3-FE-14 | — |
| 34b-34c | `/developer/project/new` | TextInput, NumberInput, SelectDropdown, PrimaryButton, LocationMapModal | POST `/developer/projects` | DEV-PROJECT-CREATE-001 | M3-BE-03<br>M3-FE-15 | — |
| 35-36 | `/developer/projects` | ProjectCard, StatusPill, ProgressTimeline (inline) | GET `/developer/projects` | DEV-PROJECTS-LIST-001 | M3-BE-03<br>M3-FE-15 | — |
| 37 | `/developer/project/:projectId` | ActionCard (4-grid), StatCard (3x) | GET `/developer/projects/:id` | DEV-PROJECT-DETAIL-001 | M3-BE-03<br>M3-FE-15 | — |
| 44b | `/developer/project/:projectId/units` | UnitCard (dev variant), StatusPill, TextInput, NumberInput, PrimaryButton | GET `/developer/projects/:id/units`<br>POST `/developer/projects/:id/units`<br>PATCH `/developer/units/:id` | DEV-UNITS-LIST-001<br>DEV-UNIT-CREATE-002<br>DEV-UNIT-UPDATE-003 | M3-BE-06<br>M3-FE-16 | — |
| 39 | `/developer/project/:projectId/invite` | TextInput, SelectDropdown (unit), NumberInput (amount), PrimaryButton | POST `/developer/projects/:id/invitations` (→ anchor TXID) | DEV-INVITE-CREATE-001 | M3-BE-10<br>M3-SC-01<br>M3-FE-17 | — |
| 38, 44c | `/developer/project/:projectId/upload` | SelectDropdown (stage), FileDropzone, TextArea, PrimaryButton, StageChip (1-10) | POST `/developer/projects/:id/stages/:stageId/evidence` (multipart, → Merkle + TXID) | DEV-EVIDENCE-UPLOAD-001 | M3-BE-13<br>M3-SC-02<br>M3-FE-18 | P4, P5 |
| 44d | Anchoring success modal | AnchoringSuccessModal, HashChip (Merkle + TXID), PrimaryButton | (returned in upload response) Client-side: `$EXPLORER_BASE/tx/:txid` | DEV-ANCHOR-SUCCESS-001 | M3-FE-18 | P4, P5 |
| 40-41 | `/developer/project/:projectId/contracts` | HashChip, StatusPill, PrimaryButton, StatCard (3x) | GET `/developer/projects/:id/contracts`<br>POST `/developer/contracts/:id/releases/:stageNum` (→ TXID) | DEV-CONTRACTS-LIST-001<br>DEV-RELEASE-EXECUTE-002 | M3-BE-08<br>M3-SC-03<br>M3-FE-19 | P10 |
| 42-43 | `/developer/capital` | StatCard, Chart (monthly + per-project) | GET `/developer/capital/summary`<br>GET `/developer/capital/monthly`<br>GET `/developer/capital/by-project` | DEV-CAPITAL-SUMMARY-001<br>DEV-CAPITAL-MONTHLY-002 | M3-BE-11<br>M3-FE-20 | — |
| 44 | `/developer/units` (cross-project) | StatCard, UnitCard (compact), occupancy bars | GET `/developer/units` | DEV-UNITS-INVENTORY-001 | M3-BE-06<br>M3-FE-16 | — |
| 45 | `/developer/progress` | ProgressTimeline, StatCard, StatusPill (per-stage) | GET `/developer/progress` | DEV-PROGRESS-001 | M3-BE-04<br>M3-FE-21 | — |
| 46-47 | `/developer/documentation` | DocumentCard, HashChip, VerificationBadge, StatusPill (Pending) | GET `/developer/documents?status=`<br>POST `/developer/documents` (anchor) | DEV-DOCS-LIST-001<br>DEV-DOC-ANCHOR-002 | M3-BE-14<br>M3-SC-06<br>M3-FE-22 | P1, P2 |
| 48 | `/developer/investors` | InvestorCard, StatCard, StatusPill | GET `/developer/investors` | DEV-INVESTORS-LIST-001 | M3-BE-15<br>M3-FE-23 | — |
| 49 | `/developer/audit-log` | AuditEventCard, FilterPill (5 categories), HashChip, CategoryChip | GET `/developer/audit-log?category=&cursor=` (paginated) | DEV-AUDIT-LIST-001<br>DEV-AUDIT-FILTER-002 | M3-BE-16<br>M3-FE-24 | P6 |
| 50 | Audit verification modal | TxidModal, HashChip | Client-side: `$EXPLORER_BASE/tx/:txid` | DEV-AUDIT-VERIFY-001 | M3-FE-24 | P3 |
| dev-prof | `/developer/profile` (implied) | ToggleSwitch, LanguageToggle, DangerButton, TextInput | GET `/profile`<br>PATCH `/profile`<br>PATCH `/profile/notifications` | DEV-PROFILE-001 | M3-BE-09<br>M3-FE-11 | — |

---

# 6. Backlog — Notary and Certifier surfaces

## 6.1 Notary

6 backlog entries covering Panel, Dossier review (view + sign + reject), Signed history, and Profile per D1 §5.3.

| ID | Surface / path | Components (D3 §5) | Endpoint(s) | Test ID(s) | M3 build ref | Pat |
|---|---|---|---|---|---|---|
| 51 | `/notary` (Panel) | StatCard, ProgressTimeline (dossier completeness bars), PrimaryButton (Review) | GET `/notary/kpis`<br>GET `/notary/dossiers/pending` | NOT-PANEL-001<br>NOT-PENDING-002 | M3-BE-17<br>M3-FE-25 | — |
| 52v | `/notary/dossier/:dossierId` (view) | DocumentCard, HashChip, VerificationBadge, section checklists | GET `/notary/dossiers/:id` | NOT-DOSSIER-VIEW-001 | M3-BE-17<br>M3-FE-25 | P1, P2, P8 |
| 52s | Dossier sign action | PrimaryButton (Verify and sign) | POST `/notary/dossiers/:id/sign` (→ signature TXID) | NOT-DOSSIER-SIGN-001 | M3-BE-17<br>M3-SC-04<br>M3-FE-25 | — |
| 52r | Dossier reject action | TextArea (observations), DangerButton (Reject) | POST `/notary/dossiers/:id/reject` | NOT-DOSSIER-REJECT-001 | M3-BE-17<br>M3-FE-25 | — |
| 53 | `/notary/signed` | HashChip (dossier hash + signature TXID), StatusPill | GET `/notary/signatures?cursor=` | NOT-SIGNED-LIST-001 | M3-BE-17<br>M3-FE-25 | P2 |
| 54 | `/notary/profile` | ToggleSwitch, LanguageToggle, credentials section | GET `/profile`<br>PATCH `/profile` | NOT-PROFILE-001 | M3-BE-09<br>M3-FE-11 | — |

## 6.2 Certifier

6 backlog entries covering Panel, Certify stage (view + certify), Observe modal, Issued history, and Profile per D1 §5.4.

| ID | Surface / path | Components (D3 §5) | Endpoint(s) | Test ID(s) | M3 build ref | Pat |
|---|---|---|---|---|---|---|
| 55 | `/certifier` (Panel) | StatCard, PrimaryButton (Certify) | GET `/certifier/kpis`<br>GET `/certifier/assignments` | CER-PANEL-001<br>CER-ASSIGNMENTS-002 | M3-BE-18<br>M3-FE-26 | — |
| 56v | `/certifier/stage/:stageId` (view) | DocumentCard, HashChip, empty-state for no evidence | GET `/certifier/stages/:stageId` | CER-STAGE-VIEW-001 | M3-BE-18<br>M3-FE-26 | — |
| 56c | Certify action | PrimaryButton (Certify) | POST `/certifier/stages/:stageId/certify` (→ certificate hash + TXID) | CER-CERTIFY-001 | M3-BE-18<br>M3-SC-05<br>M3-FE-26 | — |
| 57 | Observe stage modal | ObserveStageModal, TextArea, DangerButton (orange corrective) | POST `/certifier/stages/:stageId/observe` | CER-OBSERVE-001 | M3-BE-18<br>M3-FE-26 | — |
| 58 | `/certifier/issued` | HashChip (certificate hash + TXID), StatusPill (Certified) | GET `/certifier/certificates?cursor=` | CER-ISSUED-LIST-001 | M3-BE-18<br>M3-FE-26 | P2 |
| cer-prof | `/certifier/profile` (implied) | ToggleSwitch, LanguageToggle, credentials section | GET `/profile`<br>PATCH `/profile` | CER-PROFILE-001 | M3-BE-09<br>M3-FE-11 | — |

---

# 7. M3 build reference glossary

Each backlog entry's M3 build ref column points to one or more of the following work streams. M3 §1 (Outputs) maps these directly to its deliverables on Core Backend, Smart-Contract Development, and UI Implementation & Integration.

| Ref | Scope |
|---|---|
| M3-BE-01 | Auth & session backend (login, AuthGuard role groups, `/auth/me`) |
| M3-BE-02 | Public projects browse API (listings, filters, search, geo) |
| M3-BE-03 | Projects CRUD (developer scope) + public detail |
| M3-BE-04 | Construction stages API (per-project, per-stage) |
| M3-BE-05 | Investor favorites API |
| M3-BE-06 | Units API (investor + developer scopes, building schematic) |
| M3-BE-07 | Notifications service (role-scoped, category-filtered) |
| M3-BE-08 | Contracts & releases API |
| M3-BE-09 | Profile & preferences API |
| M3-BE-10 | Invitations API (issue, accept, decline) |
| M3-BE-11 | KPI & dashboard aggregators (developer Panel, Capital) |
| M3-BE-12 | Dossier compilation & public share token |
| M3-BE-13 | Evidence anchoring service (Merkle, file storage, proof paths) |
| M3-BE-14 | Documentation & document anchoring API |
| M3-BE-15 | Investors directory API (developer scope) |
| M3-BE-16 | Audit log append-only ledger + filters |
| M3-BE-17 | Notary workflow API (queue, sign, reject) |
| M3-BE-18 | Certifier workflow API (assignments, certify, observe, issued) |
| M3-SC-01 | Smart contract: invitation anchor / acceptance |
| M3-SC-02 | Smart contract: evidence bundle anchor (Merkle root commit) |
| M3-SC-03 | Smart contract: stage payment release |
| M3-SC-04 | Smart contract: notary signature commit on dossier |
| M3-SC-05 | Smart contract: stage certification commit |
| M3-SC-06 | Smart contract: standalone document hash anchor |
| M3-FE-01 | Login surface (multi-role tabs) |
| M3-FE-02 | Investor Buy surface (list/map/search/filter) |
| M3-FE-03 | Project detail (investor view) |
| M3-FE-04 | Stage detail + milestone modals + document viewer |
| M3-FE-05 | Favorites surface |
| M3-FE-06 | Investor Units + acquired unit detail |
| M3-FE-07 | Notifications surface (role-scoped) |
| M3-FE-08 | Investor contract & payments surface |
| M3-FE-09 | TxidModal (cross-role reusable) |
| M3-FE-10 | Investor dossier surface + share + export |
| M3-FE-11 | Profile surface (cross-role reusable) |
| M3-FE-12 | Investor Menu (aggregator) |
| M3-FE-13 | Invitation acceptance modal flow |
| M3-FE-14 | Developer Panel |
| M3-FE-15 | Developer projects (list, create, detail) |
| M3-FE-16 | Developer units management |
| M3-FE-17 | Developer invite-investor flow |
| M3-FE-18 | Developer evidence upload + AnchoringSuccessModal |
| M3-FE-19 | Developer contracts & releases surface |
| M3-FE-20 | Developer capital dashboard |
| M3-FE-21 | Developer progress dashboard |
| M3-FE-22 | Developer documentation surface |
| M3-FE-23 | Developer investors list |
| M3-FE-24 | Developer audit log + verification modal |
| M3-FE-25 | Notary surfaces (Panel, Dossier review, Signed, Profile) |
| M3-FE-26 | Certifier surfaces (Panel, Certify stage, Observe, Issued) |

---

# 8. Cross-link to Milestone 3

Milestone 3 — Core Backend, Smart-Contract Development & Integration — implements the entirety of this backlog. The mapping is:

**M3 Output 1 — Smart-contract suite (Plutus V2 state machine)**
Implements all M3-SC-XX refs in this plan. The state machine handles invitation acceptance, evidence anchoring (Merkle root commit), stage payment release, notary signature commit on dossier, stage certification, and standalone document hash anchor.

**M3 Output 2 — Off-chain services & API**
Implements all M3-BE-XX refs. Endpoints listed in §4–§6 map directly to API routes the off-chain service exposes. Proof objects returned per D4 §8.1 satisfy this output's evidence requirement.

**M3 Output 3 — UI Implementation & Integration**
Implements all M3-FE-XX refs. This output consumes the backlog in §4–§6 directly and is the primary cross-link required by the SOM evidence statement for this deliverable.

**M3 Output 4 — Testing & Security**
Every test ID in §4–§6 is registered with the M3 test plan. Coverage target (≥95% per M3 acceptance) is computed against this backlog. Test IDs are the unit of measurement.

**M3 Output 5 — Pre-production Environment & Ops**
End-to-end flows from D1 §6 (onboarding, evidence, closing) are validated against the corresponding backlog entries in pre-prod. The runbook references this plan when describing each user journey.

# 9. Coverage verification

This plan was checked against the M2 deliverables for completeness. Coverage status:

- All screens listed in D1 §5 (all four roles, all 70 screenshot indices): covered.
- All modals listed in D1 §5 (TxidModal, AnchoringSuccessModal, InvitationAcceptModal, ObserveStageModal, ShareDossierModal, DocumentViewerModal, ImageGalleryModal, LocationMapModal, BuildingSchematic): covered.
- All 36 components in D3 §5: covered via the components column across entries.
- All 10 proof-rendering patterns in D4 §5 (P1–P10): covered via the Pat column. Patterns are referenced in 17 distinct backlog entries.
- All resources in the D1 §4 permission matrix (Project, Unit, Invitation, Construction stage, Evidence bundle, Document, Contract, Payment release, Stage certification, Stage observation, Final dossier, Audit log, Profile): each has at least one corresponding endpoint listed.
- All proof-emitting actions from D1 §6 (invitation anchor, evidence Merkle + TXID, certificate hash + TXID, stage-release TXID, signature TXID): each is enumerated as an endpoint in the appropriate backlog entry.

---

# 11. Relation to other M2 deliverables

This document is the fifth of six Milestone 2 deliverables. It consumes the design package and produces the execution backlog for M3.

- **D1 — IA Map:** source of screens, paths, permissions, and cross-role flows enumerated in §4–§6.
- **D2 — Screen Catalog:** (consolidated into the D1 §9 screenshot index referenced by every backlog entry's ID column).
- **D3 — Component Library:** source of the components column on every backlog entry; component IDs match D3 §5 verbatim.
- **D4 — UX Documentation:** source of the Pat column (patterns P1–P10) and of the data-contract assumptions in §3 (per D4 §8).
- **D6 — Smart Contract & Backend Plan:** consumes this document. Every M3-BE-XX and M3-SC-XX ref in §7 corresponds to a section in D6.

