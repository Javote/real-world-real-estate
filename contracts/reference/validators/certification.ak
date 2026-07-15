//// M3-SC-05 — Commit de certificación de etapa.
//// Gastar el UTxO de commit exige la firma del certificador autorizado.
//// Verificar sintaxis contra la versión de Aiken instalada (v1.1.x asumida).

use aiken/collection/list
use cardano/transaction.{OutputReference, Transaction}

pub type CommitDatum {
  /// sha256 del certificado emitido (hex decodificado a bytes)
  commitment: ByteArray,
  /// referencia opaca al milestone (uuid como bytes) — sin PII
  reference: ByteArray,
  /// payment key hash del certificador autorizado
  authorized_signer: ByteArray,
}

pub type CommitRedeemer {
  Commit
  Revoke
}

validator certification {
  spend(
    datum: Option<CommitDatum>,
    redeemer: CommitRedeemer,
    _own_ref: OutputReference,
    self: Transaction,
  ) {
    expect Some(d) = datum
    when redeemer is {
      Commit -> list.has(self.extra_signatories, d.authorized_signer)
      Revoke -> list.has(self.extra_signatories, d.authorized_signer)
    }
  }

  else(_) {
    fail
  }
}
