# Volume test — end-to-end on Cardano Preprod (2026-09-10)

> Milestone 3 evidence: *"UI flows function end-to-end in pre-prod"* and the *"List of transaction
> identifiers associated milestone test anchors"* (the 180 TXIDs are in the appendix and, formally,
> in [`transaction-ids.pdf`](transaction-ids.pdf)).

## Executive summary

**3 new projects** were created (`Torre Volumen 1`, `Torre Volumen 2`, `Torre Volumen 3`, 10 stages
each from the default stage catalog) from the real front end, against production
(`propnexus-web.onrender.com` / `propnexus-api.onrender.com` / Cardano Preprod), and **each of the
30 stages** was taken through the full tour of the stage state machine:

```
Pending → InProgress → Observed → InProgress → Completed
```

Every transition was triggered **by a real click in the browser** (Claude in Chrome), never by
direct HTTP, with the demo accounts the flow requires (`developer@example.com` to upload evidence
and "Resume stage"; `verifier@example.com` to "Observe" and "Certify"). It was the first time the
four edges of the state machine were exercised **together**, on **10 stages per project**, repeated
across **3 projects** — until then each edge had been tested once, on an isolated stage.

**Result: all 30 stages ended `Completed` in the database.** Of the **180 on-chain anchoring
attempts** the test triggers (30 mints + 30 evidence anchors + 120 state transitions — 4 per
stage), **176 had a real TXID recorded** (97.8%) on the first pass and **4 did not** (2.2%),
concentrated in **2 of the 30 stages** (Torre Volumen 1, stages 3 and 4). The investigation of those
4 — confirmed against Cardano Preprod directly, not only against the database — found that **they
are not the same failure**: in stage 3 the real transaction **was executed and confirmed on chain**,
but the application never stored its TXID (leaving a live on-chain thread the database did not know
about); in stage 4 the transaction **was never submitted**. See §Finding for the full forensic
detail — it is by far the most important result of this test, because it exposed a real case of
lost bookkeeping that no earlier test had exercised (two anchors triggered almost simultaneously).

**Final state (two sessions, same calendar day as the finding):** the root cause of the 4 failures
was confirmed (a restart of `propnexus-api` after a failed health check on Render's free plan,
unrelated to the code) and the gap that allowed them to be lost was closed in production (§Making it
more robust — 3 code improvements, deployed). The 176 first-pass TXIDs were reconciled to
`Confirmed` and **verified one by one against Preprod** through an independent source (Koios). The
stage-3 bookkeeping was corrected without touching the chain (migration
`0004_reconciliar_hilo_huerfano_etapa3.sql`), and the 3 on-chain transactions still missing (1 in
stage 3, 2 in stage 4) were submitted in a following session — see §Closing the 3 pending
transactions. **All 30 stages of the 3 projects are `Completed`, and the 180 on-chain transactions
the test triggers have a real, `Confirmed` TXID.** The same session built, at the owner's request, a
self-healing layer so this failure mode no longer needs manual forensics — §Making it self-healing
— Layers 0, 1 and 2. The service wallet's real balance was measured: **~99.8 ADA total cost** for the
test (39.83 ADA in fees + 60 ADA locked permanently, by design — there is no burn), slightly below
the plan's estimate (~105 ADA).

## Scope and goal

Repeat, at volume, what until 2026-09-08 had only been tested edge by edge:

| Transition | Who | Mechanism (UI) |
|---|---|---|
| `Pending → InProgress` | developer, automatic | first evidence uploaded (`/developer/project/:id/upload`) |
| `InProgress → Observed` | certifier, exclusive | "Observe" button (`/certifier/stage/:stageId`) |
| `Observed → InProgress` | developer, manual | "Resume stage" button (`/developer/progress`, "Observed stages" section) |
| `InProgress → Completed` | certifier, exclusive | "Certify" button (`/certifier/stage/:stageId`) |

Budget estimated in the plan: **~35 ADA per project** (≈15 in fees + 20 locked by the 10 stages × 2
ADA — no burn, permanent).

## Method

- **No HTTP shortcuts.** Each of the ~150 transition actions (30 stages × 4 edges + 30 evidence
  uploads) was executed with real browser clicks (`mcp__claude-in-chrome`) against
  `https://propnexus-web.onrender.com`, never with `curl` or direct API calls — as the owner
  explicitly asked ("everything by click in the browser").
- **Login per role**, with the production credentials: `developer@example.com` to create the 3
  projects, upload the initial evidence and "Resume stage"; `verifier@example.com` (the `certifier`
  role) to "Observe" and "Certify". `verifier@example.com` was added as a member
  (`membershipRole: "verifier"`) of the 3 new projects via `POST /projects/:id/members` (admin-only),
  because the certifier's queue only lists stages of projects where the certifier is a member —
  without that, the 30 new stages were invisible to the certifier. *(Since 2026-09-21 this is done
  from the admin screen: the admin invites the certifier and the certifier accepts.)*
- **Real evidence:** 10 PDFs generated with `pandoc` (`acta-1.pdf` … `acta-10.pdf`), reused across
  the 3 projects, uploaded through `/developer/project/:id/upload`.
- **"Don't trust the spinner" verification:** after each transition click (especially
  "Observe"/"Certify"/"Resume stage"), the state was confirmed **by reading the production database
  directly** (`turso db shell propnexus "SELECT state FROM Stage WHERE id='...'"`, polling for up to
  ~2 min) before moving to the next stage. It was adopted because clicks fired without this wait gave
  false positives: clicks that "looked" successful in the UI while the request was interrupted by
  the following navigation.
- **The progress screen has no per-stage URL** for "Resume stage" — it is a list that reorders
  itself as each action completes, so phase 3 was done by always clicking the first button of the
  "Observed stages" list and confirming against the database which `stageId` it corresponded to at
  each step, with a full page reload between clicks.

## Timeline

The five phases of the test, with real start/end times taken from `OnChainEvent.createdAt` in the
production database (UTC):

| Phase | What | Start | End | Duration |
|---|---|---|---|---|
| 0 | Creating the 3 projects (30 mints, `STAGE_CREATED`) | 15:24:30 | 15:43:41 | 19m 10s |
| 1 | Initial evidence upload + automatic `Pending → InProgress` (30×) | 15:45:45 | 16:21:18 | 35m 33s |
| 2 | "Observe" — `InProgress → Observed` (30×, certifier) | 16:24:14 | 16:49:30 | 25m 16s |
| 3 | "Resume stage" — `Observed → InProgress` (30×, developer) | 16:50:56 | 17:05:55 | 14m 58s |
| 4 | "Certify" — `InProgress → Completed` (30×, certifier) | 17:07:01 | 17:18:27 | 11m 26s |

**Total duration: 1h 53m 57s**, end to end, for 180 real anchoring attempts against Preprod (slower
at the start of each phase because of Render free-tier cold starts).

## Aggregate results (first pass)

### By on-chain event type

| Event | Attempted | With real TXID | Without TXID |
|---|---|---|---|
| `STAGE_CREATED` (mint, 1 per stage) | 30 | 30 | 0 |
| `EVIDENCE_ANCHOR` (initial evidence, 1 per stage) | 30 | 30 | 0 |
| `STAGE_TRANSITION` (4 edges × 30 stages) | 120 | 116 | **4** |
| **Total** | **180** | **176 (97.8%)** | **4 (2.2%)** |

### By state-machine transition

| Transition | Attempts | With TXID |
|---|---|---|
| `Pending → InProgress` (automatic) | 30 | 30 |
| `InProgress → Observed` ("Observe") | 30 | 30 |
| `Observed → InProgress` ("Resume stage") | 30 | **28** |
| `InProgress → Completed` ("Certify") | 30 | **28** |

### By project

| Project | `Completed` stages (declared, database) | Real TXIDs obtained |
|---|---|---|
| Torre Volumen 1 | 10/10 | 56/60 |
| Torre Volumen 2 | 10/10 | 60/60 |
| Torre Volumen 3 | 10/10 | 60/60 |

**All 30 stages ended declared `Completed` in the database**, including the 2 with failed anchoring
— consistent with the design principle that the declaration is written even if anchoring fails, and
with the permission matrix: no transition was rejected for authorization, all 30 went through the
correct role (developer for the automatic and manual edges that belong to it, certifier exclusively
for Observe/Certify). The 4 missing transactions were closed afterwards — see below.

### A note on `Pending` vs `Confirmed`

By design (reconciliation on read), `OnChainEvent.status` only moves from `Pending` to
`Confirmed` when a route that reads it triggers reconciliation — not automatically. Right after the
test, most events showed `Pending` with a real TXID: that is **not the same as "not confirmed on
Preprod"**, it means "written and with a TXID, but nobody has opened the screen that reconciles that
particular event". A reconciliation pass afterwards left all of them `Confirmed` (see §What was left
after this report, item 3).

## Finding: 2 of 30 stages with failed anchoring (Torre Volumen 1, stages 3 and 4) — root cause confirmed

**Torre Volumen 1 · Stage 3 ("Movimiento de suelos y excavación", earthworks and excavation)** and
**Stage 4 ("Cimentación", foundations)** are the only two of the 30 where real anchoring did not
complete — in both, at the same point of the sequence (event 4, "Resume stage",
`Observed → InProgress`) and with the same knock-on effect on event 5 ("Certify", `Failed`). **The
root cause is confirmed**, by crossing independent sources: Cardano Preprod directly (Koios,
`preprod.koios.rest`), the `propnexus-api` logs on Render (`render logs`) and the deploy history
(`render deploys list`).

### The cause: `propnexus-api` went down in the middle of phase 3 — free plan, no clean shutdown

```
16:52:06  Resume stage 1 and 2 of Torre Volumen 1 — confirm on chain, normal
16:54:13  click "Resume stage" → stage 3 (event recorded, Stage.state becomes InProgress)
16:54:45  click "Resume stage" → stage 4 (event recorded, Stage.state becomes InProgress)
16:54:56  the stage-3 transaction CONFIRMS on Preprod (block 5161038) — the process that
          triggered it is no longer there to find out
16:55:15  Render starts a NEW propnexus-api instance (logs: "Running '...migrate.js...
          server.js'", with no "[SIGTERM] shutting down" before it — unlike the clean
          shutdown seen later, at 17:40:03)
```

`render deploys list` confirms **there was no deploy at that moment** (the last one finished at
15:16:38 UTC, almost 40 minutes earlier) — the 16:55:15 restart was not a deliberate redeploy. And
`render services` confirms the service's plan is **`free`** (512 MB of RAM, a single instance).
**Confirmed by a fourth source, the most authoritative — Render itself:** the owner received Render's
standard email at 16:55 UTC, "we detected a server failure, HTTP check failed (timed out after 5
seconds)", matching the restart in the logs to the second. The platform's declared cause is that
**`/health` did not respond within the 5 seconds** Render tolerates before killing and restarting the
instance. The absence of a clean shutdown line is consistent with this: if the process was too busy
or blocked to answer a trivial health check, it also had no room to shut down in order.

**The exact blocking mechanism could not be pinned down.** Render's metrics API was queried for
`propnexus-api` CPU and memory in the 16:40–17:00 UTC window:

- **CPU:** never above ~8% of one core in the whole window, and in the exact minute of the failure
  (16:53–16:54 UTC) at its **lowest** point of the test (<1%). This rules out an event-loop block by
  heavy synchronous computation (building/signing transactions, evaluating the Plutus script) at that
  moment.
- **Memory:** rising steadily throughout the test — from 300 MB (16:40 UTC) to 331 MB, its peak, at
  16:54 UTC — against the free plan's 512 MB limit (64%). It did not reach the limit, so it was not
  a hard out-of-memory kill. The sustained growth — which climbs the same way after the restart,
  starting from ~131 MB — does suggest a memory leak under sustained anchoring load, independent of
  what triggered this particular restart.
- **Per-request HTTP latency** (which would have shown whether an I/O call — Blockfrost or Turso —
  hung and blocked the health check) **is not available on the Free/Hobby plan**. Without it, a hung
  external call cannot be told apart from a transient network problem on Render's side.

In short: the data rules out the two most obvious causes (high CPU, memory at the limit) without
closing the exact cause — the current plan does not provide the telemetry for that. It does not
change the conclusion or the improvements below, which close the real problem (losing the receipt of
a successful anchor when the process dies midway) whatever the specific trigger was.

**Exact consequence for each stage**, depending on how far the process got before dying:

- **Stage 3** — the old process managed to **build and submit** the "Resume stage" transaction to
  Blockfrost before going down. Blockfrost accepted it and Preprod confirmed it seconds after the new
  instance was already starting — but the process that had built it no longer existed to run the
  `UPDATE OnChainEvent SET txid = ...` that follows the `await` on the chain. Event 4 was left with
  `txid` and `outputRef` `NULL`, while the real transaction lives, confirmed, at
  `9a57f563e7d5627f22d9a062d26049d48789c91014d8b676298c0eb7c71f9e68#0`. **The anchor did not fail:
  it succeeded, and the process that had to record it did not get to.**
- **Stage 4** — the process died before its request got that far: its known UTxO (`270cfea4…#0`)
  remained unspent on Preprod — no transaction was ever submitted. This one is a simple failure.

**The new instance's logs prove the knock-on effect on "Certify"** (17:07–17:08 UTC, ~12 minutes
later, already in the new process):

```
2026-09-10 17:07:48  [anchor] el anclaje falló {
  eventId: 'd8rlw6iu9kmp8bma2nw38ycd',
  error: AnchorRejectedError: No existe el UTxO fc37cac7dd081198629a464d038e69f8130ba123295ccf2043775426cce7ea65#0
    code: 'UNKNOWN_THREAD'
}
```

That is **stage 3** ("el anclaje falló" = "the anchor failed"; "No existe el UTxO" = "the UTxO does
not exist"): it tried to spend the old `outputRef` (`fc37cac7…#0`) because the database had no newer
`outputRef` to return (event 4 never wrote it) — and that UTxO had already been spent by the orphan
transaction.

```
2026-09-10 17:08:11  [anchor] el anclaje falló {
  eventId: 'v8w15f2q7wxvjc8inod5tn4d',
  error: EvaluatorError: "failed script execution Spend[0] the validator crashed / exited prematurely"
}
```

That is **stage 4**: here it did find a UTxO (the only one, `270cfea4…#0`, still `Observed`
on-chain), but built the transaction assuming the previous datum was `InProgress` — because that is
what `Stage.state` said in the database, which had already written the declaration — and that
rebuilt datum **did not match** the real datum on-chain. The Aiken validator rejected the transaction
because the declared previous state was not the real previous state. The validator worked exactly as
designed — the problem was that the database and the chain no longer agreed on the previous state.

### Real impact

Because the 4 phases of the test ran over all 30 stages equally, stage 4's `Stage.state` also ended
`Completed` — terminal in the state machine — so no UI action could repair either stage.
Both required the same thing: writing the real `outputRef` into `OnChainEvent` and building by hand
the missing anchoring transaction. That was done in the same day's second session (below).

## What was left after this report — all done

1. **Repair the orphan threads of stages 3 and 4 — done.** The UI could not do it (both stages were
   already `Completed`), so it was resolved against the anchoring port directly, with the real
   production credentials verified first (deriving the wallet address from the private key, offline,
   and comparing it with the one that produced the 176 first-pass transactions). **Stage 3:**
   bookkeeping corrected without touching the chain (migration
   `0004_reconciliar_hilo_huerfano_etapa3.sql`) and the missing "Certify" transaction submitted.
   **Stage 4:** the 2 transactions that had never been attempted, submitted. Detail and the 3 TXIDs
   in §Closing the 3 pending transactions.
2. **Confirm the cause with server logs — done.** See §The cause above.
3. **Run a reconciliation pass — done**, on 2026-09-10, after deploying the fix. `POST
   /evidence/reconcile` run by hand (admin) against production: **72 events** moved from `Pending` to
   `Confirmed` — together with those already confirmed, **the 176 real transactions of the test are
   `Confirmed` in the database**. The response also returned `sospechosos` ("suspicious", improvement
   #2 below): besides stages 3 and 4, a **third, pre-existing case** appeared, from before this test
   (2026-09-08, a different project, not one of the Torre Volumen ones), later closed as well (see
   §Closing the 3 pending transactions).
4. **Verify the appendix against the chain — done.** **The 176 TXIDs were verified one by one
   against Preprod via Koios** (`preprod.koios.rest/api/v1/tx_info`, in batches of 40) — **176 of
   176 really exist on chain**, zero missing. It is a source independent of the production database:
   not "the app says these TXIDs exist", but "Cardano Preprod says these TXIDs exist".
5. **Measure the service wallet's real balance — done.** Current balance of
   `addr_test1vp3vy56p6lrghhntg8ytydnuugnqh7ctkyxn3rm35g4q2ggtqvncw`: **9,870.97 ADA**. No "before"
   balance was captured, so the most honest measure is the one rebuilt from the transactions
   themselves: summing the real `fee` of the test's 176 transactions gives **39.83 ADA in fees**,
   plus **60 ADA locked permanently** (30 live threads × 2 ADA, no burn) — **≈99.8 ADA total
   real cost, ≈33.3 ADA per project**, against the plan's estimate of ~35 ADA/project (≈105 ADA for
   the 3). **It came in slightly under budget.**

## Making it more robust and transparent — ✔ implemented on 2026-09-10

The confirmed root cause is an infrastructure event (Render killing the process over an unanswered
health check) — but **the reason for a restart can change at any time** (a deploy, a real
out-of-memory, any other crash, a manual `kill -9`), and the underlying problem was that **the code
did not survive the process dying between "the transaction went to the chain" and "its receipt was
stored"**. That window always exists, whatever causes it. Three improvements, all implemented and
verified the same day (full `pnpm verify` green):

1. **✔ Close the loss window, not just detect it.** Anchoring no longer waits for confirmation
   before storing `txid`/`outputRef` — the `UPDATE` with the receipt runs as soon as the chain call
   returns, and confirming became a best-effort second step: if it fails or the process dies there,
   the event stays `Pending` with a real TXID (never `Failed`), and reconciliation confirms it later.
   The same fix was applied to the two other call sites with the same logic. New test in
   `test/stage-transitions.test.ts` that reproduces stage 3's exact scenario (confirmation throws;
   the TXID is still written with `status: "Pending"`, never `"Failed"`).
2. **✔ State-based detection, adapted to a project with no cron or `setInterval` inside the API.**
   `hilosSospechosos()` ("suspicious threads") is a query, not a job, that finds every
   `STAGE_TRANSITION` without a `txid` whose stage already has a newer event — exactly the shape of
   the stage 3 and 4 finding. It was added to the response of `POST /evidence/reconcile`. Three new
   tests in `test/reconcile.test.ts`.
3. **✔ Make a failed or lost event visible without having to look for it.** The three catch blocks
   for failed broadcasts now call `Sentry.captureException` as well as logging — before, it only
   stayed in Render's log, with the short retention this same session ran into while investigating.

**What was deliberately not proposed:** upgrading Render from Free to a paid plan to avoid the
health-check kill itself. It is the *trigger* of this particular case, not the underlying cause — the
same problem can happen for any other reason, and with fix #1 it no longer matters which — and it is
a cost decision, not a code one.

The code changes were reviewed, committed and pushed the same day (commit `56556c6`, deploy
confirmed `Live` on Render).

## Repairing stage 3's orphan thread — bookkeeping corrected

Correcting stage 3's bookkeeping (so the database points to the real UTxO) anchors nothing new — it
corrects data that already existed on chain, without touching the chain.

**Checked before touching the database:** that the local credentials were the real ones. The wallet
was verified **by deriving the public address from the private key, offline**, and comparing it with
the address that produced the test's 176 real transactions: they match.

**Dry run first:** the correction was wrapped in `BEGIN; UPDATE ...; SELECT ...; ROLLBACK;` in a
single `turso db shell` invocation, to see the row exactly as it would end up without committing.
Once the result and the rollback were confirmed, the real `UPDATE` was run.

**The change is versioned, not a loose `UPDATE`:** `apps/api/migrations/
0004_reconciliar_hilo_huerfano_etapa3.sql`, with an idempotency guard (`AND txid IS NULL`) so it
does nothing on any other database or when re-applied.

```sql
-- apps/api/migrations/0004_reconciliar_hilo_huerfano_etapa3.sql
UPDATE `OnChainEvent`
SET `txid` = '9a57f563e7d5627f22d9a062d26049d48789c91014d8b676298c0eb7c71f9e68',
    `outputRef` = '9a57f563e7d5627f22d9a062d26049d48789c91014d8b676298c0eb7c71f9e68#0',
    `network` = 'Preprod',
    `status` = 'Confirmed',
    `blockTimestamp` = 1789059296000,
    `updatedAt` = unixepoch() * 1000
WHERE `id` = 'amc9u0gyovc9tlf5z9ceh4db' AND `txid` IS NULL;
```

**Result, verified against production:** `POST /evidence/reconcile` no longer lists stage 3 among
the suspicious threads.

## Closing the 3 pending transactions — all 180 confirmed

The 3 missing transactions were submitted against Preprod with the same verified credentials:

| Stage | Transition | TXID |
|---|---|---|
| Torre Volumen 1 · Stage 3 | `InProgress → Completed` ("Certify") | `8753cd70211c4f8182da14d25375f81218d8a0568975e4ad0d5e76557ab148a4` |
| Torre Volumen 1 · Stage 4 | `Observed → InProgress` ("Resume stage") | `cf23d689952846413a4efedea45c4d148e8a9284796ae47e2010c05a84e10f4a` |
| Torre Volumen 1 · Stage 4 | `InProgress → Completed` ("Certify") | `75b9dcfd267848cefcc7a150f84b816524769736dfca7694012f53380d341ba8` |

**How they were sent:** a one-off script (the precursor of the Layer 2 tool below) that built each
datum and called the anchoring port against the real adapter. It did not touch the database — it
printed the `UPDATE OnChainEvent` for each step, to be run separately after review.

**A stumble along the way, without repeating the bug this session came to close.** The first attempt
(stage 3 certify) crashed *after* the transaction had already gone out — a `JSON.stringify` over an
internal adapter object carrying a `BigInt` —, exactly the window the robustness fix had closed in
production code. It was resolved with the same forensic discipline: the real transaction was looked
up on Koios (the wallet's `address_txs`, ordered by `block_time`), its inputs/outputs verified and its
resulting datum decoded against what was expected before accepting the TXID. The script was fixed
and the two remaining steps ran without problems.

**Verified against production after the three:** `POST /evidence/reconcile` returns no suspicious
thread for Torre Volumen. **All 30 stages of the 3 projects are `Completed` in the database, and the
180 on-chain transactions the test triggers (30 mints + 30 evidence anchors + 120 transitions) have a
real, confirmed TXID.**

**The pre-existing 2026-09-08 case, closed the same day Layer 0 surfaced it.** That event (on the
older `torre-a` project, `InProgress → Observed`, `Failed`, no `txid`) belonged to a stage seeded
directly in the database before the stage template existed, which **never had a real on-chain
thread** — so it could never be repaired and would have reappeared as suspicious on every run. It
was removed from production (migration `0005_borrar_intento_sin_hilo_estructura_torre_a.sql`, same
dry-run and idempotency-guard pattern). `POST /evidence/reconcile` afterwards: no suspicious threads.

## Making it self-healing — Layers 0, 1 and 2 (✔ implemented on 2026-09-10)

The finding showed that **detecting** a suspicious thread is not enough if nobody runs the
reconciliation — and that, even then, the only possible repair was the manual forensics above,
repeated by hand for each case. Three layers, each solving the part the previous one leaves out:

### Layer 0 — someone finds out, without having to remember to look

`.github/workflows/reconcile.yml`: a GitHub Actions cron (now daily at 06:00 UTC, plus
`workflow_dispatch` to run it by hand) that logs in as admin and calls `POST /evidence/reconcile`
against production. If the response contains a suspicious thread that Layer 1 could not repair on
its own, the job **fails on purpose**: a red run in Actions triggers GitHub's default notification,
with no new alerting channel for a problem that is rare today.

**Why GitHub Actions and not a cron inside the API:** an internal timer stops counting as soon as
Render puts the service to sleep after 15 minutes of inactivity (free plan, no workers). The cron
fires from **outside** the process.

### Layer 1 — repair the bookkeeping automatically, signing nothing

Stage 3's case — a transaction that **did** go out and confirm, with the database simply unaware of
it — can be repaired with no risk: nothing new needs to be built or signed, only the real UTxO found
and the lost `txid`/`outputRef` filled in. The anchoring port gained `findLiveThread(stageRef)`,
which locates a stage's live thread by the asset of its thread token, implemented in the real,
simulated and disabled adapters. `repararHilosSospechosos()` ("repair suspicious threads")
uses it: for each suspicious thread it finds the live one and, **only if the state in the datum it
finds matches the state the event already declared**, fills in `txid`/`outputRef` — leaving the
status `Pending` for regular reconciliation to confirm. If the datum does not match — stage 4's case,
where the transaction never went out — nothing is touched: that repair stays manual by design.

`POST /evidence/reconcile` now runs repair, reconcile and list-suspicious in that order. Covered by
tests in the simulated adapter, the real adapter (against Lucid's emulator, with the real validator)
and `reconcile.test.ts`.

### Layer 2 — the tool for when signing is actually needed

What Layer 1 never does on purpose: submit the missing transaction when the real thread is **not** in
the required state (stage 4's case). That still signs with the service wallet key and spends real
ADA, so it is a manual tool, `apps/api/scripts/repair-thread.ts`, built at the owner's explicit
request that there be "no risk of spending ADA":

```bash
pnpm --filter @plataforma/api exec tsx scripts/repair-thread.ts \
  --stage <stageId> --to <InProgress|Observed|Completed> \
  [--evidence-root <64 hex chars>] [--completed-at <epoch ms>] [--confirm]
```

It reads the stage from the database, finds its live thread with `findLiveThread` (Layer 1),
validates the transition against the state machine and builds the next datum. **The risk removed is
not that the tool can sign — it is that it signs by accident:**

1. **Without `--confirm`, it is a dry run:** it prints the live thread found and the datum it would
   build, and stops there.
2. **It is not a route or a job.** It lives in `scripts/` and only runs by hand. No production code
   imports it.
3. **It does not touch the database.** It prints instructions for the later reconciliation instead of
   writing `OnChainEvent` directly — that write remains a human review.

## Appendix — TXIDs per stage (180/180, all 180 confirmed on chain)

The 176 first-pass TXIDs were verified individually against Cardano Preprod via Koios, not only
against what the database says. The 4 missing ones from Torre Volumen 1 / stages 3 and 4 were closed
afterwards (one was pure bookkeeping — the transaction was already on chain — and the other 3 were
submitted), verified against the production database: the 6 rows of each of the two stages are
`Confirmed`. Stage names are kept in Spanish, as they appear in the product (default locale `es-AR`).

Grouped by project and stage, in state-machine order.

### Torre Volumen 1


**Stage 1 — Adquisición del terreno**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `3527dae63d58996878f59dbc83f91903173e8943b2d5e3e9e4da12fecd0cde96` |
| Evidence anchor | Confirmed | `bce9a2ac69130202ffdc6cd580b6f63fb102093d92eec2e095883172d0722485` |
| Automatic Pending→InProgress | Confirmed | `e82bc35a335cbfe869e05def53c29322e95496a84043794e5a72ec613f198ae1` |
| Observe (InProgress→Observed) | Confirmed | `a27f329fe7aad4456425ca59489ffd26071a06d771924f66f4c880ac14df2b6c` |
| Resume (Observed→InProgress) | Confirmed | `e7f9c7b7d88bf9d84c5931a35f40742c4a1a6fb69a5081aa797a7be91ee23e95` |
| Certify (InProgress→Completed) | Confirmed | `3a1f95cf82ac4e12c267e3645439e3e8013c4548fe754d4ac203e5b1044e68eb` |

**Stage 2 — Proyecto ejecutivo**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `ca6793e071de3b19dbc25136e6868ce3adf5a46c0fe4d8b77e3389c282cc7573` |
| Evidence anchor | Confirmed | `b377f2b157b47f9a98d02c418f7423dc08613dd62bda6b03cfd1b26cb37e9ece` |
| Automatic Pending→InProgress | Confirmed | `7412e42b9403a4e4051d2adcb7782b76e61ec117cee45d01f1621bdf264b8b47` |
| Observe (InProgress→Observed) | Confirmed | `5bef86563f8cfb543aa448fe91bbd4ed565ac2d21678adf88f33e8364ea02289` |
| Resume (Observed→InProgress) | Confirmed | `ad8b6633882a6f3cbc3e367f46211be40c6101fc4f862934d5902a72b828ed53` |
| Certify (InProgress→Completed) | Confirmed | `cf0e14652205163b33309519227bf341a490e78b80ddac0a06503fdf40fd7c27` |

**Stage 3 — Movimiento de suelos y excavación**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `61067ba2fe920bfbb350559ba7007a7beed7dd9790713878df3fd0ba3b3b6240` |
| Evidence anchor | Confirmed | `0132d1497f2e63247bd78d13728c46c31748114bb3de7e838535c9e428eafb2c` |
| Automatic Pending→InProgress | Confirmed | `49a6be960d61ba55ba4d16de9b766676d4da155581dcbccace52621e2fe4dbf6` |
| Observe (InProgress→Observed) | Confirmed | `fc37cac7dd081198629a464d038e69f8130ba123295ccf2043775426cce7ea65` |
| Resume (Observed→InProgress) | Confirmed | `9a57f563e7d5627f22d9a062d26049d48789c91014d8b676298c0eb7c71f9e68` |
| Certify (InProgress→Completed) | Confirmed | `8753cd70211c4f8182da14d25375f81218d8a0568975e4ad0d5e76557ab148a4` |

**Stage 4 — Cimentación**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `ad0fe12703dd89470f4ad7b9ee69b9e681dc0434f14edc685a673c2f191609e4` |
| Evidence anchor | Confirmed | `46bf2b8c64b10eb26a99005d888339c423ae692eee5d3b02fddfe9d5e40737e7` |
| Automatic Pending→InProgress | Confirmed | `1972aa5e68d4fe800a6542f16f956b7352d8f7bd62752dedd3c5b725f89a12a4` |
| Observe (InProgress→Observed) | Confirmed | `270cfea4fabf232573e94b69324b69054f41f344fbaeca6b95dfe5d16595dd06` |
| Resume (Observed→InProgress) | Confirmed | `cf23d689952846413a4efedea45c4d148e8a9284796ae47e2010c05a84e10f4a` |
| Certify (InProgress→Completed) | Confirmed | `75b9dcfd267848cefcc7a150f84b816524769736dfca7694012f53380d341ba8` |

**Stage 5 — Estructura planta baja**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `3319e8e26babbb02ecabb14214c956abf6b7e79ccbb9de410817362562e1e25d` |
| Evidence anchor | Confirmed | `113e729ec564b8f3c748145bd0645a2b56fbfc54654202d1e20f116f843addfc` |
| Automatic Pending→InProgress | Confirmed | `5736ced65bb251ca350fb1d9e31cafffac192906e3dcd94d1675914127162576` |
| Observe (InProgress→Observed) | Confirmed | `0fb0feb61c995364d63b023c94a37e0372ca0d1d2a11db0569dc90937236b2a4` |
| Resume (Observed→InProgress) | Confirmed | `cbf60e0a3ceb830ff8fcc80a6cabcb876887c56118b2c4f3e0d8dc04e51edca3` |
| Certify (InProgress→Completed) | Confirmed | `636260b0b67c0fc9f56a5baef91864c82221bf2dde0f653dba119ca0d3ba56f6` |

**Stage 6 — Estructura niveles superiores**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `f24667903957ee5f1e861bff00e6d754a21e1b7ae8c2c8cd18862fa0d745f482` |
| Evidence anchor | Confirmed | `b6e9e7d651d15a69d7757a039ec2dc56ba4b82352a300ae545aa09b6deb4b6ad` |
| Automatic Pending→InProgress | Confirmed | `fddf96d86bab1f01b5db73c000b9e571ee9fdc88841873af5056458e073fa4de` |
| Observe (InProgress→Observed) | Confirmed | `0657eebfa52e3775595c9f1b2ad5ff5bb989c1decf359355674325b4c7f238a4` |
| Resume (Observed→InProgress) | Confirmed | `d5e8f54c298f8fb0f42a16685090526af1466a55e5a5ed733e065c47cecc1556` |
| Certify (InProgress→Completed) | Confirmed | `c3c0bd1925eaa0554bee0daf3e0ff05e84787ee377ba22d909d20f4e437a82fc` |

**Stage 7 — Cerramientos y mampostería**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `3759177e0e18f520b02454d3df9bb9066aa2f58cb37a4ca4a61615171c6c3ed1` |
| Evidence anchor | Confirmed | `4aa94e5207574700a1adc214ac9551c947fc76151e248eea02b4d4e57263411b` |
| Automatic Pending→InProgress | Confirmed | `17b8ba858673a85930a20c98f25a4cf9ab0ac11715b6924b3e22b9c4e82c015f` |
| Observe (InProgress→Observed) | Confirmed | `fac73f94fad34601f9cbdc2ad8b0b4ad8bff371248430c762dcde6ff2f0414c2` |
| Resume (Observed→InProgress) | Confirmed | `06f51b9cd7f773b3b68dcb95c1ff1039e53458d63703b3bb304bfee44610c689` |
| Certify (InProgress→Completed) | Confirmed | `5b080c1ffd8988c6f60603334bbc9447ce31fc3944c873b1fba5654205e81e70` |

**Stage 8 — Instalaciones**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `0b71997e680748e92cf06e09db8d65fe17cc625f2e3af046d5b0a869aff47189` |
| Evidence anchor | Confirmed | `f73af36678a0f54ee50ce54dec25ab9899c2a018c14c4dc6659e5f0905a13ab8` |
| Automatic Pending→InProgress | Confirmed | `fd78664b3b6599ff99097f1fd2e7bd99c70cf9afbecd4fe2d1bbc071a8b853fd` |
| Observe (InProgress→Observed) | Confirmed | `cb46248e9fed481262dda1d514e05b26db8dbf337e747dc5203c397794eabdbb` |
| Resume (Observed→InProgress) | Confirmed | `dcef912606d674522fb6a581e14d48a457683b1ea77898646486f1138a6615b6` |
| Certify (InProgress→Completed) | Confirmed | `ead1aa198a77e19bb2d73bc3529203e08afe8b50aae334edf66b766253f5dfca` |

**Stage 9 — Terminaciones**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `085ebd2ec2b589ac2baf8dbae106118c74e27d24a02eb9811078f0b5cfe2c6fb` |
| Evidence anchor | Confirmed | `6c6c1e208285c9395a099d0f5502e3d9ab5083adbc8629068decf9241254012d` |
| Automatic Pending→InProgress | Confirmed | `c837dd192222c49ee971a9d8188195dd35d4216422d8b2fb12cc3a9d0bdb37d0` |
| Observe (InProgress→Observed) | Confirmed | `531cb045476bce32010fb54e588e48566b871aebfd9b1a05f05927a2a3eed82b` |
| Resume (Observed→InProgress) | Confirmed | `2cbb0bc5b1abac1cee1120499fc4c28fb78749f8ccc2c3a8e39e1784a7f9aeba` |
| Certify (InProgress→Completed) | Confirmed | `9ebcf753e8c88ba6b4c3aed1de2b41bd968aa1d74a66e325fb83aaf68ae3bc5b` |

**Stage 10 — Final de obra y subdivisión**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `fe3d21b358bf931e5f78dbc559f66cc2b2b341a9c5a62dc95c504dd6ef0af2b2` |
| Evidence anchor | Confirmed | `36fce09bd1a041b41fbb04fa573b1f4f253e95e0cd62d0bc2cf9dd010e346dad` |
| Automatic Pending→InProgress | Confirmed | `831a17ab5b34365437787729cdb2750a90a033af858ff839738c6e9a665fd9e7` |
| Observe (InProgress→Observed) | Confirmed | `2e5f84b76f0a9f950cad20018d1aac526981044e1c135cd2bc9aa9bc15873609` |
| Resume (Observed→InProgress) | Confirmed | `aa1abfd70a388fcb26eb2e3ffab3d12e6450db4e8c866bd7d286a85ea333714e` |
| Certify (InProgress→Completed) | Confirmed | `ab9794a5010eb0d6f672cd0e9bc45f1499a8e38f904e3ca080625c7714b95ba7` |

### Torre Volumen 2


**Stage 1 — Adquisición del terreno**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `d253922c485274b6c4cc79069564fc25ffc0fd9380ef5944d6963462437cf0af` |
| Evidence anchor | Confirmed | `f4df818e30b64f7c74fbcfd54308a83a5d0648fb2018701bbe33b43d6fdaca33` |
| Automatic Pending→InProgress | Confirmed | `e6df4aba0a3fb38179cd69b9eb817e3fdd06dbf0aa6ca67174cf065ac835e72f` |
| Observe (InProgress→Observed) | Confirmed | `5bf3fc45f50b9c91be9ebe3edde5565b6938dcffd7d76065f3d4832dfc5c4125` |
| Resume (Observed→InProgress) | Confirmed | `c9227010477854f49378182140753ea3a5a8dcd67ff98d480bd4d5b7864bc166` |
| Certify (InProgress→Completed) | Confirmed | `6b50c5ca5ede70b2963b6c395e3d4b51ead85f6588b2ad07a91394597e9bcab6` |

**Stage 2 — Proyecto ejecutivo**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `9b14ec76069b288397955f48fd40f5f2ae532c456be4c2e0d0b6860dcd39d6a2` |
| Evidence anchor | Confirmed | `d4e4734b359498ae890865f40b3df84d7de5b22be792f547b51f3886a7c06d9d` |
| Automatic Pending→InProgress | Confirmed | `0d9034de19a21a23accef7e0054147ea8569a8f33610681e40de1defe110e30a` |
| Observe (InProgress→Observed) | Confirmed | `e1d0528b8ec48ed2f601d11ffda0250143153c66bbc2bf424a293114e13fc92c` |
| Resume (Observed→InProgress) | Confirmed | `c2768c1e712d7e6f42484a56ceb2de5bdd1a3684daa1fcdf00dcea6958dd798e` |
| Certify (InProgress→Completed) | Confirmed | `2f754af5c1b445d300ed81bc8a5ece986516518bdacbd17e072baf4cb19258a3` |

**Stage 3 — Movimiento de suelos y excavación**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `d5fced405b5b3f256c0a33b19cce9284ef76d321086eb41315ebb8cb329e2aa2` |
| Evidence anchor | Confirmed | `b36aa79c33c85fbef36c25f270c8f7ac28521d75f3579b163ef01c8dd07b1aa2` |
| Automatic Pending→InProgress | Confirmed | `ac7bd08fd8bee1bda6ddce08f89a6f0ff1dcfe98e1b14196777bb8f9df9d792c` |
| Observe (InProgress→Observed) | Confirmed | `ea8c78ef3244e8551af2e42db2a37fb40a4d14b091d6aa4797c0baf12385e03a` |
| Resume (Observed→InProgress) | Confirmed | `d451bbbce026434ecb2a76b38dd516ad63b24835f24a9522631bd270b00c78b5` |
| Certify (InProgress→Completed) | Confirmed | `a5c90d6cef0dd15f1553ad3a40437e7e008e32e99963883d4e9d551358724f0f` |

**Stage 4 — Cimentación**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `5fa9493e2208ed94696354d7ca7374acb97a2683bb496db46d91a96b39f422fc` |
| Evidence anchor | Confirmed | `5cd74d393fd69e74d84eb156d66e4c40f7b489a9f003399a8d68a248918cc0c0` |
| Automatic Pending→InProgress | Confirmed | `286586df2416fa21d83dd4aa17b40ab6dbb900ddd835adf6a3beada2ee9bebaf` |
| Observe (InProgress→Observed) | Confirmed | `80c693dfcb59abc77128c7a276750e27d1c0e80f89a6103f7178f02d58d5c543` |
| Resume (Observed→InProgress) | Confirmed | `255bfd5c4f577ec14031e920d4520e2f9656fb822fa07402f68343199d987f47` |
| Certify (InProgress→Completed) | Confirmed | `0238a9ae5ae6bb5ac96595ca9a58eca215d52b2f0106bc155096a163c12b2d25` |

**Stage 5 — Estructura planta baja**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `d2a43fe211837f40b1c273bd0196fbcb5dd67b329c7e0cee45883e210efff398` |
| Evidence anchor | Confirmed | `c9f7e5817a409c2850ed8b082830de1542aabf2c382d46e9dfef48e7cd4f49a7` |
| Automatic Pending→InProgress | Confirmed | `33f7deb053da97125c4ba61ab4b70af8ba00c3a9ecb9f556012275ddade0463a` |
| Observe (InProgress→Observed) | Confirmed | `ae376b86bd727974574c77a007bd07e0f69b24963bbc2ae778b2a2975efc278f` |
| Resume (Observed→InProgress) | Confirmed | `0069507b3c1aba88ad4852cf56265c2bf729b7857f35458d4d495062533c9455` |
| Certify (InProgress→Completed) | Confirmed | `3031b0198fce05fe9b25efa5e3b28138ab06bc1baf00a00c86599cad527102bf` |

**Stage 6 — Estructura niveles superiores**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `de5e195779b814a20b9a37938ab245f0c0e9b6b599683c9d564f6a69439ff235` |
| Evidence anchor | Confirmed | `40fd381daecbc1239c73afd07ae0d8907c39a6e99d77dc063158b608f1ac50c7` |
| Automatic Pending→InProgress | Confirmed | `c71d3593cacbd643498c26602fd557b4527c692f350c5ff35a76e95af04e3f0c` |
| Observe (InProgress→Observed) | Confirmed | `9d7696c5523f83fb3ebe2c8df7ba75c35eaaa92d53cc92c21468c68382b41dc9` |
| Resume (Observed→InProgress) | Confirmed | `a9cf646aca7a1b4d0fe16b31dbf2b8ed55f266689ea443d0b7c52efb31f70f6e` |
| Certify (InProgress→Completed) | Confirmed | `cad2aa46265feefc9eadc0324fe139d94e3192ebd89898a13cfce4a453e77c85` |

**Stage 7 — Cerramientos y mampostería**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `633a5f5980c845f408268a536d310083363ae56dd0b27997e8c3a8457e594952` |
| Evidence anchor | Confirmed | `158155667d6fb5fdc137407f3b998c75a8a14f0030c12f5457be5084c1614385` |
| Automatic Pending→InProgress | Confirmed | `38b669b2f33c33d958b8f6f4ecafe2247045b05ada288aa8d1a20780bfbf84aa` |
| Observe (InProgress→Observed) | Confirmed | `19ebb84a3808df8417577c7dcef4292d246dfed0a4c363d1596526b1ed214c2d` |
| Resume (Observed→InProgress) | Confirmed | `102cc832b73b5aa3c95f7adc339d4c170a2ece3a7a8076df7090795909aa4814` |
| Certify (InProgress→Completed) | Confirmed | `315dbbc13bae27a06ef2af9025a6f637bbe6f7f53ede69b41f2c223c0b775d23` |

**Stage 8 — Instalaciones**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `735f7fab3ae469793fa1a4028f58c107f81849abd84ae60911d1f852222d1352` |
| Evidence anchor | Confirmed | `4a37d7aaf2b6a51ea236e38bc7316a33d6aa944fc3f9b76497dfa93244cfeb4f` |
| Automatic Pending→InProgress | Confirmed | `5065f1bfc75da300f487d69fcc434df504010aa3127aec150291d1672f4aecab` |
| Observe (InProgress→Observed) | Confirmed | `7cc8a4e5f24fc15f47c8d1b10d783cce7d0634840455b12d0ddfdfbe1a62a54c` |
| Resume (Observed→InProgress) | Confirmed | `faa7d80e3b9538dff557fde2d43fac7f44d1e1674c690cfadab61b7b0cb2c261` |
| Certify (InProgress→Completed) | Confirmed | `74058d465ec1bf0517f214f57b6eea27c07d0d85fd5a7065611e90bc48d40e98` |

**Stage 9 — Terminaciones**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `c06642bba288567c32f141bd5da62ee82a52c12c23864473ba4120b6a7f1bd88` |
| Evidence anchor | Confirmed | `ad7e1aefb94eb8a1b2867e33be8bf6d11fb79882bb9c8a0f2c008f912d9a1d0c` |
| Automatic Pending→InProgress | Confirmed | `35f7ce36629175fff331a418e1efadd917a0984fe86e02ad71d35b2c0da2bdbd` |
| Observe (InProgress→Observed) | Confirmed | `477a5c8bb0b2958ab8ace93f497fa2d8375b08b5d4fddfba79889a289f7dcca4` |
| Resume (Observed→InProgress) | Confirmed | `96b9f7ab479256e13dbc9bdd35bc553903205e7eee900c7b9717395a6835b803` |
| Certify (InProgress→Completed) | Confirmed | `5ed43e6c8240e65a654d21f85dee44c622ced1fb1bd287f76290893dd171b1de` |

**Stage 10 — Final de obra y subdivisión**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `93f98d71bede9119dd49958f9ec002b879e542dafe53558f4a3605215911ff4f` |
| Evidence anchor | Confirmed | `c34314d4276c030a43919d9d0f13b82edb3f36cb2e90cc19dfdde6e253f4a3ed` |
| Automatic Pending→InProgress | Confirmed | `c6d7abb1f40c74f8e5a185e152c37bf27ea1f3c2370cdaba0a6614b484eca841` |
| Observe (InProgress→Observed) | Confirmed | `4875496d4d31421226fca6216e41225a8c6f19fb29c5b633bdb4732e2e76dbe0` |
| Resume (Observed→InProgress) | Confirmed | `9ba0f810eb545ddf0060c9d092cdba0cbc563b53853c6509f9ec75f85b6da3ca` |
| Certify (InProgress→Completed) | Confirmed | `937b31b71561537cce17ea8a50c85e85c5f69c8af679e8bff6763eb22cf81ab3` |

### Torre Volumen 3


**Stage 1 — Adquisición del terreno**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `478b903123df671aa422103d75b89a5ef8fce216fb2888518f471d2451b1fee8` |
| Evidence anchor | Confirmed | `439b10c4d6cde16501854011a7326c59b5315157c2b04708c1e23196398ede2e` |
| Automatic Pending→InProgress | Confirmed | `2d8e33cb04a1e05b7f552e0c6e143adc149c7f55daad9923dec1417605e6c830` |
| Observe (InProgress→Observed) | Confirmed | `9c54abe7db22e85d1bcbcc0ca525142e41b104f4c1be8f711771377d4e0bc358` |
| Resume (Observed→InProgress) | Confirmed | `17881ea34c88ada58eef0bb6d77533243a4da08fed8ecfde0d16894509f486a2` |
| Certify (InProgress→Completed) | Confirmed | `1d0bc8acd3918d6f35801a183e91cfe74cf789fe12835357cb706d02765c0029` |

**Stage 2 — Proyecto ejecutivo**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `3144dac1045e54597f3df797b097b87a660c26477ba0595b91a68bc2be80d9ab` |
| Evidence anchor | Confirmed | `f25230d359ca45f5aa0045412577cfc533f38bddc875ddc9ead7a0d131dc1ff6` |
| Automatic Pending→InProgress | Confirmed | `2195d5cc0e277172f5e76cc2b2e4c2453f8913481d1192eb156e8ce2cd5727c1` |
| Observe (InProgress→Observed) | Confirmed | `9f29b951d7eb9d2b03328b341dcf970a5b51bf3632324007e10c032dfd4850be` |
| Resume (Observed→InProgress) | Confirmed | `4a160f105af3eb4df18d96523240cde2c28ed14bf33c0ab84983e698c5e4e402` |
| Certify (InProgress→Completed) | Confirmed | `02ccd48a5eceb2e511ab45adf6aa1d261f04791cb389a9a66332f9c760a80bc9` |

**Stage 3 — Movimiento de suelos y excavación**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `bf850b52b5c2884952da8731c9599b39eb7602a60171e42c79695ed00a3391b3` |
| Evidence anchor | Confirmed | `835b6b83fb1edf009fe97f9d7197b0f111acc77da3acccd560cdc01a72abc49f` |
| Automatic Pending→InProgress | Confirmed | `4b07aad729cd5a8861fdbcf00da201669ca333cb90d895d43d5a70e62b87c347` |
| Observe (InProgress→Observed) | Confirmed | `6657dcfdcb1614ee66f7c9c525c1f5f285e242076c2f222fea13916ca92bad2f` |
| Resume (Observed→InProgress) | Confirmed | `7948229bd3215f47760142496f48518a1399fd40aff113acee1ece60ec78c452` |
| Certify (InProgress→Completed) | Confirmed | `13de262947dc69cf7e8e63c02b373dbfcdb8436a1a0d3855935d2f0a64b499ba` |

**Stage 4 — Cimentación**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `9b1bf8420d87c8ca697574ff3dfa2dd107c5ad5de54d4e6a07aa802f8a11abd1` |
| Evidence anchor | Confirmed | `ac7625e149a06742f57d7cc5a8ab215647d96b880ce35e0ef39fb08662d12248` |
| Automatic Pending→InProgress | Confirmed | `39d31941d695af5fc4cb5dd9e14d9331d6ab4a00e674d06eeb6ea3d69f5817cf` |
| Observe (InProgress→Observed) | Confirmed | `eab045b18ade0bda509b1bf52c63e4495feec0aa00757c1708136786b455d8ce` |
| Resume (Observed→InProgress) | Confirmed | `a91c57f134f0431df4d3065684a3c8d1ff7ae374d7fef6295bee6f4295bc9d4d` |
| Certify (InProgress→Completed) | Confirmed | `f2e687527c8624bf006a5fd3708e98d4fa9c301d7ad2c943cb90d7907be93dfb` |

**Stage 5 — Estructura planta baja**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `14a043d42ae6b6d0167edd3ffc1622dd057bd5aea14fe7cfc41ca5e6f8237e62` |
| Evidence anchor | Confirmed | `237284c136ae30880d9dbad12ac912271f4d448356e9043ef5fb53a2dccc6769` |
| Automatic Pending→InProgress | Confirmed | `b21dfeab948f0034759dba2d56b1f931ed63a6658535fde0128abb736774811e` |
| Observe (InProgress→Observed) | Confirmed | `1f4d989bdceb2d8108ea5c52268badcce18d9c043856ab093ff965f5b76636e8` |
| Resume (Observed→InProgress) | Confirmed | `aab113b3703f4022cabc4c952ac1bb0de79f4e91dbebdeaef1e1fbbddcd10b9b` |
| Certify (InProgress→Completed) | Confirmed | `81bffe18c3f0c4463f9317a72d291df2980b661443b7bd46332673639d8baab5` |

**Stage 6 — Estructura niveles superiores**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `0c12c54224a65068a2d61fb8512f20690f2ba1973bee572a8ade476624c6a64f` |
| Evidence anchor | Confirmed | `6d1892ea8a7029e9309df5d39ccc340204c99189cc8939eafc1fecf5de94aedc` |
| Automatic Pending→InProgress | Confirmed | `60752955067bc36bdf48d76b501ef3712037e91659e28c8f7e7f1e480c70c52a` |
| Observe (InProgress→Observed) | Confirmed | `b47e4a9a55249dac7be2826793b89df0c3fd7e90419d4bc0dd7660c2e1987baf` |
| Resume (Observed→InProgress) | Confirmed | `6975287766f9dec81075afb6563b8e5edb9f0e33087cac49c32fd99444a5de66` |
| Certify (InProgress→Completed) | Confirmed | `c69626d201aa774d2f8235366f6efc9ebae5d975c333309f528ced956d1b8dcc` |

**Stage 7 — Cerramientos y mampostería**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `4d170440d8b8b916dc339bca9f0f9069d9cf34bf0df17ddc67a3d69b5e481498` |
| Evidence anchor | Confirmed | `dfb63807a7a2a15c112ff2284df7be28a25703af692cb4f0b394f4ed650b1c2d` |
| Automatic Pending→InProgress | Confirmed | `eb69ceb31f2152cb95dad6a87d5281acb30a4cf919ca6b644a81ef7c8a656149` |
| Observe (InProgress→Observed) | Confirmed | `7d2318bf3b5aaee4afd6733734242ac1557225a7b2d9a142bf688bb7c822329d` |
| Resume (Observed→InProgress) | Confirmed | `7a9b534233941030028d500af7d4a45e0d9b14832302fb9261705dc550531ed9` |
| Certify (InProgress→Completed) | Confirmed | `207f2b4b8ebc56ecae155ed9c1d1bea2a713f709822fdb30a01bed13743fa885` |

**Stage 8 — Instalaciones**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `d745e249f63ee6541e8926299ff5b90b4478996f27fb58614cabbb61a28b21a7` |
| Evidence anchor | Confirmed | `36ebc69e2199fbe8da36d5d43499aebc3a84404e78da4dfff1e6371ed588e914` |
| Automatic Pending→InProgress | Confirmed | `2d0e210b6c3781c1024e118882571d3986a27cb06e180f05170013325215eb9b` |
| Observe (InProgress→Observed) | Confirmed | `1a5399c3d5261967e7c18c8230374201f298b294b04a5e177236dd41ae82e6d2` |
| Resume (Observed→InProgress) | Confirmed | `1efb88123d2833aaf00838299dcf30bcb8dbe46f578ff4711b5a7d4b746b3734` |
| Certify (InProgress→Completed) | Confirmed | `fdf533c69cc1a0c2773f0e3938464c09f435e13dd4555d5bee8d64aed0e0001e` |

**Stage 9 — Terminaciones**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `0dae3d845591855b666ffd1997124c4ca640dae617481af879a2acd9574b58fd` |
| Evidence anchor | Confirmed | `3c08bf9dc899eb7c21b5d80f4f6c08d364a5a32b5ad5d6722ea6a30754a0d1eb` |
| Automatic Pending→InProgress | Confirmed | `385c2e0192531aa42d5a93fcf89d0c810fab71e3e60342222c8bf9155d2da0a8` |
| Observe (InProgress→Observed) | Confirmed | `5f918bc177f99aadc44cde11f1abd2c5d25853ba0acab304051271acc1d7ac5c` |
| Resume (Observed→InProgress) | Confirmed | `44486b07ae68be5fdb7132541556bf84d45da5b8b1640dcdab7d3649304440c5` |
| Certify (InProgress→Completed) | Confirmed | `792c435dd3827a92c1eaebba7330eb97ccdba9129178968b378d849ae04878ca` |

**Stage 10 — Final de obra y subdivisión**

| Transition | Database status | TXID |
|---|---|---|
| Mint (declaration) | Confirmed | `f0bdc168eedc9f1c473c82964ccd79e65e9f4b326ced5eb01940afaa65dab563` |
| Evidence anchor | Confirmed | `f36f1e5778943825ef55e2366097ad7e7c79fef40e48b65f913df9ac90777e4b` |
| Automatic Pending→InProgress | Confirmed | `692e380288714ac0c2d97a1e8e266e075c793a0e60feb4e48d2fcba498c2b43f` |
| Observe (InProgress→Observed) | Confirmed | `b4b18c182592fae2770b188fa22e107910133c656054c00b55aca17346d41a21` |
| Resume (Observed→InProgress) | Confirmed | `03007f19893539bafd50eb8ea4f9f15493192d5adb4f3a68650245cd1575f660` |
| Certify (InProgress→Completed) | Confirmed | `6a9d502c789bb291f1fd670a748777fa70a2d16645d77b9e38838ce6bb8e66c2` |