# SPEC-001 — Anclaje de evidencia (walking skeleton → pipeline completo)

## Propósito

Dar a cualquier archivo de evidencia una prueba de integridad y existencia verificable públicamente: hash SHA-256 → árbol Merkle → commitment anclado en Cardano con timestamp → verificación por TXID. Es el hilo vertical del sistema (Sprint 1 como script; Sprint 2 como endpoint).

## Alcance / NO-alcance

- **Cubre:** hashing, construcción Merkle, puerto `AnchorPort` (modos real/simulado, D-014), formato de metadata on-chain (D-006), verificación, persistencia en `onchain_events`.
- **NO cubre:** validadores Aiken (Fase B), UI (Sprint 3), certificación/firmas (SPEC-002), permisos de acceso a archivos.

## Interfaz

```ts
// packages/cardano — puerto (D-014)
interface AnchorPort {
  anchor(input: { type: AnchorType; hashHex: string; ref: string; projectRef?: string }): Promise<{ txid: string }>;
  awaitConfirmation(txid: string, opts?: { timeoutMs?: number }): Promise<{ blockTime: number }>;
  verify(txid: string): Promise<{ payload: AnchorPayload } | { error: "NOT_FOUND" | "NO_ANCHOR_METADATA" }>;
}
type AnchorType = "evidence_bundle" | "evidence_item" | "invitation" | "invitation_accept" | "document";

// packages/cardano — merkle
buildTree(leavesHex: string[]): MerkleTree      // hojas ordenadas lexicográficamente antes de construir
rootOf(tree: MerkleTree): string                // hex 64
proofFor(tree: MerkleTree, leafHex: string): ProofStep[]
verifyProof(leafHex: string, proof: ProofStep[], rootHex: string): boolean
```

Metadata on-chain (label `ANCHOR_METADATA_LABEL`, default 1904): `{ v: 1, t: AnchorType, h: hex64, r: refOpaca, p?: refOpaca }`.

Endpoint: `POST /developer/projects/:id/stages/:stageId/evidence` (multipart) → `{ bundleId, files: [{id, sha256}], merkleRoot, txid, explorerUrl }` — ver M2-D5 §5 (entrada `38, 44c`, refs `M3-BE-13` / `M3-SC-02`) y M2-D4 §8.1 (patrones P4 y P5: la respuesta de la mutación debe traer Merkle root, TXID, fecha de anclaje y cantidad de archivos, sin segundo round trip).

Script (Sprint 1): `pnpm skeleton <archivo> [--mode=real|simulated]` → imprime hash, root, txid, `VERIFIED|FAILED`, URL de explorer. Exit code 0 solo si VERIFIED.

## Invariantes

1. Ningún dato personal, nombre de archivo, URL ni monto llega a metadata on-chain — solo `{v,t,h,r,p}` con refs opacas (UUID).
2. Strings de metadata ≤ 64 bytes.
3. El Merkle root es determinístico: mismas hojas (en cualquier orden de entrada) ⇒ mismo root.
4. Todo `txid` persistido en `onchain_events` es verificable: `verify(txid)` devuelve el payload que se ancló.
5. El modo simulado implementa el contrato completo del puerto (incluida verificación negativa) — es producto, no stub.
6. `sha256Hash` en DB = hash del archivo en S3, siempre (se calcula del stream subido, no del nombre ni de metadata del cliente).

## Casos borde (definen los tests)

1. Bundle de 1 archivo → root == hash de la hoja (o su duplicado según el esquema; fijarlo en el test).
2. Cantidad impar de hojas → última duplicada; verificar contra vector fijo.
3. Mismas hojas en distinto orden de entrada ⇒ mismo root (invariante 3).
4. `verifyProof` con root ajeno ⇒ false.
5. `verify(txid)` de una tx sin el label ⇒ `NO_ANCHOR_METADATA`.
6. `verify(txid)` inexistente ⇒ `NOT_FOUND`.
7. Archivo con MIME fuera de whitelist ⇒ 422, nada se sube a S3, nada se ancla.
8. Falla el anchor después de subir a S3 ⇒ evidencia queda `pending_anchor`, job de re-anclaje la retoma (no se pierde ni se duplica: idempotencia por bundleId).
9. Timeout de confirmación ⇒ el endpoint responde igual con txid y estado `submitted`; la confirmación llega por poll posterior.
10. Payload con string >64 bytes ⇒ error antes de firmar (test unitario del adaptador).

## Preguntas abiertas

- ¿Poll o webhook para confirmaciones? **Default:** poll cada 30 s desde un job del backend (Blockfrost webhooks quedan como mejora).
- Lib web3: ver D-005 (default Lucid; este skeleton es el spike).
