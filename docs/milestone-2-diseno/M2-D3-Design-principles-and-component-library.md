# Design Principles & Component Library

## Design principles
Six principles guide every design and implementation decision on PropNexus. They derive from the project's thesis: move the trust in construction-stage real estate from a chain of intermediaries to a verifiable, blockchain-
anchored record.

### Principle 1. Show the proof, not the technology.
Cryptographic certainty must be visible at the surface — Verified pills, hashes, TXIDs, Merkle roots, anchored
badges — but the underlying mechanics stay hidden. Investors and developers should be able to verify without
needing to understand what a Merkle root is.

### Principle 2. One status per entity.
Every entity (document, stage, unit, contract, dossier) has exactly one current status displayed via a StatusPill in
the canonical colour for that status. Status colours never shift meaning between contexts.

### Principle 3. Surface the truth at the right depth.
Truncated by default, full on demand. HashChips show 6+4 characters; full hex appears only in a verification
modal. This protects the surface from clutter while keeping verification always one tap away.

### Principle 4. Read the same on phone and desktop.
The platform is mobile-first. The desktop responsive layout swaps the BottomNav for a left sidebar and adds
columns, but the component model is identical. A workflow that exists on mobile exists on desktop, in the same
order, with the same affordances.

### Principle 5. Make the irreversible visible.
Anchor, certify, sign, release, accept — each is a state-changing action that emits an on-chain event. Each is
wrapped in a confirmation surface that exposes the artifact produced (TXID, Merkle root, certificate hash).
Nothing of consequence happens without the user seeing the result.

### Principle 6. Default to Spanish, design for both.
The default locale is es-AR (voseo register). English is the secondary locale. Every component must accept
locale-aware copy, currency, dates, and relative-time strings — never hardcoded. The toggle is reachable from
the login screen and every Profile screen.


## Visual Language

Colour
Colours are organised by role. Each role has a canonical semantic meaning that does not change between
contexts. Hex values are normative.

### Brand

Primary
#6D4AFF
Brand identity. Used for
primary buttons, gradient
headers, active nav, accent
text, anchored / on-chain
visual signalling.

Primary dark
#5538DD
Pressed state for primary
buttons; hover on links.

Primary light
#EEEAFF
Primary-tinted backgrounds
(selected nav, role pill,
invitation card border tint,
INV table-cell highlight).

### Semantic

Verified
#14B8A6
Verification badge, anchored
on-chain confirmation,
signed pills, cryptographic
certification card.

Verified light
#D4F4EE
Verified pill background,
cryptographic certification
card background.

Pending / Observe
#F97316
Pending verification states,
observe action, in-dispute
pill.

Pending light
#FFE8D6
Pending pill background,
DEV table-cell highlight.

Info
#3B82F6
Pre-construction status,
information badge for
portfolio metrics, Completed
status pill (Investor context).

Info light
#DBEAFE
Pre-construction pill
background, CER table-cell
highlight.

People
#EC4899
Investor-count icon badges,
Active Investors stat card.

People light
#FCE7F3
Backgrounds for pink-tinted
accents.

Danger
#EF4444
Log out button border and
text, hard destructive
actions.

### Neutrals

Text primary
#111827
Headlines, stat numbers,
body copy in dense contexts.

Text secondary
#374151
Body copy in normal
contexts, helper text.

Text muted
#6B7280
Labels, captions, timestamp
metadata.

Disabled
#9CA3AF
Disabled inputs, inactive nav
icons.

Border
#E5E7EB
Default border for inputs,
card outlines on white
surfaces.

Surface alt
#F3F4F6
Alternate surface for cards-
on-cards; ghost button
hover.

App background
#F4F1ED
Off-white app background
visible between cards.

Card
#FFFFFF
Primary card surface, modal
surface.

### Status pill colour matrix

Status pills always use this colour mapping. Never invent new statuses; if a new state is needed, choose the closest semantic mapping.

| Status | Pill fill | Pill text | Example label | Context |
|--------|-----------|-----------|----------------|---------|
| Verified / Signed / Certified | #D4F4EE (teal light) | #14B8A6 (teal) | Verified · Signed · Certified · Paid · Released | Anchored / completed states |
| Pending / Observed | #FFE8D6 (orange light) | #F97316 (orange) | Pending · Reserved · In dispute · Under construction | Awaiting verification or with observations |
| Info / Pre-construction | #DBEAFE (blue light) | #3B82F6 (blue) | Pre-construction · Completed (investor) | Informational, not yet started or already concluded from this role |
| Sold / Delivered | #D4F4EE (teal light) | #14B8A6 (teal) | Sold · Delivered | Final positive state |
| Available / Neutral | #F3F4F6 (gray) | #374151 (gray) | Available · Unassigned | Open / waiting / no investor |

## Typography

Typography is mobile-first and reads at the same hierarchy on desktop. The system uses three font families: a system sans for body, the same sans (bold) for headings, and a monospace family exclusively for hashes and TXIDs.

### Family

| Family | Usage | Web stack |
|--------|-------|-----------|
| Sans (system) | Headings, body, labels, buttons. | Tailwind default — system-ui, -apple-system, "Segoe UI", Roboto, ... |
| Mono | Hashes, TXIDs, Merkle roots, code-like values. Anywhere precision matters and the user might read character-by-character. | Tailwind font-mono — ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, ... |

### Type scale

All sizes in pixels. Line height is 1.25× for headings and 1.5× for body unless stated.

| Level | Size | Weight | Usage | Example |
|-------|------|--------|-------|---------|
| Display | 32px | Bold | Page-level GradientHeader title (e.g. "New project", "Notifications"). | Notifications |
| Heading 1 | 24px | Bold | Page titles inside scrollable content, modal titles. | Final Dossier |
| Heading 2 | 20px | Bold | Card titles, section headers within a page. | My investment |
| Stat number | 28px | Bold | StatCard primary number; intentionally heavier than Heading 1 to dominate dashboards. | 4.0M |
| Body | 16px | Regular | Default body copy, modal body, descriptive text. | Construction permit has been uploaded. |
| Body small | 14px | Regular | Helper text below inputs, secondary captions. | Optional · max 200 chars |
| Label | 13px | Bold uppercase tracked | Section labels in dense surfaces (CONTRACT SUMMARY, PAYMENT SCHEDULE). | CONTRACT SUMMARY |
| Caption | 12px | Regular | Timestamps, metadata, status helper text. | 2 hours ago |
| Mono small | 12px | Regular monospace | Inline truncated HashChip text. | 0xdcd5...7994 |
| Mono body | 14px | Regular monospace | Full TXID block inside verification modal. | 0xdcd5da16f89...43fa9aa7994 |

## Iconography

Icons are drawn from the Lucide library (used by shadcn/ui). They are decorative supports, never the sole carrier of meaning — always pair an icon with a label or use it adjacent to one.

### Reserved icon-meaning pairs

| Icon | Reserved meaning | Where used |
|------|------------------|-----------|
| Bell | Notifications | Header (Investor Buy/Menu) |
| Copy (overlapping squares) | Copy to clipboard | Inside HashChip and TxidModal full-hex blocks |
| Eye | View / open | DocumentCard, file actions |
| Download (arrow into tray) | Download file | DocumentCard, dossier export |
| Check-shield (seal) | Verified / cryptographically anchored | VerificationBadge, AnchoringSuccessModal, TxidModal, dossier Cryptographic Certification |
| Map pin | Location | Project cards, unit detail, search-by-zone field |
| Building / office | Project / development entity | Developer chip on project cards, profile avatars, unit icons |
| External link (arrow out of square) | Opens external page | "View in explorer" CTA inside TxidModal and AnchoringSuccessModal |
| Heart | Favorite | Investor project cards |
| Envelope | Invitation / message | InvitationCard, Invite investor form |
| Globe-with-A | Language toggle | LanguageToggle component |
| Plus inside circle | Create new | "New project" featured ActionCard, "+ New" inline buttons, "Add unit" form |
| Upload tray | File upload | FileDropzone, Upload evidence ActionCard |
| Clipboard with check | Dossier review (notary) | Notary BottomNav Dossiers tab |
| Activity / pulse | Stages / certification activity | Certifier Assigned tab, stats tiles |

### Sizes

| Context | Size | Notes |
|---------|------|-------|
| Inline (alongside body) | 16px | Matches Body size; aligns vertically with text x-height. |
| Inside StatusPill / HashChip | 14px | Slightly smaller than body to fit pill padding. |
| StatCard icon badge | 20px in 40px badge | Icon inside a coloured rounded-square badge. |
| BottomNav | 24px | Stroke-only, with label below. |
| Empty-state illustration | 48px+ | Centered above helper copy. |

## Spacing

Spacing is on a 4px base scale, matching Tailwind defaults. Use only tokens from the scale.

### Spacing tokens

| Token | Pixels | Use |
|-------|--------|-----|
| s-1 | 4 | Inline icon-to-label gap, tight pill padding. |
| s-2 | 8 | Pill horizontal padding, chip-to-chip gap. |
| s-3 | 12 | Form input internal padding, card internal vertical rhythm. |
| s-4 | 16 | Default card padding, page horizontal padding on mobile. |
| s-5 | 20 | Section-to-section vertical rhythm inside a card. |
| s-6 | 24 | Default card-to-card vertical gap. |
| s-8 | 32 | Section break inside a page, header bottom margin. |
| s-12 | 48 | Large empty-state padding. |

### Radii

| Token | Pixels | Use |
|-------|--------|-----|
| r-md | 8 | Inputs, chips, pills. |
| r-lg | 12 | Standard cards. |
| r-xl | 16 | Stat tiles, modal sheets, action tiles, gradient headers (bottom corners). |
| r-full | 999 | Capsule pills, circular buttons, NotificationBell. |

### Elevation

Elevation is minimal. The default surface uses a soft 1-level shadow; modals use a stronger backdrop dim plus a slight shadow on the modal body itself.

| Level | Definition |
|-------|-----------|
| e-0 | Flat — no shadow. App background, inline rows in lists where the list itself is the card. |
| e-1 | Soft 0 1px 2px rgba(0,0,0,0.06) — default card resting state. |
| e-2 | Medium 0 4px 12px rgba(0,0,0,0.08) — pressed state for elevated cards, FAB. |
| e-modal | Backdrop rgba(0,0,0,0.5); modal body 0 8px 24px rgba(0,0,0,0.12). |

## Layout patterns

### Page anatomy

- GradientHeader at the top with rounded bottom corners (r-xl), extending edge-to-edge.
- Content scrolls behind/below the header on a single column for mobile (max 600px effective content width).
- BottomNav fixed to the viewport bottom on mobile; on desktop, replaced by a left sidebar of the same items.
- Page padding: s-4 horizontal on mobile, s-6 horizontal on desktop.
- Card-to-card gap: s-6 vertical.

### Grid patterns

| Pattern | Use and notes |
|---------|---------------|
| Stat grid 2 × N | Default for KPI tiles on mobile. Two columns, square-ish tiles, equal gap. On desktop, expands to 3 or 4 columns. |
| Action grid 2 × 2 | Used on project detail (Manage units / Invite investor / Upload evidence / View contracts) and Developer Panel (New project tile + Active Projects). |
| Listing column | Single-column listing of cards. Used for Projects, My Units, Favorites, Investors, Documents, Audit log. |
| Form column | Stacked label + input column. Each input lives inside a white card; cards stack with s-4 gap. |
| Modal sheet | On mobile: bottom-anchored sheet with rounded top corners. On desktop: centered card. Backdrop dim e-modal. Modal width capped at 480px. |

## Component Library

36 components organised in four groups. Each component card lists its purpose, anatomy, states, usage rules.

### Foundation
8 components.

GradientHeader
Purpose. Page-level header used on every screen. Establishes role identity, page context, and primary
navigation backwards.
Anatomy
• Purple linear gradient background (PURPLE → PURPLE light)
• PropNexus logo top-left (always)
• Back affordance ("← Back" or "← Back to <parent>") on detail screens
• Page title (large bold)
• Subtitle / context line (optional)
• Right-side slot for utilities: NotificationBell, LanguageToggle, action button
States
• Default — full gradient, no scroll behaviour
• On long-scroll screens — collapses visually as content scrolls behind it (visible in 16, 17)
Usage rules
• Use on every primary screen, every modal landing, every detail view
• Never omit the logo — it is the role-agnostic anchor
• Right slot reserved for global utilities only (notifications, locale, primary action) — not contextual actions

BottomNav
Purpose. Mobile primary navigation. Role-scoped — tab count and labels vary by role. On desktop
viewports it collapses into a left sidebar.
Anatomy
• Horizontal bar fixed to the bottom of the viewport
• 4 or 5 tabs depending on role
• Each tab: icon (Lucide) + label
• Active tab: purple icon + bold label; inactive: gray
• Investor variant has a center FAB-style "Buy" tab (green circle with $)
States
• Default — inactive tab gray
• Active — icon and label in purple; FAB visually elevated
• Pressed — short colour darkening
Usage rules
• INV: Menu · Favorites · Buy (FAB) · Units · User
• DEV: Panel · Projects · Capital · Units · Progress
• NOT: Panel · Dossiers · Signed · Profile
• CER: Panel · Assigned · Issued · Profile
• Always present on authenticated mobile screens; replaced by left sidebar on desktop

StatCard
Purpose. Atomic KPI tile. The most-reused unit in the platform — appears in every role's panel and across
multiple list summaries.
Anatomy
• White rounded card on off-white background
• Optional colored icon badge top-left (square with rounded corners, semantic colour)
• Large bold number (metric value)
• Smaller label below the number
• Tiny helper line below the label (optional, e.g. "of construction completed")
States
• Default
• Highlighted variant — full background colour, white text (used for "New project" tile on Developer Panel)
Usage rules
• Group into 2-column grids on mobile; 3 or 4 on desktop
• Icon colour is semantic: green = financial, purple = entity/inventory, orange = trend, blue = portfolio, pink =
people, teal = verification
• Always pair the number with a label — the number alone is never used

StatusPill
Purpose. Compact state indicator. The primary signalling mechanism for entity status across the platform.
Anatomy
• Capsule with horizontal padding, single label text
• Background tinted with the semantic light hue; text uses the dark equivalent
• No icon by default (icon optional for stronger emphasis)
States
• See colour matrix below — eight semantic palettes
Usage rules
• One status per entity. Never stack pills.
• Stable colour-to-semantic mapping across roles (verified is always teal, pending is always orange, etc.)
• Pills are read-only — they never become action buttons

HashChip
Purpose. Visually distinctive inline display of a cryptographic hash or transaction ID, with a one-click copy
affordance.
Anatomy
• Light gray rounded rectangle
• Truncated hex string in monospace (e.g. "0xdcd5...7994")
• Copy icon (Lucide copy) on the right edge
• Optional prefix label inside the chip ("hash", "txid")
States
• Default — gray fill
• Copied — momentary check icon + tooltip "Copied"
• Hover (desktop) — slight darkening
Usage rules
• Always truncate to first 6 + last 4 characters with ellipsis
• Full hex string remains available via the copy action and via the modal that opens on tap
• Use anywhere a hash, TXID, Merkle root, or dossier hash needs to be referenced inline
• Never display the full untruncated hex inline — only in the verification modal

VerificationBadge
Purpose. Inline confirmation that an artifact (document, stage, dossier) is anchored on-chain.
Anatomy
• Small teal-tinted capsule with rounded corners
• Optional check-shield icon on the left
• Label "Verified" (or locale-appropriate translation)
States
• Default (verified) — teal
• Pending counterpart — orange "Pending" or "Pending verification"
Usage rules
• Use on each document, stage, or dossier confirmed on-chain
• Pair with a HashChip when the user needs to verify the exact anchor
• Never use "Verified" pill without a real underlying hash

NotificationBell
Purpose. Header-mounted entry point to the role's notifications inbox; surfaces unread count.
Anatomy
• Circular semi-transparent button on the gradient header
• Bell icon (Lucide)
• Numeric badge top-right when unread > 0 (teal pill with white number)
States
• No unread — bell only
• Unread — bell + numeric badge
• Pressed — full opacity briefly
Usage rules
• Mount only in primary panels: Investor Buy and Menu, Developer Panel, etc.
• Tapping always opens the role-scoped notifications page
• Badge displays "9+" when count exceeds 9

LanguageToggle
Purpose. Persistent ES / EN switcher visible on the login screen and every Profile / Menu screen.
Anatomy
• Globe-style icon plus the active locale code (e.g. "EN" or "ES")
• Located in the gradient header right slot
States
• Default — shows current locale label
• Toggled — locale switches; visual immediately re-renders all strings, formatters, and pluralisation
Usage rules
• Persist selection in localStorage under propnexus.lang
• Default to es-AR if no value present
• Affects all components that rely on i18n — text strings, number/currency formatting, dates, relative-time
strings

### Cards

9 components.

ProjectCard
Purpose. Listing-card for a project. Used on Investor Buy/Favorites and Developer Projects.
Anatomy
• Full-width white card
• Cover image (16:9) with overlaid developer chip
• Body: "From <price>" label, location, m2 range, status pill
• Footer progress bar with percentage on the right
• Heart toggle (Investor only) — overlay on image or in body
States
• Default
• Favorited (Investor) — heart filled, purple
• Tapped — slight scale-down feedback
Usage rules
• Status pill colour reflects construction state
• Progress bar is required when status ≠ Delivered
• Card is fully tappable; entire surface routes to project detail

UnitCard
Purpose. Listing-card for an acquired unit (Investor) or a developer-managed unit (Developer Manage
Units).
Anatomy
• Investor variant — cover image, project name, unit label, progress bar with percentage
• Developer variant — row with house icon, unit label, floor + surface + investor name, status pill, price
States
• Investor — Default / In construction / Delivered
• Developer — Sold / Reserved / Available
Usage rules
• Investor cards include progress; developer rows do not (progress is at project level)
• Developer rows show assigned investor name when sold or reserved; "Unassigned" when available

DocumentCard
Purpose. Inline representation of an anchored or pending document. Used in stage detail, supporting
documentation lists, dossier document index, and developer documentation.
Anatomy
• Document icon (Lucide file-text) on the left
• Filename + upload date + format (PDF) text block
• Verified or Pending pill
• Action icons on the right: eye (view) and download
• Optional inline hash chip when full hash visibility is desired (Developer Documentation)
States
• Verified — teal pill, both action icons enabled
• Pending — orange pill, view enabled, download may be disabled
Usage rules
• Tapping the filename opens the DocumentViewerModal
• Tapping download triggers a PDF download
• When the document is part of a stage bundle, also surface the Package Merkle root nearby

InvestorCard
Purpose. Row-style entry in the Developer Investors list.
Anatomy
• Avatar circle with initials
• Name + email row
• Investment amount, Unit label, Project chip
• Status pill on the right (Active / Pending / Completed)
States
• Active — teal
• Pending — orange
• Completed — blue

AuditEventCard

Purpose. Row representation of an event in the Developer Audit Log. Carries enough metadata to be self-
explanatory and is the entry point to verification.

Anatomy
• Timestamp (top, gray)
• Action title (bold)
• Actor role pill (developer / certifier / notary / investor) + actor name
• Category pill (etapa / certificador / firma / liberacion / documento)
• TXID HashChip on the right
States
• Default
• Pressed — opens TxidModal
Usage rules
• Append-only — events are never edited or removed
• Category pill colour pairs with role pill colour for visual scanning

NotificationCard
Purpose. Standard notification entry in the notifications inbox.
Anatomy
• Icon circle on left (purple for primary types, gray for ambient)
• Title bold; body text below
• Timestamp right-aligned with the title
• Read-state indicator: gray check when read, omitted when unread
• Category-coloured left border when category-filtered
States
• Unread — slight purple tint background
• Read — gray check icon visible, no tint

InvitationCard
Purpose. Special notification variant used exclusively for project invitations. Always pinned to the top of the
list when unresolved.
Anatomy
• Purple left border, purple text accents
• Envelope icon
• "Project invitation" title in purple
• Body summarises the offer (developer name, project, unit, amount)
• "View invitation →" CTA
States
• Pending action — pinned at top of the list
• Accepted / Declined — moved to the normal notification stack with the resolved state in the body
Usage rules
• Tap opens InvitationAcceptModal
• Only one invitation card visible at a time; subsequent invitations queue beneath

ActionCard
Purpose. Tile in an action grid: a large tappable card with a heading and short description. Used on project
detail to expose primary actions, and on Developer Panel to expose "New project".
Anatomy
• Square or near-square white card
• Icon badge (top-left or top-centred)
• Bold title
• Optional one-line description
States
• Default — white
• Featured — full purple fill, white text (e.g. "New project")

ProgressTimeline
Purpose. Horizontal milestone timeline with one node per stage. Used on Investor unit detail, project
progress, developer overall progress, and dossier.
Anatomy
• 10 nodes joined by a connecting line
• Completed nodes — filled purple circles
• Current node — open circle with purple ring
• Pending nodes — gray open circles
• Below: current-stage label and finalization date
States
• Stage X completed
• Stage X in progress
• Stage X pending

### Forms & Controls

10 components.

PrimaryButton
Purpose. Highest-emphasis action. Used for the principal action on every screen and modal.
Anatomy
• Solid purple fill, white text, rounded corners
• Optional left icon (Lucide)
States
• Default — solid purple
• Disabled — lighter purple, reduced opacity
• Pressed — purple-dark (#5538DD)
• Loading — spinner replaces label
Usage rules
• One per screen ideally; max two in a paired CTA bar
• Label is verb-first ("Anchor evidence", "Verify and sign", "Send invitation")

SecondaryButton
Purpose. Lower-emphasis action paired with a Primary or used standalone for navigation-style affordances.
Anatomy
• White fill, gray border, dark text
• Same shape and padding as Primary
States
• Default — white
• Pressed — gray-50 fill
Usage rules
• Used for "Cancel", "Back to <parent>", "View dossier" (when paired with download)

DangerButton
Purpose. Destructive or attention-demanding action. Used sparingly.
Anatomy
• Red or orange fill (Send-with-observations uses orange to signal corrective action without destructiveness)
• White text

TextInput
Purpose. Standard single-line text input. Used in forms across all roles.
Anatomy
• Light gray fill, light border
• Inline label above the field
• Placeholder text inside the field when empty
• Optional right adornment (eye for passwords, calendar for dates)
States
• Default
• Focused — purple ring
• Filled — placeholder hidden
• Error — red border + helper text below (where surfaced)

NumberInput
Purpose. Numeric input with stepper controls.
Anatomy
• Same body as TextInput
• Up/down stepper buttons on the right

SelectDropdown
Purpose. Single-select dropdown. Used for unit assignment, stage template, sort order.
Anatomy
• Same body as TextInput with chevron-down adornment
• Opens a popover list
States
• Closed (default)
• Open — popover list visible
• Selected — value displayed in body

TextArea
Purpose. Multi-line free-text input.
Anatomy
• Same styling as TextInput, larger
• Optional character counter
States
• Default
• Focused
• Filled
• Error

ToggleSwitch
Purpose. Binary on/off control. Used for notification preferences.
Anatomy
• Capsule track with circular thumb
• Purple when ON, gray when OFF
States
• Off
• On
• Disabled

FilterPill / CategoryChip / StageChip
Purpose. Compact selectable chips for filtering lists or selecting a discrete item from a small set.
Anatomy
• Capsule with horizontal padding
• Selected — solid purple fill, white text
• Unselected — light gray fill, dark text
Usage rules
• FilterPill — single-select within a group (e.g. status filter)
• CategoryChip — single-select on horizontally scrollable lists (e.g. notification categories)
• StageChip — numeric 1-10 chips for stage selection, with anchored stages visually distinct

FileDropzone
Purpose. File upload area for evidence-bundle creation.
Anatomy
• Dashed-border rounded rectangle
• Upload icon centered
• Primary helper copy ("Drag files or tap to select")
• Secondary helper copy ("2 sample files will be added")
States
• Empty (default)
• Dragging-over — fill becomes light purple, border solid
• Files attached — preview thumbnails replace helper copy

### Modals & Overlays

9 components.

TxidModal (Blockchain verification)
Purpose. Reusable verification modal exposing full TXID and explorer link for any anchored artifact. The
canonical surface for "show me the proof".
Anatomy
• Sheet-style modal anchored to bottom on mobile, centered on desktop
• Teal seal icon + "Blockchain verification" title
• Labelled fields: Document, Anchoring date
• Full untruncated TXID in monospace block with copy icon
• Primary CTA "View in explorer" (external link)
States
• Open
• Copying — momentary "Copied" tooltip on copy
Usage rules
• Opened from any HashChip tap, AuditEventCard tap, or "View signed contract" CTA
• Never opens automatically — always user-initiated
• External link opens a new tab/window

AnchoringSuccessModal
Purpose. Post-anchor confirmation. Surfaces the cryptographic record produced by an evidence upload.
Anatomy
• Teal seal icon + "Evidence anchored" title
• Body copy explaining what was just generated
• Two labelled chip blocks: Merkle root (multi-line) and TXID (multi-line)
• Secondary "View on explorer" + primary "Done"
States
• Open
Usage rules
• Triggered only by successful Anchor evidence action on the Upload screen
• Both chip blocks support copy via tap
• Closing returns to the upload screen with form reset

InvitationAcceptModal
Purpose. Investor-facing acceptance surface for a developer-issued invitation.
Anatomy
• Check-seal icon + "Project invitation" title
• Inviting-developer line
• Four labelled blocks: Project, Assigned Unit, Total Amount, Estimated Handover
• Investment terms card (payment schedule summary)
• "This invitation is anchored on-chain" confirmation line in purple with check icon
• Two CTAs: Decline (secondary) + Accept invitation (primary)
States
• Open
• Submitting — buttons disabled, spinner on Accept
Usage rules
• Anchored-on-chain badge is non-optional — invitations are always anchored
• Acceptance triggers unit assignment and a new entry in My Units

ObserveStageModal
Purpose. Certifier-facing rejection surface. Captures observations to send back to the developer instead of
certifying the stage.
Anatomy
• Modal title "Observe stage"
• Helper copy "Provide details for the developer."
• Observations textarea (focused on open)
• Cancel (secondary) + Send (orange button)
Usage rules
• Send button uses the orange "danger-corrective" treatment, not red — observation is not destructive
• Empty textarea disables Send

ShareDossierModal
Purpose. Generates a read-only public dossier URL for third parties (notary, bank, regulator) without
granting platform access.
Anatomy
• Title "Share dossier"
• Explanatory copy
• URL chip with copy icon
• Close (secondary) + Open view (primary)

DocumentViewerModal
Purpose. Inline document viewer. Renders an anchored document image with the VERIFIED watermark
and exposes a PDF download.
Anatomy
• Document title at top
• Inline rendered page
• Diagonal VERIFIED stamp overlay
• Filename and pagination metadata
• Date + Verified pill row
• Download PDF CTA

ImageGalleryModal
Purpose. Full-screen photo carousel for project galleries, unit galleries, and stage photographic evidence.
Anatomy
• Dim overlay backdrop
• Centered image with prev/next chevron buttons
• X close top-right
• Counter (e.g. "2/4")
• Caption strip at bottom (project / stage / GPS + timestamp depending on context)

LocationMapModal
Purpose. Full-screen interactive Leaflet map. Used for project locations and acquired unit locations.
Anatomy
• Full-bleed map
• Address label top-left
• X close
• Marker for the location

BuildingSchematic
Purpose. Building grid showing the user's unit position highlighted within the entire building. Helps the
investor orient their acquisition spatially.
Anatomy
• Header — project name, "My unit", unit label, floor, surface
• Legend row — Available / Occupied / Your unit
• Grid of units organised by floor (rows) and column (A/B/C/D)
• Your unit shown in purple; occupied black; available white
• Bottom callout summarising unit position

### Interaction states (cross-component)

These state patterns apply across the entire library wherever the affordance is relevant.

| State | Visual treatment | Where it applies |
|-------|-----------------|------------------|
| **Default** | Resting visual per component. | All components. |
| **Hover (pointer devices)** | Subtle darken on filled surfaces, gray-50 fill on transparent surfaces. | Buttons, cards, chips, list rows. |
| **Focus (keyboard)** | Purple 2px ring with 2px offset. | All interactive components — required for accessibility. |
| **Pressed / active** | Darken one level (e.g. PURPLE → PURPLE_DARK). | Buttons, FAB, chip selection. |
| **Disabled** | 60% opacity, cursor not-allowed, no pointer events. | Buttons, inputs, FileDropzone empty state. |
| **Loading** | Spinner replaces label on buttons; skeleton placeholders on long-load lists. | Buttons during async actions, lists on first load. |
| **Empty state** | Large icon + heading + helper copy + optional CTA. | Empty lists (no assigned stages, no signed dossiers), evidence panels with no anchored evidence yet. |
| **Error** | Red border on inputs; red helper text below. | Form inputs failing validation. |
| **Copied (transient)** | Check icon replaces copy icon for 1.5 s; tooltip "Copied". | HashChip, TxidModal full-hex blocks. |


### Accessibility
The platform targets WCAG 2.1 AA conformance. Live audit against contrast ratios, screen-reader behaviour, and
keyboard navigation occurs in Milestone 3 once the implementation is complete. This section documents the
guidance that informed the design and that the M3 build must respect.

Colour and contrast
• Body text and labels meet WCAG 2.1 AA contrast (4.5:1 against background).
• Large text (≥18pt or ≥14pt bold) meets the relaxed 3:1 ratio.
• Status colour is never the sole carrier of meaning — pills always pair a colour with a text label.
• Verified pill (teal on teal-light) and Pending pill (orange on orange-light) were chosen for distinguishability with
deuteranomalous and protanomalous vision profiles.

Touch targets and hit areas
• Minimum touch target 44 × 44 px (Apple HIG) / 48 × 48 dp (Material). Applies to BottomNav tabs, chips, action
icons, copy buttons.
• Chip-style elements that are smaller than 44px height (e.g. StatusPill) are read-only by design and not interactive.

Keyboard navigation
• All interactive elements are reachable via Tab in document order.
• Focus ring (purple, 2px, 2px offset) is mandatory and must never be removed by CSS reset.
• Modal traps focus when open; Esc closes.
• Enter triggers the default action on a focused form; Esc cancels.
7.4 Screen reader semantics
• Headings use real heading tags (H1 for page title, H2 for section).
• Buttons use <button>, not styled <div>s.
• Status pills include sr-only label prefix ("Status: Verified").
• Hashes and TXIDs include sr-only context ("Transaction hash: 0xdcd5..."). Truncation does not affect the
announced value.
• Modals expose role="dialog" and aria-labelledby pointing to the modal title.

Motion
• Animations limited to ≤200 ms for transitions; ≤400 ms for state changes.
• All non-essential animation respects prefers-reduced-motion.

### Localization

PropNexus is bilingual by default: Spanish (es-AR voseo register) and English (en-US). Localization is built into every layer of the system.

Locale model

- Two locales supported: es-AR (default) and en-US.
- Locale persists in localStorage under key propnexus.lang.
- LanguageToggle is reachable from the login screen and from every Profile / Menu screen.
- Component library does not contain hardcoded strings — every visible string comes from i18n dictionaries.

Tone and register

- Spanish: es-AR voseo. Address the user with "vos", not "tú" or "usted". Examples: "Mirá tu unidad", "Sumá una unidad nueva".
- English: en-US, professional but plain. Avoid jargon ("inversor" → "investor", not "stakeholder").
- Blockchain terminology stays consistent across locales: "TXID" untranslated, "anclado on-chain" / "anchored on-chain", "Merkle root" untranslated.

Locale-aware formatting

| Format | Implementation | Examples |
|--------|----------------|----------|
| Currency | Intl.NumberFormat with locale and style: "currency", currency: "USD" | es-AR: "U$S 285.000" · en-US: "U$S 285,000" |
| Date (absolute) | Intl.DateTimeFormat with locale | es-AR: "10/01/2024" · en-US: "Jan 10, 2024" |
| Date (relative) | Intl.RelativeTimeFormat | es-AR: "hace 5 minutos" · en-US: "5 minutes ago" |
| Decimal numbers | Intl.NumberFormat with locale | es-AR: "1.234,56" · en-US: "1,234.56" |
| Stage names | Looked up by key, never hardcoded | es-AR: "Estructura planta baja" · en-US: "Ground floor structure" |

Text growth

- Spanish strings are typically 20–30% longer than English equivalents. Components must accommodate growth without truncation or clipping.
- Buttons size to content; never use fixed-width buttons except for FAB and icon-only buttons.
- Status pills size to content; minimum width 64px.
- Multi-line truncation patterns: filename in DocumentCard truncates with ellipsis after 2 lines.

Bidirectionality

- Current locales are both LTR. No RTL support implemented; not in scope for M2/M3.
- Components built with logical CSS properties (start/end) rather than physical (left/right) where the project tooling permits — this prepares the codebase for future RTL locales.