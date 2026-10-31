# Council Sign-Off — Milestone 4 — Legal Greenlight for Mainnet Deployment

**Project:** Real-World Real Estate: Pre-Sale with Proof & Release (PropNexus) · Project Catalyst 1400106\
**Milestone:** 4 — Pilot Testing & Mainnet Deployment + Closeout\
**Acceptance criterion addressed:** *"legal greenlight for mainnet from counsel/notary"*\
**Format:** Council of Experts sign-off, as defined in the project Whitepaper v1.0, *Council of Experts — Approval delivery format*

## 1. Reviewed artifacts

| Artifact | Reference |
|---|---|
| Mainnet web application | https://propnexus-web-mainnet.onrender.com |
| Mainnet API | https://propnexus-api-mainnet.onrender.com |
| Network | Cardano mainnet |
| Smart contract | Aiken v1.1.21, Plutus V3, a single stage-thread validator |
| Script hash / minting policy | `6207ff3c19443974ee81fbf92419f20b3f45a259ea8808fe4227e6ad` |
| Script address | `addr1w93q0leur9zrja8ws8aljfqe7g9n73dzt84gsz87ggn7dtg3axnw0` |
| Reference script | `3edf75f533132835612c2d4b03e4268ad20afe0367ffb256a43c2384f3db1ed9#0` |
| Service wallet (signs every transaction) | `addr1vytx9747v5eq4xn740r6uy00mk3q9uk855smup9g23hun6qhk5qxw` |
| Source code | https://github.com/Javote/real-world-real-estate |

## 2. Scope of what was reviewed

The platform operating on mainnet does the following, and only the following:

1. **It records cryptographic fingerprints.** It writes SHA-256 hashes of evidence files, Merkle roots
   of evidence bundles, and the state of each construction stage to Cardano. Each one carries a
   timestamp.
2. **It keeps documents and personal data off-chain.** No names, e-mail addresses, file names or
   internal URLs are written to the chain. On-chain metadata holds only hashes and opaque record
   identifiers.
3. **It does not hold, transfer or release funds.** No validator custodies value. A payment
   "release" in the platform is a record that a payment agreed in the purchase contract took place
   outside the platform, anchored by its hash. The only ADA locked on-chain is the protocol minimum
   (2 ADA) that accompanies each stage's thread token, paid by the platform's own service wallet.
   No buyer or developer funds are involved.
4. **It certifies nothing.** The platform supports exactly four statements: *this file has this
   hash* · *it was registered at this time* · *it declares to come from this external authority* ·
   *this person attested to having reviewed it*. It does not replace public registries, building
   permits, deeds or any legal process.

## 3. Public locations and anchoring references

- Contract addresses and the full list of Milestone 4 mainnet transaction IDs: Milestone 4
  evidence, item 2 (*Mainnet deployment*), verifiable on https://cardanoscan.io.
- Source code and documentation: https://github.com/Javote/real-world-real-estate.

## 4. Approval statement

**APPROVED** — the operation of the platform on Cardano mainnet, within the scope described in
section 2, for the pilot of Milestone 4.

## 5. Perspective summary (optional)

<div style="height:1.1in; border:1px solid #d9dde5"></div>

## 6. Signature

<table class="firma">
<tr><td>Full name</td><td></td></tr>
<tr><td>Role</td><td>Legal counsel / Notary</td></tr>
<tr><td>Organization</td><td></td></tr>
<tr><td>Professional registration</td><td></td></tr>
<tr><td>Date</td><td></td></tr>
<tr><td>Signature</td><td style="height:0.9in"></td></tr>
</table>
