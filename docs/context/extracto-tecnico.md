# docs/context/ — Snapshot del material fuente

> Regla del playbook (Fase 5): el material fuente entra como **snapshot congelado** — no se edita nunca; si la realidad cambia, cambian DECISIONS/specs, no el snapshot. Este extracto técnico existe para que las sesiones LLM no tengan que digerir los PDFs completos.

**Colocar acá los originales:** whitepaper (abstract + boundaries + evidence model + state model), baseline técnico de M2 (arquitectura, dominios, alineación de dominio, lifecycle, dirección Cardano §13), y el backlog de M3 (D1/D3, tablas de superficies con IDs).

---

## Extracto técnico (1 página) — lo que alimenta las specs

**Problema.** Ventas inmobiliarias en pozo: el capital se compromete años antes de que la unidad exista como activo registrable. Entre la seña y la escritura se acumulan registros de avance, certificaciones y aprobaciones fragmentados en canales informales.

**Producto.** Plataforma que estructura ese ciclo por unidad en **milestones** con **evidencia** organizada, y ancla huellas criptográficas de esa evidencia en **Cardano** con timestamps. Documentos y datos personales quedan off-chain; on-chain solo integridad y orden temporal.

**Arquitectura (3 capas).** UI web → backend orquestador (auth, proyectos/milestones, intake de evidencia, hashing/commitments, audit log, export/verificación) → capa Cardano de anclaje. La UI nunca toca blockchain. Principios: off-chain first para lo sensible; huella on-chain mínima y con propósito; separación de responsabilidades; arquitectura guiada por producto; flexibilidad interna dentro de esa dirección.

**Frontera on/off-chain.** On-chain: fingerprints de evidencia (hashes/commitments), timestamps e identificadores de anclaje, eventos de estado de milestone necesarios para gobernanza/auditabilidad. Off-chain: documentos y media, identidad y datos sensibles, permisos, logs operativos, casi toda la lógica de estado. La primera fase **no** exige lifecycle enforced on-chain (§11): progresión backend + anchors donde corresponda es plenamente compatible.

**Entidades.** Account, UnitForSale, Certifier, Milestone (name, sequence_order, state, validation_critical, certified_at), EvidenceBundle (bundle_commitment_hash), EvidenceItem (evidence_type, category, authoritative, sha256_hash), OnChainEvent (event_type, tx_id, block_timestamp). No hace falta mapa 1:1 rígido entidad→artefacto; lo que se preserva es el significado de negocio aprobado.

**Estados de milestone.** Pending (definido, no iniciado) → In Progress (evidencia acumulándose) → Certified (validado con pruebas ancladas); Observed = flagged para remediación con notas trazables; reapertura Observed → In Progress. Certificar exige evidencia presente + actor autorizado.

**Taxonomía de evidencia.** technical_plans, site_progress, certifications, permits, subdivision — cada una con fuente típica y método de prueba (hash por archivo, bundle anclado con timestamp, evidencia firmada + fingerprints, fingerprints + procedencia, documento commiteado).

**Flujo end-to-end.** (1) developer crea proyecto/unidades/milestones e invita investors; (2) cada investor ve timeline por unidad; (3) se sube evidencia asociada a milestones; (4) la plataforma computa fingerprints y ancla en Cardano.

**Dirección Cardano (§13).** Fase 1: transacciones de anclaje compactas (hash de item, commitment de bundle, referencia de milestone). Fase 2: evaluar dónde el enforcement agrega valor. Fase 3: lógica validator-based solo donde producto/confianza/gobernanza lo justifiquen.

**Roles y superficies (M3).** Cuatro superficies role-scoped (no app universal): Investor (reassurance: progreso, evidencia, dossier), Developer (velocidad: setup, upload, contratos), Notary (cola dossier-in/firma-out), Certifier (cola de etapas: certificar u observar). Backlog con IDs M3-BE-01..18, M3-SC-01..06, M3-FE-01..26 y Test IDs por superficie — fuente: tablas del backlog M3 (snapshot).
