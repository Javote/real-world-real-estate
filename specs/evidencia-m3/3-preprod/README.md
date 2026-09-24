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

## Status

| Part | Status |
|---|---|
| Pre-production URL | ✅ |
| List of transaction IDs | ✅ |
| End-to-end flows in pre-production (volume test) | ✅ |
| Median reservation → escrow < 12 min, with audit-log/latency screenshots and a short performance note | ⏳ pending |
| Walkthrough video of the full flow | ⏳ pending |
