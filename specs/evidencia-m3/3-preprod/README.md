# 3 · Pre-production

> Milestone 3 evidence, item 3: *"Pre-prod URL, screenshots of audit logs/latency confirming <12m
> median; short performance note; walkthrough video of full flow + List of transaction identifiers
> associated milestone test anchors."*

## Pre-production URL

- Web app: <https://propnexus-web.onrender.com>
- API: <https://propnexus-api.onrender.com>
- Network: Cardano **Preprod**

## What is in this folder

| File | What it is |
|---|---|
| [`volume-test-report.pdf`](volume-test-report.pdf) | The volume test of 2026-09-10: 3 projects of 10 stages each, driven end-to-end through the real web app against pre-production — 30/30 stages completed, 180/180 on-chain transactions confirmed, the measured cost, and the one incident found and how it was fixed |
| [`transaction-ids.pdf`](transaction-ids.pdf) | The formal list of the 180 transaction IDs from the volume test, each one re-verified against the chain (Koios) independently of the application's own database |
| [`txids-volume-test-2026-09-10.csv`](txids-volume-test-2026-09-10.csv) | The same 180 transactions as a data file, one row each, with a direct Cardanoscan Preprod link |
| [`reservation-to-escrow-report.pdf`](reservation-to-escrow-report.pdf) | The performance note: median time from reservation to escrow on chain, **0.33 min** over 6 real purchases (target < 12 min), with the audit-log and explorer screenshots |
| [`reservation-to-escrow-samples-2026-09-28.csv`](reservation-to-escrow-samples-2026-09-28.csv) | The 6 samples, one row each: acceptance time, block time and height, TXID, explorer link |
| [`reservation-to-escrow-telemetry-2026-09-28.json`](reservation-to-escrow-telemetry-2026-09-28.json) | The application's own latency telemetry for the same samples, verbatim |
| [`walkthrough-video.mp4`](walkthrough-video.mp4) | The walkthrough video of the full flow on pre-production, ~16 min, narrated in English: the investor browsing a finished project, the developer creating a new one and inviting a buyer, evidence upload and anchoring, the certifier observing, the developer resuming and the certifier certifying the same stage, the dossier shared and signed by the notary, verification without an account, and the audit log |
| [`walkthrough-video.srt`](walkthrough-video.srt) | The English subtitles of the video, as a separate file |

## Status

| Part | Status |
|---|---|
| Pre-production URL | ✅ |
| List of transaction IDs | ✅ |
| End-to-end flows in pre-production (volume test) | ✅ |
| Median reservation → escrow < 12 min, with audit-log/latency screenshots and a short performance note | ✅ 0.33 min |
| Walkthrough video of the full flow | ✅ |
