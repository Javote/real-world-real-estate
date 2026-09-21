# PropNexus — Real estate pre-sale evidence, anchored on Cardano

> Project Catalyst **1400106** — *Real-World Real Estate Pre-Sale with Proof & Release*.
>
> Pre-production: <https://propnexus-web.onrender.com> (web app) ·
> <https://propnexus-api.onrender.com> (API) · Cardano **Preprod**.

Buying a unit off-plan means handing over capital years before the unit legally exists. In the
meantime, the project piles up plans, permits, inspections, certificates and approvals, and they
live in informal channels: email threads, chat groups, paper folders. Buyers can't check where the
project really stands, "finished" becomes something to argue about, and nothing guarantees that what
is shown today is what existed yesterday. That opacity has already caused real economic harm to
buyers.

PropNexus turns that scattered trail into an **ordered, auditable history per project and per
unit**, structured in the **stages** of the construction lifecycle. Documents and personal data
stay **off-chain**. Only their **cryptographic fingerprints** (SHA-256 per file, a Merkle root per
evidence bundle) go on-chain, together with the stage events, in Cardano transactions whose
timestamps nobody can rewrite. The goal is to move buyers **from belief to verification**.

## What it does — and what it doesn't

The platform can back exactly four statements, and nothing more:

1. *this file has this hash*;
2. *it was registered at this moment*;
3. *it declares it comes from this external authority*;
4. *this person attested to having reviewed it*.

**It does not certify, validate or decide anything.** It never holds or moves money, in any phase.
It does not replace public property registries, notarial processes or deeds, government permits or
inspections, or legal advice. It is a coordination and integrity layer, with no legal authority of
its own (see the whitepaper's non-substitution statement).

## How it works

- **Stages.** Each project declares its stages up front, in order. That declaration is anchored
  on-chain, so a stage can't be quietly backdated later. A stage moves through four states:
  **Pending → In Progress → Completed** (shown to buyers as *certified*), with **Observed** as the
  exception path when a certifier flags a problem and asks for corrections. A stage can't be marked
  complete while its evidence is missing.
- **Evidence.** The developer uploads documents (PDF, JPEG, PNG), after the competent authority has
  already issued the ones that need official validation ("authority first"). Each file is hashed.
  Each upload becomes a bundle with its Merkle root, and the root is anchored on Cardano.
- **On-chain state.** An [Aiken](https://aiken-lang.org) validator (Plutus V3,
  [`contracts/validators/stage.ak`](contracts/validators/stage.ak)) mirrors the same stage state
  machine the backend enforces. Every stage has an on-chain thread, and every declaration, evidence
  anchor and state transition is a Preprod transaction. The validator never holds or releases
  value.
- **Independent verification.** Anyone holding a file can recompute its SHA-256 and compare it
  with the transaction on a public explorer, without trusting this platform.

### Roles

| Role | What they do | Lands on |
|---|---|---|
| **Investor** (buyer) | Follows the project and their unit, and verifies its evidence | `/investor/buy` |
| **Developer** | Sets up projects, stages and units, uploads evidence, invites buyers | `/developer` |
| **Certifier** | Reviews each stage's evidence and completes or observes it | `/certifier` |
| **Notary** | Reviews and signs the final dossier before the deed | `/notary` |
| **Admin** | The platform operator: can do anything the other roles do, and invites certifiers to projects | `/admin` |

Access is enforced twice on every request: by global role, and by membership in the specific
project.

## Repository layout

```
apps/api          Express 5 + Kysely — the API (Render web service)
apps/web          TanStack Router + Vite + React 19 — the web app (static site on Render, PWA)
packages/shared   Zod schemas: the single API ↔ web contract
packages/cardano  Anchoring port: a simulated adapter and a real one (Lucid Evolution)
contracts/        Aiken smart contracts (Plutus V3) — separate toolchain, outside the pnpm workspace
docs/             The approved Catalyst deliverables of Milestones 1–3 (read-only)
specs/            Specs, audits, reports and the Milestone 3 evidence
```

The database is SQLite locally and [Turso](https://turso.tech) in production. Evidence files are
stored in Cloudflare R2. The UI is bilingual: Spanish (`es-AR`, the default) and English.

## Milestone 3 evidence

Everything submitted for Milestone 3 lives in [`specs/evidencia-m3/`](specs/evidencia-m3/README.md),
in English, with one folder per item of Catalyst's *"Evidence of milestone completion"*: CI and test
reports, API docs (OpenAPI and Postman), the pre-production volume test and its 180 transaction IDs,
the security review, and the ops runbook with monitoring screenshots.

The Milestone 1 documents (whitepaper, architecture and data models, pilot plan) are hashed and
anchored on Cardano mainnet. Their TXIDs are listed in
[`docs/milestone-1-fundamentos/M1-D4-Blockchain-Anchoring-Index.md`](docs/milestone-1-fundamentos/M1-D4-Blockchain-Anchoring-Index.md).

## Quick start

Requires Node ≥ 22.12 and pnpm 9 (`corepack enable`). The contracts also need Aiken v1.1.21:

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://install.aiken-lang.org | sh && aikup install v1.1.21
```

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # set JWT_SECRET: openssl rand -hex 32
pnpm db:migrate                          # creates the local SQLite database
pnpm db:seed                             # demo users and a demo project
pnpm dev                                 # web on :3000, API on :8787
```

On `/login`, picking a role tab fills in that role's username; you type the password. Locally, the
seeded accounts are:

| Role tab | Username / password |
|---|---|
| Investor | `buyer@example.com` / `buyer123` |
| Developer | `developer@example.com` / `developer123` |
| Notary | `notary@example.com` / `notary123` |
| Certifier | `verifier@example.com` / `verifier123` |
| *(no tab)* Admin | `admin@example.com` / `admin123` |

These are **public, development-only** credentials. The seed uses them only against a local SQLite
file, and against any other database it refuses to run unless `SEED_ADMIN_PASSWORD` and
`SEED_DEMO_PASSWORD` are set. Pre-production uses different passwords.

Environment variables are documented in [`apps/api/.env.example`](apps/api/.env.example) and
[`apps/web/.env.example`](apps/web/.env.example).

## Verification

```bash
pnpm verify        # lint + typecheck + test-ID traceability + tests + build
pnpm verify:all    # the above, plus the Aiken suite (fmt + check + build)
```

This is what CI runs on every push, and nothing is committed unless it passes. Two suites run
against real infrastructure and are run by hand instead:
`pnpm --filter @plataforma/api test:s3` (storage against MinIO) and
`pnpm --filter @plataforma/cardano test:yaci` (anchoring against a local Cardano node). Each one
starts the container it needs and stops it afterwards, so Docker running is enough.

## Deploy

Free tier, **$0/month**, and that is an architectural constraint, not a budget one. The deploy is
declared in [`render.yaml`](render.yaml): two Render services (API and static web app) backed by
Turso and Cloudflare R2. A daily GitHub Actions job reconciles anchors that may have been lost.
The full procedure (deploy, rollback, incidents) is in the
[runbook](specs/evidencia-m3/5-ops/runbook.md).

The network is **always Cardano Preprod**. Mainnet is out of scope for this milestone and is
blocked by configuration, not just by procedure.

## This repository is public

No folder contains secrets, credentials, wallet keys or personal data. Secrets travel **only
through environment variables** and are never committed.

Never committed: `apps/api/.env`, `apps/web/.env`, `apps/api/.data/` (local SQLite databases),
`apps/api/uploads/` (runtime evidence) and `apps/web/e2e/.artifacts/`. The service wallet key and
the Blockfrost API key are set as environment variables at the deploy provider and do not exist in
the repository.

## Working documents

The team's working language is Spanish. [`CLAUDE.md`](CLAUDE.md) (the working guide),
[`DECISIONS.md`](DECISIONS.md) (the constraints in force and the reasons behind them) and
[`specs/`](specs/README.md) are written in Spanish. Everything prepared for reviewers, meaning this
README and [`specs/evidencia-m3/`](specs/evidencia-m3/README.md), is in English.
