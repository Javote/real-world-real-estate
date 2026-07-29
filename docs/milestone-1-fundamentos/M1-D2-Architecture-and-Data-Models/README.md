# Architecture & Data Models — Milestone 1  
**Real-World Real Estate Pre-Sale with Proof & Release**

---

## Purpose

This folder contains the **Architecture & Data Models** deliverables for **Milestone 1** of the project *“Real-World Real Estate Pre-Sale with Proof & Release”*.

It is intended to be read together with **Whitepaper v1.0** and serves as the authoritative reference for how construction-stage traceability, evidence handling, and governance are structured.

All artifacts provided here are **conceptual**, not implementation-specific.  
They are designed for review by developers, real estate professionals, and notarial/registral stakeholders, and do **not** represent physical database schemas or production implementations.

---

## Scope of This Documentation

This documentation includes:

- System architecture and explicit on-chain / off-chain boundaries  
- Core domain entities and their relationships  
- Milestone lifecycle and governance flow  
- Evidence anchoring and verification flow  
- Evidence taxonomy for construction-stage traceability  
- Mapping to Milestone 1 acceptance criteria

This documentation intentionally does **not** define:

- Physical database schemas  
- Smart contract implementation details  
- UI design specifications  
- Backend implementation plans  

---

## Design Principles

The system architecture and data models are guided by the following principles:

1. **Evidence Integrity Without Disclosure**  
   Integrity is proven via cryptographic commitments and timestamps, without publishing document contents or personal data on-chain.

2. **Clear Governance and Accountability**  
   Every action (upload, certification, milestone state transition) is attributable to a role-bound identity and recorded in audit logs.

3. **Minimal and Deliberate On-Chain Usage**  
   The blockchain is used only where immutability and time-ordering provide real governance and audit value.

4. **Privacy and Data Minimization by Default**  
   Off-chain systems retain control over access, retention, and deletion of sensitive data.

5. **Compatibility With Existing Legal and Registral Workflows**  
   The platform supports, but does not replace, public authorities, registries, or notarial processes.

---

## Architecture Overview (Non-Technical)

Pre-construction real estate projects require buyers and investors to rely on progress claims and documents that accumulate over years and are often difficult to audit or verify retrospectively.

To address this, the platform separates **evidence storage** from **evidence proof**:

- Evidence (documents, photos, certificates) is stored off-chain in controlled systems.  
- Cryptographic fingerprints of that evidence are anchored on the Cardano blockchain to provide tamper-evident integrity and time-ordering.

Users interact exclusively with a web application.  
All blockchain interactions are performed by operator-controlled backend services, ensuring operational safety while still enabling independent verification.

Milestones structure the lifecycle of each unit. Evidence is collected and, where required, certified according to predefined rules. State transitions are governed and recorded so that progress, exceptions, and remediation remain transparent and auditable.

---

## On-Chain vs Off-Chain Designation

### On-Chain (Cardano)
- Cryptographic hashes / commitments  
- Transaction identifiers (TXIDs)  
- Anchors for milestone state transitions  

### Off-Chain
- Documents and media  
- Evidence metadata  
- Identity and role data  
- Access control and sharing rules  
- Audit logs  

No document contents, personal data, or sensitive information are written on-chain.

---

## Diagram and Artifact Overview

### 1. `system-architecture.puml` — System Architecture

**Purpose**  
Describes the high-level system architecture and clearly separates:

- User-facing components  
- Off-chain application services  
- Off-chain storage  
- On-chain anchoring components  

**What reviewers should look for**
- Explicit on-chain / off-chain boundary  
- Operator-controlled blockchain interaction  
- Minimal and deliberate use of the blockchain  

---

### 2. `core-domain-model.puml` — Core Entities & Relationships

**Purpose**  
Defines the core domain entities required by Milestone 1 and their relationships, including:

- Unit for Sale  
- Milestone  
- Certifier  
- On-Chain Event  
- Evidence and governance-related entities  

**What reviewers should look for**
- All listed entities have attributes  
- Relationships are explicit and realistic  
- The model is conceptual, not a database schema  

---

### 3. `milestone-lifecycle.puml` — Milestone Lifecycle (State Machine)

**Purpose**  
Defines the lifecycle of a Milestone and the allowed state transitions.

This diagram represents the **conceptual workflow governed by a smart-contract state machine pattern**:
- the contract enforces allowed transitions,
- evidence and documents remain off-chain.

**States**
- Pending  
- In Progress  
- Certified  
- Observed  

---

### 4. `evidence-anchoring-flow.puml` — Evidence Anchoring Flow

**Purpose**  
Shows the end-to-end flow for:

- Evidence submission  
- Hash computation  
- On-chain anchoring  
- Recording TXIDs for later verification  

**What reviewers should look for**
- Evidence remains off-chain  
- Only cryptographic hashes are anchored  
- Independent third-party verification is possible  

---

### 5. `evidence-taxonomy.csv` — Evidence Taxonomy (Normative)

**Purpose**  
Provides the **normative evidence taxonomy** for Milestone 1, defining:

- Evidence categories  
- Typical sources  
- Purpose of each evidence type  
- Whether evidence is authoritative  
- Whether it is anchored on-chain or stored off-chain  

This taxonomy defines **types of evidence**, not concrete evidence instances.  
Enumeration of specific evidence items (IDs, links, versions) will be handled in later milestones during pilot execution.

---

## Consistency Statement

All artifacts in this folder are:

- Consistent with **Whitepaper v1.0**  
- Aligned with the defined roles, states, and governance model  
- Consistent with the evidence taxonomy and verification blueprint  

Together, they fully satisfy the **Architecture & Data Models** requirements of **Milestone 1**.