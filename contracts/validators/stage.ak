//// Validador de la FSM de stages de obra (D-020, M1-D2 §3).
////
//// **No custodia ni transfiere valor** (D-021): el UTxO lleva un mínimo de ADA
//// que la transición conserva intacto. Lo que el validador protege es la
//// *secuencia*: cada transición gasta el UTxO anterior, así que el historial
//// queda encadenado y ni el operador puede reescribirlo después (D-008).
////
//// El firmante es el `admin` —la wallet de servicio— porque el whitepaper
//// §System Overview lo dice explícito: *"All blockchain interactions are
//// performed by operator-controlled backend services"*. La co-firma CIP-30 del
//// certificador (D-009) es Fase B y no está acá.
////
//// Lo que este validador **no** hace todavía: no hay thread token, así que
//// puede haber hilos paralelos en la misma dirección. Ver D-057.

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/interval.{Finite}
use cardano/address.{Address}
use cardano/assets
use cardano/transaction.{
  Datum, InlineDatum, Input, NoDatum, Output, OutputReference, Transaction,
  ValidityRange, find_input,
}
use propnexus/fsm.{
  Advance, Completed, Completion, InProgress, Observed, Pending, StageDatum,
  StageRedeemer, StageState, valid_datum_evolution,
}

fn at_address(outputs: List<Output>, address: Address) -> List<Output> {
  list.filter(outputs, fn(output) { output.address == address })
}

fn inputs_at_address(inputs: List<Input>, address: Address) -> Int {
  inputs
    |> list.filter(fn(input) { input.output.address == address })
    |> list.length
}

/// El timestamp que se escribe en el datum tiene que caer dentro de la ventana
/// de validez declarada por la transacción, con **las dos puntas finitas**: sin
/// eso, `completed_at` sería un número que el operador elige libremente y la
/// afirmación "se registró en este momento" no se sostendría.
fn within_validity_range(range: ValidityRange, now: Int) -> Bool {
  expect Finite(lower) = range.lower_bound.bound_type
  expect Finite(upper) = range.upper_bound.bound_type
  and {
    now >= lower,
    now <= upper,
  }
}

validator stage(admin: VerificationKeyHash) {
  spend(
    datum: Option<StageDatum>,
    redeemer: StageRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    expect Some(old_datum) = datum
    expect Some(own_input) = find_input(tx.inputs, own_ref)
    let own_address = own_input.output.address

    // Un input del script y un output al script por transacción: sin esto,
    // dos hilos podrían fusionarse o partirse en la misma tx.
    expect inputs_at_address(tx.inputs, own_address) == 1
    expect [continuing_output] = at_address(tx.outputs, own_address)

    // Solo el operador mueve el hilo.
    expect list.has(tx.extra_signatories, admin)

    expect InlineDatum(raw_new_datum) = continuing_output.datum
    expect new_datum: StageDatum = raw_new_datum

    let Advance { to, completion } = redeemer

    // El valor bloqueado no se toca (D-021).
    expect continuing_output.value == own_input.output.value

    // La ventana de tiempo solo aplica cuando se escribe un timestamp.
    let time_ok =
      when completion is {
        Some(Completion { now, .. }) ->
          within_validity_range(tx.validity_range, now)
        None -> True
      }

    and {
      valid_datum_evolution(old_datum, new_datum, to, completion),
      time_ok,
    }
  }

  else(_) {
    fail
  }
}

// ── Tests ────────────────────────────────────────────────────────────────
//
// Un test por punto de rechazo del validador, más los cuatro caminos felices
// (las cuatro transiciones válidas de D-020). Los negativos van marcados
// `fail` porque los `expect` abortan en vez de devolver False.

const admin_key: VerificationKeyHash =
  #"00000000000000000000000000000000000000000000000000000000"

const other_key: VerificationKeyHash =
  #"11111111111111111111111111111111111111111111111111111111"

const script_hash: ByteArray =
  #"22222222222222222222222222222222222222222222222222222222"

const root: ByteArray =
  #"1111111111111111111111111111111111111111111111111111111111111111"

const own_ref: OutputReference =
  OutputReference {
    transaction_id: #"0000000000000000000000000000000000000000000000000000000000000000",
    output_index: 0,
  }

fn script_address() -> Address {
  address.from_script(script_hash)
}

fn wallet_address() -> Address {
  address.from_verification_key(other_key)
}

fn datum_at(state: StageState, critical: Bool) -> StageDatum {
  StageDatum {
    project_ref: #"70726f6a656374",
    stage_ref: #"7374616765",
    sequence_order: 1,
    validation_critical: critical,
    state,
    evidence_root: "",
    completed_at: 0,
  }
}

fn locked_value() -> assets.Value {
  assets.from_lovelace(2_000_000)
}

fn script_input(d: StageDatum) -> Input {
  Input {
    output_reference: own_ref,
    output: Output {
      address: script_address(),
      value: locked_value(),
      datum: InlineDatum(d),
      reference_script: None,
    },
  }
}

fn script_output_with(datum: Datum, value: assets.Value) -> Output {
  Output { address: script_address(), value, datum, reference_script: None }
}

fn tx(
  inputs: List<Input>,
  outputs: List<Output>,
  signatories: List<VerificationKeyHash>,
  now: Int,
) -> Transaction {
  Transaction {
    ..transaction.placeholder,
    inputs,
    outputs,
    extra_signatories: signatories,
    validity_range: interval.between(now - 1, now + 1),
  }
}

/// Transacción canónica: un input del script, un output al script con el datum
/// nuevo, firmada por el admin, con ventana de validez alrededor de `now`.
fn transition_tx(old: StageDatum, new: StageDatum, now: Int) -> Transaction {
  tx(
    [script_input(old)],
    [script_output_with(InlineDatum(new), locked_value())],
    [admin_key],
    now,
  )
}

// ── Caminos felices: las cuatro transiciones de D-020 ────────────────────

test spend_starts_a_stage() {
  let old = datum_at(Pending, True)
  let new = StageDatum { ..old, state: InProgress }
  stage.spend(
    admin_key,
    Some(old),
    Advance { to: InProgress, completion: None },
    own_ref,
    transition_tx(old, new, 100),
  )
}

test spend_flags_a_stage() {
  let old = datum_at(InProgress, True)
  let new = StageDatum { ..old, state: Observed }
  stage.spend(
    admin_key,
    Some(old),
    Advance { to: Observed, completion: None },
    own_ref,
    transition_tx(old, new, 100),
  )
}

test spend_resumes_after_remediation() {
  let old = datum_at(Observed, True)
  let new = StageDatum { ..old, state: InProgress }
  stage.spend(
    admin_key,
    Some(old),
    Advance { to: InProgress, completion: None },
    own_ref,
    transition_tx(old, new, 100),
  )
}

test spend_completes_a_critical_stage_with_evidence() {
  let old = datum_at(InProgress, True)
  let new =
    StageDatum {
      ..old,
      state: Completed,
      evidence_root: root,
      completed_at: 100,
    }
  stage.spend(
    admin_key,
    Some(old),
    Advance {
      to: Completed,
      completion: Some(Completion { evidence_root: root, now: 100 }),
    },
    own_ref,
    transition_tx(old, new, 100),
  )
}

test spend_completes_a_non_critical_stage_without_evidence() {
  let old = datum_at(InProgress, False)
  let new = StageDatum { ..old, state: Completed, completed_at: 100 }
  stage.spend(
    admin_key,
    Some(old),
    Advance {
      to: Completed,
      completion: Some(Completion { evidence_root: "", now: 100 }),
    },
    own_ref,
    transition_tx(old, new, 100),
  )
}

// ── Puntos de rechazo ────────────────────────────────────────────────────

test spend_rejects_missing_datum() fail {
  let old = datum_at(Pending, True)
  let new = StageDatum { ..old, state: InProgress }
  stage.spend(
    admin_key,
    None,
    Advance { to: InProgress, completion: None },
    own_ref,
    transition_tx(old, new, 100),
  )
}

test spend_rejects_unknown_own_ref() fail {
  let old = datum_at(Pending, True)
  let new = StageDatum { ..old, state: InProgress }
  stage.spend(
    admin_key,
    Some(old),
    Advance { to: InProgress, completion: None },
    OutputReference { ..own_ref, output_index: 9 },
    transition_tx(old, new, 100),
  )
}

test spend_rejects_two_script_inputs() fail {
  let old = datum_at(Pending, True)
  let new = StageDatum { ..old, state: InProgress }
  let second =
    Input {
      ..script_input(old),
      output_reference: OutputReference { ..own_ref, output_index: 1 },
    }
  stage.spend(
    admin_key,
    Some(old),
    Advance { to: InProgress, completion: None },
    own_ref,
    tx(
      [script_input(old), second],
      [script_output_with(InlineDatum(new), locked_value())],
      [admin_key],
      100,
    ),
  )
}

test spend_rejects_two_script_outputs() fail {
  let old = datum_at(Pending, True)
  let new = StageDatum { ..old, state: InProgress }
  let out = script_output_with(InlineDatum(new), locked_value())
  stage.spend(
    admin_key,
    Some(old),
    Advance { to: InProgress, completion: None },
    own_ref,
    tx([script_input(old)], [out, out], [admin_key], 100),
  )
}

test spend_rejects_no_continuing_output() fail {
  let old = datum_at(Pending, True)
  let elsewhere =
    Output {
      address: wallet_address(),
      value: locked_value(),
      datum: NoDatum,
      reference_script: None,
    }
  stage.spend(
    admin_key,
    Some(old),
    Advance { to: InProgress, completion: None },
    own_ref,
    tx([script_input(old)], [elsewhere], [admin_key], 100),
  )
}

test spend_rejects_missing_admin_signature() fail {
  let old = datum_at(Pending, True)
  let new = StageDatum { ..old, state: InProgress }
  stage.spend(
    admin_key,
    Some(old),
    Advance { to: InProgress, completion: None },
    own_ref,
    tx(
      [script_input(old)],
      [script_output_with(InlineDatum(new), locked_value())],
      [other_key],
      100,
    ),
  )
}

test spend_rejects_non_inline_datum() fail {
  let old = datum_at(Pending, True)
  stage.spend(
    admin_key,
    Some(old),
    Advance { to: InProgress, completion: None },
    own_ref,
    tx(
      [script_input(old)],
      [script_output_with(NoDatum, locked_value())],
      [admin_key],
      100,
    ),
  )
}

test spend_rejects_value_drain() fail {
  let old = datum_at(Pending, True)
  let new = StageDatum { ..old, state: InProgress }
  stage.spend(
    admin_key,
    Some(old),
    Advance { to: InProgress, completion: None },
    own_ref,
    tx(
      [script_input(old)],
      [script_output_with(InlineDatum(new), assets.from_lovelace(1_000_000))],
      [admin_key],
      100,
    ),
  )
}

test spend_rejects_invalid_transition() fail {
  let old = datum_at(Pending, True)
  let new = StageDatum { ..old, state: Completed, completed_at: 100 }
  stage.spend(
    admin_key,
    Some(old),
    Advance {
      to: Completed,
      completion: Some(Completion { evidence_root: root, now: 100 }),
    },
    own_ref,
    transition_tx(old, new, 100),
  )
}

test spend_rejects_leaving_completed() fail {
  let old =
    StageDatum {
      ..datum_at(Completed, True),
      evidence_root: root,
      completed_at: 50,
    }
  let new = StageDatum { ..old, state: Observed }
  stage.spend(
    admin_key,
    Some(old),
    Advance { to: Observed, completion: None },
    own_ref,
    transition_tx(old, new, 100),
  )
}

test spend_rejects_identity_rewrite() fail {
  let old = datum_at(Pending, True)
  let new = StageDatum { ..old, state: InProgress, stage_ref: #"6f74726f" }
  stage.spend(
    admin_key,
    Some(old),
    Advance { to: InProgress, completion: None },
    own_ref,
    transition_tx(old, new, 100),
  )
}

test spend_rejects_criticality_downgrade() fail {
  let old = datum_at(InProgress, True)
  let new =
    StageDatum {
      ..old,
      state: Completed,
      validation_critical: False,
      completed_at: 100,
    }
  stage.spend(
    admin_key,
    Some(old),
    Advance {
      to: Completed,
      completion: Some(Completion { evidence_root: "", now: 100 }),
    },
    own_ref,
    transition_tx(old, new, 100),
  )
}

test spend_rejects_completing_critical_without_evidence() fail {
  let old = datum_at(InProgress, True)
  let new = StageDatum { ..old, state: Completed, completed_at: 100 }
  stage.spend(
    admin_key,
    Some(old),
    Advance {
      to: Completed,
      completion: Some(Completion { evidence_root: "", now: 100 }),
    },
    own_ref,
    transition_tx(old, new, 100),
  )
}

test spend_rejects_datum_not_matching_redeemer() fail {
  let old = datum_at(InProgress, True)
  let new = StageDatum { ..old, state: Observed }
  stage.spend(
    admin_key,
    Some(old),
    Advance { to: Completed, completion: None },
    own_ref,
    transition_tx(old, new, 100),
  )
}

test spend_rejects_timestamp_outside_validity_range() fail {
  let old = datum_at(InProgress, False)
  let new = StageDatum { ..old, state: Completed, completed_at: 500 }
  stage.spend(
    admin_key,
    Some(old),
    Advance {
      to: Completed,
      completion: Some(Completion { evidence_root: "", now: 500 }),
    },
    own_ref,
    transition_tx(old, new, 100),
  )
}

test spend_rejects_open_ended_validity_range() fail {
  let old = datum_at(InProgress, False)
  let new = StageDatum { ..old, state: Completed, completed_at: 100 }
  stage.spend(
    admin_key,
    Some(old),
    Advance {
      to: Completed,
      completion: Some(Completion { evidence_root: "", now: 100 }),
    },
    own_ref,
    Transaction {
      ..transition_tx(old, new, 100),
      validity_range: interval.everything,
    },
  )
}
