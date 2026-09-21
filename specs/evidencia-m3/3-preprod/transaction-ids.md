# Formal TXID list — the volume test on Cardano Preprod

> Milestone 3 evidence: *"List of transaction identifiers associated milestone test anchors"*.
> The 180 TXIDs also appear in the appendix of the [volume test report](volume-test-report.md).
> This document is the formal publication, in a location intended for that purpose, with every
> single TXID re-verified against the live chain — not merely against what the application's own
> database reports — on the day of publication.

**Deliberately scoped to the volume test only.** The repository holds TXIDs from other moments
(`torre-a`, ad-hoc fixes made throughout September) that are intentionally excluded here — mixing
them in would have produced a longer, less legible list. These 180 are a clean, complete set: 3
new projects, 10 stages each, all 6 on-chain transactions per stage, with no gaps and no padding
from unrelated runs.

*Source: the working document `specs/EVIDENCIA-2026-09-11-lista-formal-de-txids.md`, as of 2026-09-21.*

## The data file

[`txids-volume-test-2026-09-10.csv`](txids-volume-test-2026-09-10.csv)
— 180 rows, one per transaction. Columns:

| Column | Meaning |
|---|---|
| `project` | The project name (Torre Volumen 1 / 2 / 3) |
| `stage_number` | Stage sequence number (1–10) |
| `stage_name_en` | Stage name, in English |
| `stage_name_es` | Stage name as it is stored and shown in the product (default locale `es-AR`) |
| `transition` | Which on-chain action this row records: mint (initial declaration), evidence anchor, or one of the four stage-FSM transitions (auto-advance, observe, resume, certify) |
| `event` | The underlying event type as stored in `OnChainEvent`: `STAGE_CREATED`, `EVIDENCE_ANCHOR`, or `STAGE_TRANSITION` |
| `txid` | The Cardano transaction hash, verbatim, case-sensitive |
| `network` | Always `Preprod` — mainnet is out of scope for this milestone by owner decision (D-013) |
| `explorer_preprod` | Direct, clickable Cardanoscan Preprod link for that transaction |
| `koios_confirmations_2026-09-11` | Confirmation depth measured against Koios on the day this document was published (see below) |

## Methodology

1. **Source.** The appendix of the [volume test report](volume-test-report.md), parsed with a
   script rather than transcribed by hand, to avoid repeating a copy error across 180 rows.
2. **Independent re-verification on 2026-09-11**, against Koios (`preprod.koios.rest`, a public,
   read-only API — not the project's own node and not the application's database), the same method
   already used to close SOM criterion 9. All 180 TXIDs were submitted to `POST
   /api/v1/tx_status` in batches of 40 (the endpoint rejects request bodies over 5 KB), and **all
   180 returned a real, confirmed transaction**, with between **3,065 and 3,761 confirmations**
   each at the time of the run — months of margin over any reasonable Preprod reorg depth.
3. **Zero "not found," zero "still pending."** Had any transaction come back unconfirmed, it would
   not have shipped in this list — the same rule 17 that governs the product's UI ("never display a
   proof signal that cannot be substantiated"), applied here to a document instead of a screen.

## Summary

| | |
|---|---|
| Total TXIDs | **180** |
| Projects | Torre Volumen 1, Torre Volumen 2, Torre Volumen 3 — 60 each |
| Stages | 10 per project (30 total) |
| By event type | 30 `STAGE_CREATED` (mint) · 30 `EVIDENCE_ANCHOR` · 120 `STAGE_TRANSITION` |
| Network | Preprod, all 180 |
| Database status | `Confirmed`, all 180 |
| Re-verified against Koios | **180/180**, on 2026-09-11 |
