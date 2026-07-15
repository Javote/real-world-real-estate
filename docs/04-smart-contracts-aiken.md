# 04 — Smart Contracts (Aiken) y estrategia de anclaje

> Dirección aprobada (§13): la capa Cardano es primariamente **anclaje de integridad y referencia de pruebas**. No se migra lógica de negocio on-chain. Enfoque por fases: (1) transacciones de anclaje compactas, (2) evaluar dónde el enforcement on-chain agrega valor, (3) validadores más ricos solo donde producto/confianza/gobernanza lo justifiquen.
>
> ⚠️ La sintaxis de Aiken evoluciona entre versiones. Los ejemplos siguen Aiken v1.1.x; verificá contra `aiken --version` y la stdlib instalada antes de asumir.

## Mapa de los 6 contratos del backlog

| Ref | Nombre | Fase | Mecanismo |
|---|---|---|---|
| M3-SC-06 | Anchor de hash de documento suelto | **A** | Metadata de tx (sin validador) |
| M3-SC-02 | Anchor de bundle de evidencia (Merkle root) | **A** | Metadata de tx |
| M3-SC-01 | Anchor de invitación / aceptación | **A** | Metadata de tx |
| M3-SC-05 | Commit de certificación de etapa | **B** | Validador: exige firma del certificador |
| M3-SC-04 | Commit de firma notarial sobre dossier | **B** | Validador: exige firma del notario |
| M3-SC-03 | Liberación de pago por etapa | **B** | Validador con fondos: multifirma + etapa certificada |

## Fase A — Anclaje por metadata (sin validador)

Una transacción simple con metadata bajo el label `ANCHOR_METADATA_LABEL` (default `1904`). Payload canónico (CBOR-friendly, strings ≤ 64 bytes por regla de metadata de Cardano — los hashes hex de 64 chars entran justo):

```json
{
  "1904": {
    "v": 1,
    "t": "evidence_bundle | evidence_item | invitation | invitation_accept | document",
    "h": "<sha256 o merkle root, hex 64>",
    "r": "<referencia opaca: bundle_id/uuid>",
    "p": "<project ref opaca, opcional>"
  }
}
```

Nunca incluir nombres, emails, montos ni URLs. La correspondencia commitment↔entidad vive off-chain en `onchain_events`.

Construcción en `packages/cardano` (Lucid Evolution):

```ts
import { Lucid, Blockfrost } from "@lucid-evolution/lucid";

export async function anchorCommitment(input: {
  type: AnchorType; hashHex: string; ref: string; projectRef?: string;
}): Promise<{ txid: string }> {
  const lucid = await Lucid(
    new Blockfrost(`https://cardano-preprod.blockfrost.io/api/v0`, env.BLOCKFROST_API_KEY),
    "Preprod",
  );
  lucid.selectWallet.fromSeed(env.SERVICE_WALLET_SEED);

  const tx = await lucid
    .newTx()
    .pay.ToAddress(await lucid.wallet().address(), { lovelace: 1_000_000n }) // self-send mínimo
    .attachMetadata(Number(env.ANCHOR_METADATA_LABEL), {
      v: 1, t: input.type, h: input.hashHex, r: input.ref, ...(input.projectRef ? { p: input.projectRef } : {}),
    })
    .complete();

  const signed = await tx.sign.withWallet().complete();
  const txid = await signed.submit();
  return { txid };
}
```

## Merkle (TypeScript, `packages/cardano/src/merkle.ts`)

Determinístico: hojas = SHA-256 de cada archivo, **ordenadas lexicográficamente** antes de armar el árbol; nodos = `sha256(left || right)`; con hojas impares se duplica la última. Exponer `buildTree(leaves)`, `root(tree)`, `proof(tree, leaf)`, `verify(leaf, path, root)`. Tests con vectores fijos.

## Fase B — Validadores Aiken

### Estructura del proyecto

```
contracts/
├── aiken.toml
├── lib/plataforma/types.ak
└── validators/
    ├── certification.ak    # M3-SC-05
    ├── notary_commit.ak    # M3-SC-04
    └── stage_release.ak    # M3-SC-03
```

### Tipos compartidos (`lib/plataforma/types.ak`)

```aiken
pub type CommitDatum {
  /// sha256 del certificado o del dossier
  commitment: ByteArray,
  /// referencia opaca (uuid del milestone/dossier, como bytes)
  reference: ByteArray,
  /// key hash del firmante autorizado (certificador o notario)
  authorized_signer: ByteArray,
}

pub type CommitRedeemer {
  Commit
  Revoke
}
```

### M3-SC-05 — Commit de certificación (`validators/certification.ak`)

Patrón: el backend crea un UTxO en la dirección del script con el `CommitDatum`; gastarlo (consolidar el commit) exige la firma del certificador registrado. El TXID de esa transacción es la prueba pública.

```aiken
use cardano/transaction.{OutputReference, Transaction}
use aiken/collection/list
use plataforma/types.{CommitDatum, CommitRedeemer, Commit, Revoke}

validator certification {
  spend(
    datum: Option<CommitDatum>,
    redeemer: CommitRedeemer,
    _own_ref: OutputReference,
    self: Transaction,
  ) {
    expect Some(d) = datum
    when redeemer is {
      // El commit solo es válido si firma el certificador autorizado
      Commit -> list.has(self.extra_signatories, d.authorized_signer)
      // Revocación administrativa: misma exigencia de firma
      Revoke -> list.has(self.extra_signatories, d.authorized_signer)
    }
  }
}
```

`notary_commit.ak` (M3-SC-04) es estructuralmente idéntico con el key hash del notario; mantenerlos separados para poder endurecerlos de forma independiente.

### M3-SC-03 — Liberación de pago por etapa (esbozo)

El único validador que custodia fondos reales. Datum: `{stage_number, beneficiary, developer_key, certifier_key, certification_commitment}`. Redeemer `ReleaseStage`. Condiciones mínimas:

1. Firman developer **y** certificador (`extra_signatories` contiene ambos), o
2. la transacción referencia (reference input) el UTxO/beacon del commit de certificación de esa etapa, y
3. la salida paga `>= amount` a `beneficiary`.

Escribirlo último, con tests que cubran: falta una firma, etapa equivocada, beneficiario alterado, monto insuficiente, double-satisfaction (un release no puede satisfacer dos datums a la vez).

### Tests

```aiken
test commit_requires_signature() {
  // construir Transaction de prueba con y sin la firma; assert true/false
  ...
}
```

Correr siempre `aiken check` en CI; `aiken build` genera `contracts/plutus.json`, que `packages/cardano` importa para derivar direcciones de script y datums tipados (Lucid Evolution soporta blueprints CIP-57).

## Registro de firmantes

- Cada certificador/notario registra en su perfil el **payment key hash** de su wallet (campo `signing_key_hash`).
- En fase B, las transacciones de commit se construyen en el backend (parcialmente firmadas por la wallet de servicio que paga fees) y el certificador/notario **co-firma** desde el navegador vía CIP-30 (wallet extension) — o, decisión alternativa documentable para el MVP: custodia delegada con una wallet por rol operada por el backend. Elegir explícitamente y registrarlo en `docs/decisiones.md`.

## Checklist de seguridad on-chain

- [ ] Ningún dato personal ni URL en datums/metadata.
- [ ] Strings de metadata ≤ 64 bytes.
- [ ] Datums siempre inline (no hash-only) para verificabilidad pública.
- [ ] Validadores sin dependencia de orden de inputs.
- [ ] Protección contra double-satisfaction en `stage_release`.
- [ ] Blueprint versionado en git; direcciones de script derivadas del blueprint, nunca hardcodeadas.
