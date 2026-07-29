# Milestone 3

Milestone Title:
 - Core Backend, Smart-Contract Development & Integration

Milestone Outputs:
 - Smart-contract suite (Plutus V2 state machine) with parameterized roles and ≥8 construction stages, timeouts, and fallback branches.
 - Off-chain services & API for hashing/timestamping and linking evidence to on-chain anchors; API returns proof objects (hash + timestamp + signer); Merkle root (single hash committing a bundle of files) for evidence bundles.
 - UI Implementation & Integration: build main application flows integrating contracts/services; audit logs for state changes.
 - Testing & Security: unit/integration tests, static analysis, dependency scans; telemetry for coverage/latency/error budgets.
 - Pre-production Environment & Ops: seeded data, monitoring; pre-prod URL, recorded walkthrough, and runbook (deploy/rollback/incident response).

Acceptance criteria:
 - Contracts compile; unit tests ≥95% coverage; supports ≥8 stages with configurable signers/percentages. Pilot participants (at least 3 chosen by the real estate developer partners) confirm that the platform correctly reflects construction progress and certification logic 
 - API endpoints documented; proof objects validated; rejects unsigned evidence.
 - UI flows function end-to-end in pre-prod; median time from reservation to escrow creation <12 minutes; audit logs persisted.
 - No open P1 security findings after remediation.
 - Pre-prod is publicly accessible at a URL; walkthrough video recorded; runbook completed.

Evidence of milestone completion:
 - Public GitHub repo(s) for contracts/services/frontend with CI logs, coverage report, and pilot participant letter of confirmation; README marks public vs private folders.
 - API docs + test reports with coverage/outcomes (e.g., Postman collection).
 - Pre-prod URL, screenshots of audit logs/latency confirming <12m median; short performance note; walkthrough video of full flow +  List of transaction identifiers associated milestone test anchors
 - Security review report (findings + applied fixes).
 - Ops runbook (deploy/rollback/incident) in repo + monitoring screenshots.