Proof-rendering patterns
Ten canonical patterns for how on-chain proof material appears in the user interface. Each pattern is documented
with a problem, a solution, when-to-use rules, implementation cue (data the pattern needs), and examples
(screen IDs from D2).
These patterns are normative. New surfaces that need to display proof material should reuse an existing pattern; new patterns
should be added to this document before being used.

PATTERN 1
VerificationBadge — the binary signal
For every artifact, a single visible answer to "is this anchored on-chain?".
Problem. The most basic on-chain question a user has about any artifact (document, stage, dossier) is simple: is it
anchored or not? The answer is binary. The surface needs to convey this without requiring the user to inspect the hash.
Solution. A small teal "Verified" pill placed directly on or next to the artifact. The pill's presence means "yes, anchored";
its absence — or a counterpart "Pending" pill in orange — means "no, not yet". The pill is read-only.
When to use. Wherever an artifact has a binary anchored-or-not state and the user benefits from a quick scannable
answer. Document lists, stage detail headers, dossier section indicators, developer documentation, stage cards in audit
logs.
Implementation cue. The pattern needs only a boolean (anchored) and a locale string. It never needs the hash itself
— that is handled by Pattern 2 (HashChip).
Examples. D2 screens 07, 09, 11, 12, 25, 29, 46, 52.
PATTERN 2
HashChip — the inline reference
Surface that a proof exists for the artifact, without dominating the visual hierarchy.
Problem. For artifacts where the user might want to verify the exact anchor, just a Verified pill is not enough — the
user needs to know there is a specific hash they can reference. But the full 66-character hash crowds the surface.
Solution. A truncated monospace chip (6+4 characters with ellipsis) in a light gray rounded container, with a copy icon
on the right edge. Tapping the copy icon copies the full hash to the clipboard. Tapping the chip itself opens the
TxidModal (Pattern 3).
When to use. Inline next to any artifact that has a hash, TXID, or Merkle root the user might want to reference:
contracts, stage releases, audit events, certificates, dossiers, documents in the developer documentation surface.
Truncation rule. First 6 characters after the "0x" prefix, ellipsis, last 4 characters. Example: "0xdcd5...7994".
Truncation is purely visual — the underlying value is always the full hash.
Implementation cue. Pattern needs the full hash string. The component handles truncation; never pre-truncate at the
data layer.
Examples. D2 screens 23, 24, 25, 40, 46, 49, 53, 58.
PATTERN 3
TxidModal — the drill-into-proof
Expose the full TXID and an external verification path on demand.
Problem. A user — typically a technical reviewer, auditor, or integrator — needs to see the full TXID and verify the
anchor independently on a public block explorer. The inline HashChip is not enough for them.
Solution. A reusable modal opened from any HashChip tap or "View signed contract" / "View on explorer" CTA. The
modal exposes: a labelled identifier of what the TXID anchors (document name, action description, audit event title), the
anchoring date, the full untruncated TXID in a monospace block with a copy affordance, and a primary CTA to open the
explorer.

When to use. Whenever a HashChip is tapped, whenever an "View blockchain verification" affordance is invoked,
whenever an audit event row is opened. It is the canonical "show me the proof" surface.
Never use for. Triggering the modal automatically. The TxidModal is always user-initiated. Auto-popping it would
interrupt flow without consent.
Implementation cue. The modal needs: an action / artifact label, an anchoring date (ISO), the full TXID, and an
explorer URL template ($EXPLORER_BASE/tx/{txid}).
Examples. D2 screens 25v (Blockchain verification), 50 (Audit log → verification).
PATTERN 4
AnchoringSuccessModal — the proof-emission surface
Confirm a state-changing action by showing the cryptographic record it produced.
Problem. When the developer anchors an evidence bundle, the system produces two artifacts: a Merkle root (the
cryptographic commitment to the bundle) and a TXID (the on-chain anchor for that Merkle root). The user needs to see
both immediately as confirmation that the action succeeded.
Solution. A modal that opens automatically after a successful Anchor evidence action. It shows: a clear success
heading with the teal seal icon, body copy explaining what was just generated, both artifacts as full-string copy chips, an
"View on explorer" secondary CTA, and a primary "Done" button that closes the modal.
Distinguishing from Pattern 3. TxidModal is user-initiated and exposes a single TXID. AnchoringSuccessModal is
system-emitted after a successful action and exposes both the Merkle root and the TXID together — because both are
the artifact produced.
When to use. Only as the success surface for a state-change that produces a bundle anchor (currently just Anchor
evidence, but the pattern extends naturally to any future bulk anchoring action).
Implementation cue. Modal needs: success heading, body copy (locale-aware), the Merkle root, the TXID, the
explorer URL template. The "Done" action returns the user to the source screen with the form reset.
Examples. D2 screen 44d (Evidence anchored).
PATTERN 5
Merkle root — the bundle integrity proof
Anchor multiple files with a single hash that proves the integrity of the entire bundle.
Problem. A stage typically has multiple evidence files (photos, inspection reports, certificates). Anchoring each file
individually is wasteful — both on-chain and conceptually, since the bundle as a whole is what matters. But the user
also needs to be able to verify any single file inside the bundle.
Solution. Compute a Merkle tree over the file hashes; anchor the Merkle root only. Display the Merkle root alongside
the bundle (Pattern 4, Pattern 6) and also expose per-file hashes inside the stage milestone modal (D2 screen 25). To
verify any single file, a reviewer can re-compute the file hash, walk the Merkle path, and check that the root matches the
anchored value.
Why both root and file hashes are shown. The root alone proves bundle integrity but does not identify which file is
which. Per-file hashes give a reviewer the values they need to verify a specific file. Both are public; both belong on the
surface.
When to use. Whenever multiple artifacts are anchored as a single on-chain event. Currently used for stage evidence
bundles. Will also be used for the final dossier (Pattern 8).
Implementation cue. Pattern needs: the Merkle root, the list of file hashes, the bundle anchoring TXID. UI displays
root + TXID together; file hashes are shown one level deeper (inside the stage milestone modal).
Examples. D2 screens 25 (Stage milestone), 44d (Anchoring success).
PATTERN 6
Audit log — the proof history
Append-only feed of every state-changing event with verification one tap away.

Problem. Over a project's lifetime, dozens or hundreds of state-changing events accumulate — evidence uploads,
certifications, signatures, releases, document anchors. Reviewers (developer, auditor, partner) need a single
chronological surface where they can scan history and verify any specific event.
Solution. A reverse-chronological feed where each event is a structured row: timestamp, action title, actor role pill,
actor name, category pill, TXID HashChip. Tapping the TXID opens TxidModal (Pattern 3). Category and role pills are
also filter axes — the user can narrow to "all certifier events" or "all signatures" without losing the rest of the history.
Categories. etapa (stage events: uploads, certifications), documento (document anchors), liberacion (payment

releases), firma (notary signatures), certificador (certifier-emitted certificates). The five categories cover every state-
changing action surfaced by Patterns 4–7 and 10.

Append-only contract. Events are never edited or removed from the audit log. If a stage is re-anchored (e.g. after a
remediation), the original anchor event remains; a new event is appended. This matches the immutability of the
underlying chain.
When to use. One audit log per developer organisation, surfacing all events scoped to that developer's projects.
Future: investor-side audit log scoped to their units.
Examples. D2 screens 49 (audit log), 50 (verification modal opened from audit log row).
PATTERN 7
Verified watermark on documents
Visual confirmation overlaid on the rendered document itself.
Problem. When the user opens a document (PDF, scanned permit, certificate), the visual experience of "seeing the
document" should also carry the proof signal. A small "Verified" pill at the side is correct but secondary; the user is
looking at the document.
Solution. A diagonal "VERIFIED" stamp overlaid on the document render itself, in the same teal as the
VerificationBadge. The watermark is unmistakable, scales with the document image, and translates well to print and
screenshots.
When to use. Inside the DocumentViewerModal for documents whose hash has been anchored. Documents in
Pending state do not get the watermark; they get an orange Pending pill in their footer.
Anti-pattern. Never apply the VERIFIED watermark to a document whose hash is not actually anchored. The
watermark must always reflect a true verifiable state.
Implementation cue. Watermark is layered as a semi-transparent SVG overlay on the rendered document image.
Rotation: -25°. Opacity: 30–40%. Position: centred.
Examples. D2 screen 12 (Document viewer modal).
PATTERN 8
Dossier — the compiled-proof artifact
A single readable artifact that bundles every proof the project has accumulated.
Problem. At the end of the project — and at any point along the way — the investor (and downstream parties: notary,
bank, registry) needs a single readable artifact that summarises everything verifiable about a unit. Walking the audit log
row by row is not a substitute.
Solution. The Dossier is an automatically compiled, structured document with three principal sections: Cryptographic
Certification (the dossier hash itself, which commits the entire dossier), Milestones Timeline (every stage with its
anchoring hash), and Document Index (every supporting document with its Verified pill). Optionally, the dossier exposes
a Blockchain Traceability section listing per-milestone hashes side-by-side.
Why "the dossier has a hash". The dossier itself is anchored — the dossier hash is the master hash committing the
whole compiled artifact at a point in time. If anything inside changes, the dossier hash changes. This is what makes
"share read-only dossier link to a notary" meaningful — the notary can re-compute the dossier hash from the contents
and verify it matches the published one.
When to use. Per unit, per investor. The dossier is the long-term durable representation of a unit's full history.
Sharing. Dossiers can be shared via a public read-only URL or exported as PDF. Both forms preserve the dossier
hash so external parties can verify integrity.
Examples. D2 screens 26 (Cryptographic Certification), 27 (Milestones Timeline), 28 (Blockchain Traceability), 28s
(Share modal), 29 (Document Index).

PATTERN 9
Stage anchoring chips — per-stage proof indicator
A compact visual that surfaces which stages have been anchored on the user's unit.
Problem. On the investor unit detail screen, the user needs to see at a glance which construction stages have been
verified and which have not. The full progress timeline (Pattern: ProgressTimeline) shows construction state; this
pattern adds the specifically on-chain dimension.
Solution. Ten numbered chips (one per stage), each in one of two visual states: anchored (purple-tinted with darker
number) or pending (gray with muted number). Tapping an anchored chip opens the Stage milestone modal (Pattern 5)
which shows the file hashes and Merkle root for that stage.
Why ten chips not a single bar. Stages are discrete events with discrete proofs. A bar would communicate gradient
progress; chips communicate per-stage state correctly. A user can also tap any anchored chip independently.
When to use. On surfaces where the user already knows the project's construction stage progression and now wants
the per-stage proof status. Specifically: investor unit detail.
Implementation cue. Component receives an array of 10 stage records, each with an "anchored" boolean and (if
anchored) a reference to the bundle. Component does not load the bundle data until a chip is tapped.
Examples. D2 screens 17, 18.
PATTERN 10
Per-release financial proof
Every payment release is a separate on-chain event with its own TXID.
Problem. Construction-stage payments happen incrementally — one release per certified stage. Each release is an
on-chain event that the developer initiates after the certifier has issued the stage's certificate. The investor and
developer both need to see the proof for each release independently.
Solution. Inside the Contracts and releases surface (developer) and the Contract and payments surface (investor),
every released stage is displayed as a row with stage number, amount, date, and a HashChip with the release TXID.
Tapping the chip opens TxidModal (Pattern 3).
Why per release, not per contract. The contract is a logical entity but is not itself the on-chain artifact in the
construction-stage model — each release is. Surfacing release-level TXIDs reflects the actual cardinality of on-chain
events.
When to use. Anywhere stage releases need to be enumerated. Currently: developer Contracts and releases (40, 41),
investor Contract and payments (24).
Implementation cue. Pattern needs an ordered list of release records: stage number, amount, date, TXID, released-by
actor.
Examples. D2 screens 24 (investor), 40, 41 (developer).

---

Cross-pattern principles

Three rules govern how the ten patterns work together. They keep the platform coherent even as new proof-
bearing surfaces are added in M3 and beyond.

6.1 Patterns compose, never overlap
Each pattern occupies a distinct depth in the proof-disclosure hierarchy. A surface can use multiple patterns at
different depths, but two patterns should never compete for the same answer:
• Depth 1 — Pattern 1 (VerificationBadge): is this anchored, yes/no?
• Depth 2 — Pattern 2 (HashChip) and Pattern 9 (Stage chips): which hash, in 6+4 characters?
• Depth 3 — Patterns 3, 4, 5 (Modals): the full hash, explorer link, supporting metadata.
• Depth 4 — Patterns 6, 8 (Audit log, Dossier): the full history or compiled artifact.
A reviewer never sees the same proof material twice on the same screen with the same depth — that would be
redundant. They see different patterns at different depths, each adding a layer of detail.
6.2 Patterns never claim more than they can prove
A Verified pill (Pattern 1) requires a real anchored hash. A HashChip (Pattern 2) requires a real referenced value.
The watermark (Pattern 7) requires a real anchor on the underlying document. The dossier hash (Pattern 8) must
match the dossier's actual content. The system never displays a proof signal that cannot be substantiated.
This is the foundation of the platform's trust model. Reviewers should be able to take any HashChip, copy the full
hash, paste it into an explorer, and find the corresponding transaction.
6.3 Proof surfaces are user-initiated, not pop-up
No verification modal opens without an explicit user action — a HashChip tap, an audit-row open, an explorer
CTA. The single exception is Pattern 4 (AnchoringSuccessModal), which is the immediate confirmation after a
user-initiated anchor action — and is therefore still user-initiated, one step removed.
Auto-popping verification surfaces would interrupt flow and condition users to dismiss them without reading. The
discipline is: proof is always available, never imposed.

M3 implementation requirements
To replace the mock helpers with real Cardano anchoring while preserving every pattern in §5, the Milestone 3
build must support the data contracts below. The component API itself does not change.
8.1 Required data surfaces
Pattern needs | What the back end must return
Pattern 1 —
VerificationBadge

Per artifact: anchored: boolean. If true, references to (a) the artifact's hash and
(b) its anchoring TXID must be addressable.

Pattern 2 — HashChip The full hash string. Truncation is purely a UI concern.

Pattern 3 — TxidModal Full TXID; anchoring date (ISO 8601); explorer URL template (environment-
configurable). Action / artifact label translated to the active locale.

Pattern 4 —
AnchoringSuccessModal

After a successful anchor: Merkle root, TXID, anchoring date, count of files
included. These must be returnable in the same response as the anchor
mutation (no second round trip).

Pattern 5 — Merkle root Per bundle: the Merkle root and the ordered list of per-file hashes (so a
reviewer can re-compute and verify any single file). The platform's back end
must be able to serve a Merkle proof path on request.

Pattern 6 — Audit log Append-only event ledger scoped to the developer org. Each event: timestamp,
action key, actor role + name, category key, full TXID, references to the
affected artifacts. Filterable by category. Cursor-pageable.

Pattern 7 — Verified
watermark

Boolean signal indicating whether the rendered document is anchored. UI
handles the overlay rendering.

Pattern 8 — Dossier Compiled dossier object with: dossier hash (anchoring the compilation at a
point in time), unit metadata, per-milestone records with hashes, document
index with per-doc anchors, dossier-completeness percentage. Endpoint for
the read-only shareable URL.

Pattern 9 — Stage anchoring
chips

Per unit: an array of stage records ordered by stage number, each with
anchored: boolean and (when anchored) a reference to the bundle.

Pattern 10 — Per-release
financial proof

Per contract: ordered list of release records (stage number, amount, currency,
ISO date, TXID, released-by actor).


Constraints that the design imposes on the back end
• Truncation is never applied at the data layer. The full hash always reaches the client; the client truncates for
display.
• Locale-aware strings (action titles, category labels, role labels) are produced by the client from translation keys,
not by the server. The server returns keys; the client renders.
• TXIDs are case-sensitive strings. They must be transported and stored verbatim.
• Anchoring is initiated by the developer's actions, but the actual on-chain submission is the platform back-end's
responsibility. The client awaits the success response (with Merkle root + TXID) before showing Pattern 4.