# 01 — Arquitectura

## Tres capas

```
┌─────────────────────────────────────────────────────────┐
│  Capa de usuario (off-chain)                             │
│  apps/web — TanStack Start + shadcn                     │
│  4 superficies por rol: Investor / Developer /          │
│  Notary / Certifier                                     │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS (REST, JSON, JWT)
┌──────────────────────────▼──────────────────────────────┐
│  Capa de aplicación (off-chain) — packages/api          │
│  • Identity & Access (roles, membresías de proyecto)    │
│  • Project & Milestone (estados, reglas de progresión)  │
│  • Evidence Intake (validación, S3, metadata)           │
│  • Hashing & Commitment (SHA-256, Merkle, commitments)  │
│  • Audit Log (append-only)                              │
│  • Export & Verification (dossier, share token, verify) │
│  Storage: PostgreSQL (metadata) + S3/MinIO (archivos)   │
└──────────────────────────┬──────────────────────────────┘
                           │ packages/cardano (Lucid + Blockfrost)
┌──────────────────────────▼──────────────────────────────┐
│  Capa de anclaje (on-chain) — Cardano Preprod           │
│  • Transacciones de anclaje (metadata o validador)      │
│  • Validadores Aiken (certificación, firma, releases)   │
│  Aporta: prueba inmutable, orden cronológico confiable, │
│  verificabilidad pública de commitments seleccionados   │
└─────────────────────────────────────────────────────────┘
```

## Principios (del baseline aprobado)

1. **Off-chain first para datos sensibles y operativos.** Archivos, usuarios, registros de negocio y la mayoría del estado viven en backend.
2. **Huella on-chain mínima y con propósito.** Solo hashes, Merkle roots, commitments y referencias de prueba.
3. **Separación de responsabilidades.** Frontend = interacción; backend = lógica y orquestación; Cardano = anclaje de confianza e inmutabilidad verificable.
4. **Arquitectura guiada por producto.** Ninguna decisión técnica impone complejidad blockchain sobre flujos ordinarios.
5. **Flexibilidad dentro de la consistencia.** Descomposición interna, naming y sofisticación de contratos pueden ajustarse mientras se preserve esta dirección.

## Qué va on-chain y qué no

| On-chain (Cardano) | Off-chain (backend) |
|---|---|
| Hash SHA-256 de evidencia individual | Documentos y media (planos, fotos, permisos, certificados) |
| Merkle root de bundles de evidencia | Identidad y datos personales |
| Commitments de milestone (certificación, firma) | Cuentas, roles, permisos, membresías |
| TXIDs + timestamps de bloque | Creación de milestones y casi toda la lógica de estado |
| Anclas de invitación/aceptación | Storage y retrieval de archivos, metadata de evidencia |
| Referencias compactas de verificación | Audit logs internos, endpoints de verificación |

## Flujo de anclaje de evidencia (secuencia canónica)

```
Developer → Web UI: subir evidencia (multipart)
Web UI → API: POST /developer/projects/:id/stages/:stageId/evidence
API → Evidence Intake: validar formato/tamaño, guardar en S3, registrar metadata
API → Hashing Service: SHA-256 por archivo → hojas → Merkle root
API → packages/cardano: construir tx con metadata {label: ANCHOR_METADATA_LABEL,
      payload: {t: "evidence_bundle", root, bundle_id}} → firmar con wallet de
      servicio → submit vía Blockfrost
Cardano → API: TXID
API → DB: OnChainEvent {event_type, tx_id, block_timestamp} + audit_log
API → Web UI: { fileHashes[], merkleRoot, txid }
Web UI: AnchoringSuccessModal (HashChip Merkle + TXID → $EXPLORER_BASE/tx/:txid)
```

La verificación hace el camino inverso: recalcular hash del archivo descargado → probar inclusión contra el Merkle root → leer metadata del TXID en Blockfrost → comparar.

## Decisiones fijadas

| Tema | Decisión | Motivo |
|---|---|---|
| Framework API | Hono | Liviano, TS-first, zod-validator, corre en Node y edge |
| ORM | Drizzle | Tipado estricto, migraciones SQL legibles |
| Lib web3 TS | Lucid Evolution | Integración natural con blueprints de Aiken; alternativa documentada: Mesh |
| Provider | Blockfrost Preprod | Sin operar nodo propio en M3 |
| Anclaje Fase A | Metadata de transacción (label configurable) | Cumple anclaje sin validador; costo y complejidad mínimos |
| Anclaje Fase B | Validadores Aiken donde la firma/enforcement agrega valor real | Estrategia por fases del baseline (§13.3) |
| Auth | JWT corto + refresh, roles en claims | Cuatro roles, guards por grupo |
| Archivos | S3/MinIO, URLs prefirmadas | Documentos nunca pasan por la DB ni por la chain |
