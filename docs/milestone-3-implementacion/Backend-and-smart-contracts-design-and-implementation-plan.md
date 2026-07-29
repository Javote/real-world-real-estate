# Design and Implementation Plan
## Smart Contracts and Backend Architecture
### Milestone 2 — UX & Product Design System

**Project:** Real-World Real Estate Pre-Sale with Proof & Release
**Document Type:** Milestone Deliverable
**Version:** 1.0
**Status:** Submitted for Milestone 2 Review
**Date:** May 2026

## Table of Contents

1. Executive Summary
2. Purpose
3. Scope
4. Project Context
5. Design Objectives
6. Architectural Principles
7. High-Level Architecture
8. Off-Chain and On-Chain Responsibility Model
9. Backend Functional Domains
10. Domain Model Alignment
11. Milestone Lifecycle Support
12. Evidence Model and Integrity Handling
13. Cardano Anchoring and Smart Contract Direction
14. Security and Privacy Considerations
15. UX and Backend Connection
16. Implementation Approach
17. Conclusion

## 1. Executive Summary

This document sets out the design and implementation direction for the backend and smart contract layers of the platform, as required for Milestone 2. Its purpose is to establish a coherent technical baseline that is aligned with the approved whitepaper, the previously validated conceptual architecture, and the UX/product design work delivered in the current milestone.

The platform is intended to operate through a hybrid architecture in which documents, metadata, and personal information are managed off-chain, while cryptographic commitments and selected proof references are anchored on Cardano. This approach seeks to balance privacy, practicality, and system usability with tamper-evident integrity guarantees and verifiable event ordering.

Within this architecture, the backend is conceived as the primary orchestration layer. It is expected to manage authentication and authorization, project and milestone records, evidence intake and metadata handling, integrity hash generation, audit logging, and verification support. The blockchain layer is intended to act as a trust and anchoring mechanism rather than as the main operational environment for business logic.

This plan deliberately adopts a phased and implementation-flexible posture. It provides sufficient technical clarity to support governance approval and subsequent development, while preserving the ability to refine internal details as implementation progresses through later milestones. In this sense, the document should be understood as a formal architectural baseline rather than as a final low-level technical specification.

## 2. Purpose

The purpose of this document is to define the intended design and implementation approach for the backend and smart contract layers of the platform. It is submitted as part of the Milestone 2 deliverables and serves as the required planning artifact for the technical foundation of smart contract development and general backend structure.

More specifically, this document aims to:

- describe how the platform is expected to operate from a systems perspective,
- clarify the division of responsibilities between off-chain and on-chain components,
- explain how backend services support the approved product and UX vision,
- establish a consistent technical direction for subsequent milestones,
- and provide a governance-ready statement of architectural intent.

This document is not intended to freeze all implementation details. Rather, it establishes the principal architectural commitments and the general implementation direction that will guide continued development.

## 3. Scope

This document covers, at a general level, the intended design and implementation approach for:

- backend application structure,
- evidence processing and storage coordination,
- milestone management and lifecycle support,
- role-based access control,
- auditability and verification support,
- integrity proof generation,
- and Cardano anchoring strategy.

It also clarifies the relationship between these technical components and the UX/UI work developed in Milestone 2, particularly in relation to dashboards, milestone progression, evidence submission, and proof visibility.

This document is intentionally high-level. It is designed to be precise enough for governance review and milestone acceptance, while leaving room for implementation refinement where appropriate.

## 4. Project Context

The platform is intended to support real-estate pre-sale traceability through a hybrid technical architecture that combines off-chain operational systems with on-chain proof anchoring.

As established in the whitepaper, the guiding principle of the project is that documents and personal information should remain off-chain for privacy, practicality, and operational efficiency. At the same time, evidence-related commitments and milestone-related proof references should be capable of being anchored on Cardano in order to provide:

- tamper-evident traceability,
- objective time ordering,
- verifiable integrity references,
- and increased trust for project participants and external reviewers.

The product is organized around project or unit visibility, milestone progression, and evidence traceability. Authorized participants are expected to access different parts of this information according to role, while the platform preserves an auditable and verifiable record of relevant actions and submitted evidence.

This technical plan is fully aligned with the conceptual materials already approved in the project, including the whitepaper, the high-level system architecture, the domain model, the milestone lifecycle, and the evidence anchoring flow.

## 5. Design Objectives

The proposed architecture is intended to satisfy a set of core design objectives.

### 5.1 Privacy-preserving document and evidence management

The platform must be able to manage evidence, metadata, and operational records without exposing raw documents or personal information on-chain.

### 5.2 Verifiable integrity and trust

Evidence handled by the platform should be capable of being hashed, referenced, and later verified against an immutable on-chain anchor or equivalent proof reference.

### 5.3 Milestone-centered workflow support

The system should support a workflow centered on milestones, as these constitute the primary structure through which project progress, validation, and evidence visibility are communicated.

### 5.4 Controlled role-based access

The platform must support differentiated access for administrators, developers, buyers or investors, verifiers, certifiers, and other relevant actors.

### 5.5 Auditability and governance readiness

Actions that are significant from an operational, evidentiary, or governance perspective should be auditable and reviewable.

### 5.6 Incremental technical delivery

The architecture should support phased implementation, enabling practical progress now while preserving the capacity to increase sophistication later, particularly with respect to blockchain logic.

## 6. Architectural Principles

The implementation direction described in this document is guided by the following architectural principles.

### 6.1 Off-chain first for sensitive and operational data

Sensitive files, user information, business records, and most application state should remain under backend-managed off-chain storage and persistence systems.

### 6.2 Minimal and purposeful on-chain footprint

Only compact proof references, such as hashes or commitment values, should be considered for blockchain anchoring.

### 6.3 Clear separation of concerns

The frontend should focus on user interaction, the backend should handle application logic and orchestration, and the Cardano layer should provide trust anchoring and verifiable immutability.

### 6.4 Product-led technical architecture

Technical decisions should support the intended user experience rather than impose unnecessary blockchain complexity on ordinary product workflows.

### 6.5 Implementation flexibility within architectural consistency

The project should preserve flexibility with respect to internal service decomposition, sequencing, naming, and contract sophistication, so long as the approved architectural direction remains intact.

## 7. High-Level Architecture

The target system can be understood as a three-layer architecture composed of a user-facing layer, an off-chain application layer, and an on-chain anchoring layer.

### 7.1 User-facing layer

The web application serves as the main interaction surface for users of the platform. It is expected to support:

- project or unit dashboards,
- milestone timeline and status visibility,
- evidence upload and evidence consultation flows,
- proof and verification-related views,
- and role-sensitive actions and navigation.

The user-facing application is not expected to interact directly with blockchain infrastructure. Instead, it should operate through the backend API and associated services.

### 7.2 Off-chain application layer

The backend constitutes the primary orchestration layer of the system. It is expected to manage:

- authentication and authorization,
- user and participation records,
- projects and milestone structures,
- evidence intake and metadata storage,
- document storage coordination,
- integrity hash generation,
- audit logging,
- export and verification support,
- and workflows related to Cardano anchoring.

### 7.3 On-chain anchoring layer

The Cardano layer is intended to provide a compact and verifiable proof layer for the platform. Its role is to anchor selected commitments or proof references rather than to host the full operational workflow of the application.

This on-chain layer is expected to contribute:

- immutable proof references,
- trustworthy chronological ordering,
- and public verifiability of selected integrity commitments.

## 8. Off-Chain and On-Chain Responsibility Model

A central architectural decision for the project is the explicit distinction between off-chain business operations and on-chain proof anchoring.

### 8.1 Off-chain responsibilities

The following responsibilities are expected to remain off-chain:

- user accounts and authentication,
- role and permission handling,
- project definitions and participation records,
- milestone creation and most milestone state logic,
- file storage and retrieval,
- evidence metadata management,
- internal audit logs,
- and verification-oriented service endpoints.

This allocation supports privacy, implementation practicality, lower operational cost, and faster product iteration.

### 8.2 On-chain responsibilities

The following responsibilities are suitable candidates for on-chain anchoring:

- evidence hashes,
- evidence bundle commitment hashes,
- milestone-related proof commitments,
- and other compact integrity references used for later verification.

Depending on future project needs, it may also become desirable to support selected validation logic on-chain. However, this is not assumed to be mandatory for the initial implementation baseline.

### 8.3 Architectural rationale

This hybrid approach is intended to balance confidentiality and verifiability. It permits the platform to provide strong integrity guarantees without exposing sensitive content or requiring all business logic to be executed on-chain.

It also mitigates the risk of introducing unnecessary blockchain complexity before all product requirements and operational workflows are fully stabilized.

## 9. Backend Functional Domains

The backend is planned around a set of functional domains. These may ultimately be implemented as separate modules, grouped services, or bounded components according to practical development needs.

### 9.1 Identity and access management

This domain is responsible for authenticated access to the platform and for enforcing role-based and project-based permission rules.

Typical responsibilities include:

- user authentication,
- role assignment and validation,
- project membership checks,
- token or session validation,
- and enforcement of access restrictions.

This domain is fundamental to the product because different participants must see different data and must be restricted to permitted actions.

### 9.2 Project and milestone management

This domain is responsible for the business structure around which the platform operates. Typical responsibilities include:

- project creation and maintenance,
- unit or project scope support where applicable,
- milestone definition and ordering,
- milestone state handling,
- and the connection between project progress and evidence traceability.

This domain provides the operational support for the milestone-oriented UX model.

### 9.3 Evidence intake and storage coordination

This domain is responsible for receiving, validating, and registering uploaded evidence. Typical responsibilities include:

- file upload handling,
- validation of supported file formats and size constraints,
- metadata registration,
- storage path or storage reference coordination,
- project and milestone association,
- and preparation for integrity processing.

This domain should support the approved evidence taxonomy while allowing reasonable extensibility as project needs evolve.

### 9.4 Hashing and commitment preparation

This domain is responsible for integrity-related processing.

Typical responsibilities include:

- computation of SHA-256 hashes or equivalent integrity fingerprints,
- preparation of proof references,
- optional grouping of evidence into bundles,
- and creation of compact commitment data suitable for later anchoring.

### 9.5 Audit logging

This domain is responsible for preserving an internal record of relevant actions. Typical responsibilities include:

- logging authentication events,
- logging administrative and project changes,
- logging evidence creation or updates,
- logging milestone state changes,
- and recording access-sensitive or governance-relevant operations.

### 9.6 Verification and export support

This domain is responsible for presenting proof-related information and facilitating evidence review.

Typical responsibilities include:

- retrieval of hash and anchor references,
- support for verification checks,
- generation of exportable evidence packages or reports,
- and provision of verification-oriented outputs for stakeholders.

## 10. Domain Model Alignment

The implementation plan is aligned with the conceptual entities that have already been defined and approved in the project's prior documentation.

At a conceptual level, the platform revolves around the following entities:

- Unit for Sale
- Milestone
- Evidence Item
- Evidence Bundle
- Certifier
- On-Chain Event
- Account

These concepts provide a sufficient basis for the intended workflow and for the planned backend and proof architecture.

At this stage, it is not necessary for every conceptual entity to map directly to a fixed implementation artifact in a rigid manner. Some may appear as storage models, others as service-layer constructs, and others as relationships or proof records. What is important for Milestone 2 is that the approved business meaning of these entities is preserved and that the technical architecture clearly supports them.

In practical terms:

- a Milestone represents a trackable stage of project advancement,
- an Evidence Item represents a concrete uploaded artifact,
- an Evidence Bundle represents a grouping used for proof efficiency or milestone-level integrity handling,
- an On-Chain Event represents the immutable proof anchor or reference,
- and Account, together with project participation records, determines who can act and what can be seen.

## 11. Milestone Lifecycle Support

The milestone model is a central aspect of the product and therefore of the technical design.

The backend is expected to support a simple and comprehensible milestone state model consistent with the previously approved conceptual documentation. Functionally, the system must be able to distinguish between:

- milestones that are defined but not yet started,
- milestones currently under execution or collecting evidence,
- milestones that have reached a validated or certified state,
- and milestones that have been observed, flagged, or otherwise marked for remediation or follow-up.

The precise internal labels and transition rules may still be refined during implementation, but the intended behavior is already established.

At a minimum, the implementation should support:

- milestone creation in a defined sequence,
- milestone ordering and visibility,
- optional criticality or scope metadata,
- association of evidence with milestones,
- updates to milestone state,
- and the recording of certification or validation moments when relevant.

The backend should also be able to support basic business rules around progression. For example, movement into a validated or certified state may depend on the presence of appropriate evidence and the involvement of an authorized actor.

Importantly, the architecture does not require that the milestone lifecycle be enforced entirely on-chain in the first implementation phase. Backend-managed state progression, supported by anchored proof references where appropriate, remains fully compatible with the intended platform model.

## 12. Evidence Model and Integrity Handling

Evidence handling is one of the most important trust-bearing parts of the platform and therefore requires a structured and disciplined technical approach.

### 12.1 Evidence categories

The system is expected to support multiple evidence categories, including but not limited to:

- technical plans and drawings,
- site progress evidence,
- certifications and technical reports,
- permits and approvals,
- subdivision and registration documents,
- and governance sign-off materials.

These categories are important both for business organization and for user comprehension. They may be supplemented in implementation with more specific technical subtypes or metadata fields.

### 12.2 Evidence registration

When evidence is submitted, the backend should record sufficient information to support operational use, traceability, and future verification. This generally includes:

- project association,
- optional milestone association,
- evidence type and category,
- uploader identity,
- file metadata,
- storage reference,
- and integrity fingerprint.

### 12.3 Integrity fingerprinting

Each evidence item should be capable of receiving a cryptographic fingerprint in order to support subsequent verification. The current planning assumption is to use SHA-256 hashing for this purpose, although implementation details may evolve if a justified need arises.

### 12.4 Bundling strategy

The concept of an evidence bundle is retained because it can provide efficiency and clarity in cases where multiple evidence items should be grouped under a common commitment or milestone-level proof event.

Bundling should be viewed as an available architectural mechanism rather than as a requirement for every piece of evidence in every workflow.

### 12.5 Verification objective

The long-term verification objective is that an authorized stakeholder, auditor, or relevant third party should be able to determine that:

- a presented file corresponds to a recorded hash,
- that hash is associated with the appropriate evidence record,
- and a related proof or commitment reference was anchored on-chain at a given point in time.

This objective is central to the trust model of the platform.

## 13. Cardano Anchoring and Smart Contract Direction

### 13.1 General design direction

The Cardano component is intended primarily as an integrity anchoring and proof-reference layer.

At the current project stage, the architecture does not require the full migration of business logic to on-chain execution. Rather, the immediate objective is to use blockchain infrastructure to create objective, tamper-evident proof points that reinforce confidence in the handling of evidence and milestone progression.

### 13.2 Candidate anchored data

Examples of data that may be suitable for anchoring include:

- the hash of an evidence item,
- the commitment hash of an evidence bundle,
- a milestone-related proof reference,
- or another compact commitment object relevant to verification.

Sensitive content, private documents, personal data, and broad operational records are not intended to be stored on-chain.

### 13.3 Smart contract strategy

The smart contract design remains intentionally flexible. A phased approach is considered appropriate, for example:

1. beginning with compact anchoring transactions or simple commitment recording,
2. evaluating where stronger on-chain enforcement offers meaningful value,
3. and introducing richer validator-based logic only where justified by product, trust, or governance requirements.

This phased posture reduces the risk of premature complexity while preserving the possibility of stronger blockchain enforcement in later phases if needed.

### 13.4 Relationship to current development work

The project already includes smart contract project scaffolding and exploratory implementation work. However, the purpose of the present document is not to declare the on-chain layer complete, but to define the intended architectural direction and to establish how that layer is expected to integrate with the broader platform.

### 13.5 Future options

If future milestones require stronger blockchain-enforced guarantees, the smart contract layer may evolve to support mechanisms such as:

- constrained milestone transitions,
- restricted update paths,
- milestone certification commitments,
- or tighter linkage between backend state changes and anchored proof artifacts.

These possibilities remain open without being mandatory for the present milestone baseline.

## 14. Security and Privacy Considerations

Security and privacy are foundational considerations in the design of the platform.

### 14.1 Sensitive data handling

Sensitive documents, personal data, and internal project records should remain under backend-managed storage and access controls.

### 14.2 Authentication and authorization

Protected actions must require authenticated access, and resources should be exposed only to users with the appropriate role or project relationship.

### 14.3 Evidence protection

Evidence handling should include file validation, controlled storage registration, and restricted download or access mechanisms according to project permissions and document sensitivity.

### 14.4 Auditability

Significant system actions should generate auditable records. This is particularly relevant for:

- authentication events,
- administrative actions,
- project and milestone modifications,
- evidence uploads and updates,
- and proof-related or governance-relevant operations.

### 14.5 Production-oriented hardening path

The architecture should be capable of evolving toward stronger production controls in later milestones, including improved secret management, storage hardening, operational monitoring, and incident handling capabilities.

## 15. UX and Backend Connection

A key objective of this document is to show how the technical implementation plan supports the UX and product system work delivered in Milestone 2.

The UX defines how users perceive project progress, milestone status, and evidence traceability. The backend provides the operational capabilities required to make those interactions functional, secure, and verifiable.

### 15.1 Dashboard support

The UX envisions dashboards that summarize project or unit status, milestone progression, and evidence context. The backend must therefore provide structured access to:

- project information,
- milestone lists and sequence,
- current state information,
- and evidence or proof indicators where relevant.

### 15.2 Milestone detail support

Milestone-focused views require backend support for retrieving milestone records together with associated evidence and status information. This is necessary for a coherent milestone journey within the UI.

### 15.3 Evidence submission support

The approved product flow includes evidence upload by authorized users. The backend must therefore support file validation, metadata capture, storage coordination, and integrity preparation as part of that user journey.

### 15.4 Verification and proof visibility

The UX also anticipates the ability to expose proof-related information, trust signals, or downloadable verification-oriented outputs. The backend must support these functions in a way that is accessible to users while remaining compatible with technical verification requirements.

### 15.5 Role-based experience support

The UI will display different information and actions depending on the user's role and project participation. The backend must enforce these distinctions consistently.

For these reasons, backend and smart contract planning should be understood as direct enablers of the approved user experience rather than as isolated technical workstreams.

## 16. Implementation Approach

The project has already advanced into practical implementation work in parallel with design activities. Accordingly, this document should be understood as an architectural baseline informed by implementation progress, but not as a rigid or exhaustive technical freeze.

The implementation approach is intended to remain iterative, disciplined, and adaptable.

### 16.1 Iterative backend development

Backend capabilities may continue to be implemented in progressive layers, beginning with core access control, project and milestone support, evidence handling, and audit functions, and then extending toward more comprehensive proof and verification services.

### 16.2 Progressive Cardano integration

Cardano anchoring may be introduced initially through compact proof commitments and later extended, if justified, toward more structured smart contract logic.

### 16.3 Controlled refinement of internal details

As implementation proceeds, the team may refine:

- internal module boundaries,
- data model details,
- proof object structure,
- milestone transition rules,
- and operational safeguards.

Such refinement remains compatible with this document so long as the underlying architectural direction remains unchanged.

### 16.4 Governance compatibility

This approach is intended to be compatible with project governance needs by establishing a clear technical direction while preserving the practical ability to adjust implementation details in response to validated requirements and development findings.

## 17. Conclusion

This document establishes the design and implementation direction for the backend and smart contract architecture of the platform as part of Milestone 2.

The proposed approach is grounded in:

- off-chain handling of documents and sensitive information,
- structured backend orchestration for projects, milestones, evidence, and permissions,
- cryptographic integrity processing for uploaded evidence,
- Cardano anchoring for tamper-evident proof references,
- and an incremental implementation strategy that preserves flexibility while remaining aligned with the approved whitepaper and UX vision.

In that sense, this document provides a coherent, governance-ready, and implementation-aware baseline for the continuation of the project in subsequent milestones.

---

# PROPNEXUS

## Appendix A - Direct D5 Traceability for UX-to-Backend Connection

**Milestone 2 - Deliverable #6:** Design and Implementation Plan for Smart Contracts and Backend Architecture

| Field | Value |
|---|---|
| Project | PropNexus - Catalyst Fund Project 1400106 |
| Purpose | Direct Evidence 6 cross-reference from D5 UI Implementation Plan to D6 backend and smart-contract planning. |
| Primary source | D5 - UI Implementation Plan |
| Scope note | Partner approval evidence is handled outside this document package and is not included in this appendix. |

### A.1 Purpose of this appendix

This appendix is part of Deliverable #6 and supplements Section 15, "UX and Backend Connection." It provides the direct reference required by Milestone 2 Evidence item 6 to Deliverable #5, the UI Implementation Plan. D5 maps each screen/component surface to API or smart-contract endpoints, test identifiers, and Milestone 3 build references. The backend and smart-contract plan in D6 consumes those mappings through the functional domains and anchoring responsibilities defined in Sections 9 through 13.

The traceability below is implementation-facing. It does not replace the D5 backlog; it identifies how D6 backend domains and Cardano anchoring responsibilities support the D5 UI flows, endpoints, proof-rendering patterns, test IDs, and M3 build references.

### A.2 Referenced Milestone 2 deliverables

| Deliverable | Objective relevance to D6 | Public link |
|---|---|---|
| D1 - Information Architecture & Navigation Map | Defines roles, navigation surfaces, permissions, and core journeys that the backend/API model must support. | Open D1 |
| D2a - Screen Catalog | Supports traceability for screen/surface references used by D5 and the UI-to-backend mapping. | Open D2a |
| D3 - Component Library | Defines reusable UI components and interaction states consumed by D5 and supported by backend response objects. | Open D3 |
| D4 - UX Documentation | Defines proof-rendering patterns for hashes, TXIDs, Merkle roots, dossiers, audit logs, and verification modals. | Open D4 |
| D5 - UI Implementation Plan | Primary cross-reference for this appendix: maps UI surfaces/components to endpoints, test IDs, M3 build refs, and proof patterns. | Open D5 |

Only the deliverables above are referenced because they are objectively relevant to the D6 technical traceability requirement. Approval/sign-off and walkthrough evidence are handled separately from this D6 backend/smart-contract plan.

*PropNexus - Catalyst Project 1400106 - M2 Deliverable #6 - Appendix A — Appendix page A-1*

### A.3 Direct mapping from D5 UI flows to D6 backend and smart-contract responsibilities

The following matrix converts the D5 UI implementation backlog into the D6 backend and Cardano anchoring responsibilities required to support the Milestone 3 build.

#### 1. Login and role gating

| Field | Content |
|---|---|
| D5 UI flow / source | D5 surface 01: /login (multi-role). Components: GradientHeader, LanguageToggle, TextInput, PrimaryButton. |
| D5 endpoint, test ID, build refs | POST /auth/login; GET /auth/me. Test IDs: AUTH-LOGIN-001, AUTH-ME-001. Refs: M3-BE-01, M3-FE-01. |
| D6 backend responsibility | Identity and access management (D6 Section 9.1). The backend authenticates the account, resolves role groups, and scopes every later route by role and project relationship. |
| D6 on-chain / proof responsibility returned to UI | No chain artifact is emitted. The returned session/user object is the authorization basis for all proof-bearing flows. |

#### 2. Investor browse, map, search, filter, and project detail

| Field | Content |
|---|---|
| D5 UI flow / source | D5 surfaces 02-08: /investor/buy, map/search/filter variants, /project/:projectId, /project/:projectId/progress. |
| D5 endpoint, test ID, build refs | GET /projects?status=; GET /projects?bbox=; GET /projects?q=; GET /projects?status=&sort;=; GET /projects/:id; GET /projects/:id/documents; GET /projects/:id/stages. Test IDs include INV-BUY-LIST-001, INV-BUY-MAP-001, INV-BUY-SEARCH-001, INV-BUY-FILTER-001, INV-PROJECT-DETAIL-001, INV-PROJECT-DOCS-002, INV-PROJECT-STAGES-001. Refs: M3-BE-02, M3-BE-03, M3-BE-04; M3-FE-02, M3-FE-03, M3-FE-04. |
| D6 backend responsibility | Project and milestone management (D6 Section 9.2) plus verification/export support (D6 Section 9.6). Backend serves project state, document summaries, milestone sequence, progress state, and evidence/proof indicators. |
| D6 on-chain / proof responsibility returned to UI | Where a document or stage is anchored, the API exposes anchored=true, artifact hash, TXID reference, and the data required by D4 Patterns P1, P2, and P9. |

#### 3. Stage detail, evidence viewing, per-file hashes, and Merkle proof

| Field | Content |
|---|---|
| D5 UI flow / source | D5 surfaces 09-12 and 25m: /project/:projectId/stage/:stageId and Stage milestone modal. |
| D5 endpoint, test ID, build refs | GET /projects/:id/stages/:stageId; GET /evidence/:bundleId; GET /evidence/:bundleId/files; GET /evidence/:bundleId/proof/:fileHash. Test IDs: INV-STAGE-DETAIL-001, INV-STAGE-DOCVIEW-002, INV-STAGE-MILESTONE-001, INV-MERKLE-PROOF-002. Refs: M3-BE-04, M3-BE-13; M3-FE-04. |
| D6 backend responsibility | Evidence retrieval and verification support (D6 Sections 9.3, 9.4, 9.6, and 12). Backend returns authorized evidence metadata, per-file hashes, bundle membership, and proof paths. |
| D6 on-chain / proof responsibility returned to UI | For Merkle-backed bundles, the backend returns the Merkle root, ordered per-file hashes, and proof path on request. If anchored, it also returns the TXID/explorer reference for UI proof display. |

*PropNexus - Catalyst Project 1400106 - M2 Deliverable #6 - Appendix A — Appendix page A-2*

### A.3 Direct mapping from D5 UI flows to D6 backend and smart-contract responsibilities (continued)

#### 4. Developer evidence upload and anchoring success

| Field | Content |
|---|---|
| D5 UI flow / source | D5 surfaces 38, 44c, and 44d: /developer/project/:projectId/upload and AnchoringSuccessModal. |
| D5 endpoint, test ID, build refs | POST /developer/projects/:id/stages/:stageId/evidence (multipart, returns Merkle + TXID); client opens $EXPLORER_BASE/tx/:txid. Test IDs: DEV-EVIDENCE-UPLOAD-001, DEV-ANCHOR-SUCCESS-001. Refs: M3-BE-13, M3-SC-02, M3-FE-18. Patterns: P4, P5. |
| D6 backend responsibility | Evidence intake, storage coordination, hashing, commitment preparation, and audit logging (D6 Sections 9.3, 9.4, 9.5, and 12). Backend validates files, stores them off-chain, calculates SHA-256 hashes, constructs bundle commitments, submits the anchor, and records the event. |
| D6 on-chain / proof responsibility returned to UI | The backend submits the evidence bundle anchor to Cardano and returns Merkle root, TXID, anchoring date, explorer URL or explorer template input, and file count in the same mutation response required by AnchoringSuccessModal. |

#### 5. Invitation issue, acceptance, and unit assignment

| Field | Content |
|---|---|
| D5 UI flow / source | D5 surfaces 39 and 63: developer invite-investor flow and investor InvitationAcceptModal. |
| D5 endpoint, test ID, build refs | POST /developer/projects/:id/invitations (returns anchor TXID); GET /investor/invitations/:id; POST /investor/invitations/:id/accept (returns TXID); POST /investor/invitations/:id/decline. Test IDs: DEV-INVITE-CREATE-001, INV-INVITE-VIEW-001, INV-INVITE-ACCEPT-002, INV-INVITE-DECLINE-003. Refs: M3-BE-10, M3-SC-01, M3-FE-17, M3-FE-13. |
| D6 backend responsibility | Identity, participation, notification, unit assignment, and audit support (D6 Sections 9.1, 9.2, and 9.5). Backend creates the invitation record, scopes it to the target investor and unit/project context, and updates assignment state after acceptance. |
| D6 on-chain / proof responsibility returned to UI | Acceptance produces or references the invitation acceptance anchor. The response to the UI includes TXID/proof metadata sufficient for the anchored-on-chain confirmation line and later audit retrieval. |

#### 6. Investor dossier, share, export, and notary signing

| Field | Content |
|---|---|
| D5 UI flow / source | D5 surfaces 26-29, 28s, 52s, and 53: investor dossier, ShareDossierModal, notary sign, and signed history. |
| D5 endpoint, test ID, build refs | GET /investor/units/:id/dossier; GET /investor/units/:id/dossier/export.pdf; POST /investor/units/:id/dossier/share; GET /public/dossier/:shareToken; POST /notary/dossiers/:id/sign (returns signature TXID); GET /notary/signatures?cursor=. Test IDs include INV-DOSSIER-VIEW-001, INV-DOSSIER-EXPORT-002, INV-DOSSIER-SHARE-001, INV-DOSSIER-PUBLIC-002, NOT-DOSSIER-SIGN-001, NOT-SIGNED-LIST-001. Refs: M3-BE-12, M3-BE-17, M3-SC-04, M3-FE-10, M3-FE-25. |
| D6 backend responsibility | Verification/export support and notary workflow support (D6 Sections 9.6, 12.5, and 13). Backend compiles authoritative dossier state from milestones, documents, hashes, anchors, and unit metadata; share/export endpoints derive from that state. |
| D6 on-chain / proof responsibility returned to UI | The notary signature commit anchors or references the dossier hash. UI receives dossier hash, signature TXID, anchoring/signing date, and per-document/per-milestone proof references. |

*PropNexus - Catalyst Project 1400106 - M2 Deliverable #6 - Appendix A — Appendix page A-3*

### A.3 Direct mapping from D5 UI flows to D6 backend and smart-contract responsibilities (continued)

#### 7. Certifier stage review, certify, observe, and issued history

| Field | Content |
|---|---|
| D5 UI flow / source | D5 surfaces 55-58: certifier panel, stage view, certify action, ObserveStageModal, issued certificates. |
| D5 endpoint, test ID, build refs | GET /certifier/kpis; GET /certifier/assignments; GET /certifier/stages/:stageId; POST /certifier/stages/:stageId/certify (returns certificate hash + TXID); POST /certifier/stages/:stageId/observe; GET /certifier/certificates?cursor=. Test IDs: CER-PANEL-001, CER-ASSIGNMENTS-002, CER-STAGE-VIEW-001, CER-CERTIFY-001, CER-OBSERVE-001, CER-ISSUED-LIST-001. Refs: M3-BE-18, M3-SC-05, M3-FE-26. |
| D6 backend responsibility | Milestone lifecycle support, role-based permissions, evidence access, and audit logging (D6 Sections 9.1, 9.2, 9.5, and 11). Backend restricts assigned-stage access, supports certification decisions, and records observations as remediation events. |
| D6 on-chain / proof responsibility returned to UI | Certification returns certificate hash + TXID for issued certificate history. Observation does not emit a certification anchor; it records a remediation/audit event and preserves the stage as pending/observed. |

#### 8. Contracts, payment releases, and release proof visibility

| Field | Content |
|---|---|
| D5 UI flow / source | D5 surfaces 23-24 and 40-41: investor contract/releases and developer contracts/release execution. |
| D5 endpoint, test ID, build refs | GET /investor/contracts/:unitId; GET /contracts/:contractId/releases; GET /developer/projects/:id/contracts; POST /developer/contracts/:id/releases/:stageNum (returns TXID). Test IDs: INV-CONTRACT-VIEW-001, INV-RELEASES-LIST-002, DEV-CONTRACTS-LIST-001, DEV-RELEASE-EXECUTE-002. Refs: M3-BE-08, M3-SC-03, M3-FE-08, M3-FE-19. Pattern: P10. |
| D6 backend responsibility | Contract/release backend support through project participation, milestone state, and exportable proof references (D6 Sections 9.2, 9.5, 9.6, and 11). Backend verifies stage eligibility before recording or requesting a release action. |
| D6 on-chain / proof responsibility returned to UI | Release execution returns stage-release TXID and release record data: stage number, amount, currency, ISO date, and released-by actor, enabling Pattern P10 in both investor and developer views. |

#### 9. Developer documentation anchoring and audit log verification

| Field | Content |
|---|---|
| D5 UI flow / source | D5 surfaces 46-47, 49, and 50: documentation surface, audit log, and TxidModal verification. |
| D5 endpoint, test ID, build refs | GET /developer/documents?status=; POST /developer/documents (anchor); GET /developer/audit-log?category=&cursor;=; client opens $EXPLORER_BASE/tx/:txid. Test IDs: DEV-DOCS-LIST-001, DEV-DOC-ANCHOR-002, DEV-AUDIT-LIST-001, DEV-AUDIT-FILTER-002, DEV-AUDIT-VERIFY-001. Refs: M3-BE-14, M3-BE-16, M3-SC-06, M3-FE-22, M3-FE-24. Patterns: P1, P2, P3, P6. |
| D6 backend responsibility | Documentation anchoring API and append-only audit ledger (D6 Sections 9.5, 9.6, 12, and 13). Backend stores document metadata, hashes documents, initiates standalone anchor events, and exposes cursor-pageable audit events by category. |
| D6 on-chain / proof responsibility returned to UI | Standalone document anchors return hash + TXID. Audit events expose timestamp, action key, actor role/name, category key, full TXID, and affected-artifact references for TxidModal verification. |

*Appendix A*

### A.4 Proof-object and data-contract requirements

| Requirement | Backend / smart-contract implication for D6 |
|---|---|
| Full hash transport | The backend returns full artifact hashes to the client. UI truncation is a presentation-only concern. |
| TXID transport | The backend stores and returns full Cardano TXIDs verbatim, with anchoring date and explorer template/link data when available. |
| Anchoring mutation response | For evidence anchoring, the backend returns Merkle root, TXID, anchoring date, and file count in the same response that completes the mutation. |
| Merkle proof support | The backend stores ordered per-file hashes per bundle and serves proof paths for /evidence/:bundleId/proof/:fileHash. |
| Audit ledger | The backend maintains an append-only, cursor-pageable event ledger with timestamp, action key, actor role/name, category key, TXID, and affected artifact references. |
| Dossier object | The backend compiles a dossier object with dossier hash, unit metadata, per-milestone records, document index, per-document anchors, and dossier completeness status or equivalent completion indicator. |
| Certification proof | The certification endpoint returns certificate hash and TXID after a successful stage certification commit. |
| Signature proof | The notary signing endpoint returns signature TXID committed to or associated with the dossier hash. |
| Release proof | The release endpoint returns stage-release TXID plus release record data: stage number, amount, currency, ISO date, and released-by actor. |
| Explorer resolution | The client uses the environment-configurable explorer base, while the backend response provides the TXID and any required environment metadata to resolve the transaction. |