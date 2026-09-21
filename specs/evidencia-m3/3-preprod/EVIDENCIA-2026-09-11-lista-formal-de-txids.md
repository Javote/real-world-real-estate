# Formal TXID List — Evidence for SOM Criterion 15

> Closes item 3.10 of `CLAUDE.md` §El plan de entrega. This is delivery evidence, not narrative:
> the 180 TXIDs already existed in the appendix of `specs/evidencia-m3/3-preprod/REPORTE-2026-09-10-prueba-de-volumen.md`.
> This document is the formal publication, in a location intended for that purpose, with every
> single TXID re-verified against the live chain — not merely against what the application's own
> database reports — on the day of publication.

**Deliberately scoped to the volume test only.** The repository holds TXIDs from other moments
(`torre-a`, ad-hoc fixes made throughout September) that are intentionally excluded here — mixing
them in would have produced a longer, less legible list. These 180 are a clean, complete set: 3
new projects, 10 stages each, all 6 on-chain transactions per stage, with no gaps and no padding
from unrelated runs.

## The data file

[`specs/evidencia-m3/3-preprod/txids-prueba-de-volumen-2026-09-10.csv`](txids-prueba-de-volumen-2026-09-10.csv)
— 180 rows, one per transaction. Its column headers and stage/transition labels are in Spanish
(the project's working language — see the repository's `CLAUDE.md`), reproduced verbatim from the
source report rather than re-labelled for this document, so the CSV stays a faithful, traceable
copy of the original data. For an English-speaking reviewer, here is what each column means:

| Column (as written in the CSV) | Meaning |
|---|---|
| `proyecto` | The project name (Torre Volumen 1 / 2 / 3) |
| `etapa_numero` | Stage sequence number (1–10) |
| `etapa_nombre` | Stage name, in Spanish (the product's default locale, `es-AR`) |
| `transicion` | Which on-chain action this row records: mint (initial declaration), evidence anchor, or one of the four stage-FSM transitions (auto-advance, observe, resume, certify) |
| `evento` | The underlying event type as stored in `OnChainEvent`: `STAGE_CREATED`, `EVIDENCE_ANCHOR`, or `STAGE_TRANSITION` |
| `txid` | The Cardano transaction hash, verbatim, case-sensitive |
| `network` | Always `Preprod` — mainnet is out of scope for this milestone by owner decision (D-013) |
| `explorer_preprod` | Direct, clickable Cardanoscan Preprod link for that transaction |
| `confirmaciones_koios_2026-09-11` | Confirmation depth measured against Koios on the day this document was published (see below) |

## Methodology

1. **Source.** The appendix of `specs/evidencia-m3/3-preprod/REPORTE-2026-09-10-prueba-de-volumen.md`, parsed with a
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
