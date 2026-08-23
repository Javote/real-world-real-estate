//// Núcleo puro de la FSM de stages de obra: tipos, tabla de transiciones y
//// reglas del datum. Sin contexto de transacción, para que se pruebe barato
//// (D-008: el validador es cáscara delgada sobre esto).
////
//// La FSM es la de `M1-D2/3-milestone-lifecycle.puml`, ratificada por D-020:
////
////   Pending → InProgress → Completed        (Completed es TERMINAL)
////                ↑↓
////             Observed                      (remediación, no estado final)
////
//// El datum sale de `M1-D2/2-core-domain-model.puml` (entidad `Milestone`),
//// menos todo lo que sea legible: on-chain van refs opacas, un commitment y
//// un timestamp — nunca nombres (whitepaper §On-Chain/Off-Chain Boundaries y
//// regla 2 de `CLAUDE.md`).

use aiken/primitive/bytearray

/// Estados del stage. `Completed`, no `Certified`: la plataforma no certifica
/// (D-020 sobre D-026). La etiqueta que ve el usuario sale del i18n.
pub type StageState {
  Pending
  InProgress
  Observed
  Completed
}

/// Lo que M1-D2 llama `Milestone`, sin los campos que no pueden salir del
/// off-chain. `name` se queda afuera a propósito.
pub type StageDatum {
  /// Ref opaca al proyecto (el id off-chain como bytes). Sin PII.
  project_ref: ByteArray,
  /// Ref opaca al stage (`milestone_id` de M1-D2). Sin PII.
  stage_ref: ByteArray,
  /// Orden del stage dentro del proyecto (`sequence_order` de M1-D2).
  sequence_order: Int,
  /// `validation_critical` de M1-D2: si es True, completar exige evidencia.
  validation_critical: Bool,
  state: StageState,
  /// `bundle_commitment_hash` del `EvidenceBundle` que sustenta la
  /// completitud (M1-D2). Vacío hasta `Completed`; 32 bytes cuando existe.
  evidence_root: ByteArray,
  /// POSIX ms del cierre (`certified_at` de M1-D2). 0 hasta `Completed`.
  completed_at: Int,
}

/// Datos que solo tienen sentido al completar. Presente exactamente cuando la
/// transición va a `Completed`.
pub type Completion {
  evidence_root: ByteArray,
  now: Int,
}

pub type StageRedeemer {
  Advance { to: StageState, completion: Option<Completion> }
}

/// Largo de un SHA-256 / Merkle root en bytes.
pub const commitment_length: Int = 32

/// **La tabla de transiciones.** Espejo 1:1 del backend: si cambia una,
/// cambian las dos en el mismo commit.
pub fn valid_transition(from: StageState, to: StageState) -> Bool {
  when from is {
    Pending -> to == InProgress
    InProgress -> to == Observed || to == Completed
    Observed -> to == InProgress
    Completed -> False
  }
}

/// La identidad del stage no cambia nunca: quien gasta el UTxO no puede
/// reescribir a qué stage pertenece ni si era crítico.
pub fn identity_preserved(old: StageDatum, new: StageDatum) -> Bool {
  and {
    new.project_ref == old.project_ref,
    new.stage_ref == old.stage_ref,
    new.sequence_order == old.sequence_order,
    new.validation_critical == old.validation_critical,
  }
}

/// Whitepaper §Signature and Certification Rules: *"Milestones designated as
/// validation-critical cannot reach Certified status unless their required
/// evidence set is complete"*. Acá eso es: sin commitment de evidencia, un
/// stage crítico no llega a `Completed`.
pub fn completion_evidence_ok(
  validation_critical: Bool,
  evidence_root: ByteArray,
) -> Bool {
  if validation_critical {
    bytearray.length(evidence_root) == commitment_length
  } else {
    True
  }
}

/// Regla completa de evolución del datum, sin mirar la transacción.
pub fn valid_datum_evolution(
  old: StageDatum,
  new: StageDatum,
  to: StageState,
  completion: Option<Completion>,
) -> Bool {
  and {
    new.state == to,
    valid_transition(old.state, to),
    identity_preserved(old, new),
    when completion is {
      // Completar: la evidencia y el timestamp entran por el redeemer y
      // quedan escritos en el datum.
      Some(Completion { evidence_root, now }) -> and {
          to == Completed,
          new.evidence_root == evidence_root,
          new.completed_at == now,
          now > 0,
          completion_evidence_ok(old.validation_critical, evidence_root),
        }
      // Cualquier otra transición no toca evidencia ni fecha de cierre.
      None -> and {
          to != Completed,
          new.evidence_root == old.evidence_root,
          new.completed_at == old.completed_at,
        }
    },
  }
}

// ── Tests: la tabla de transiciones, exhaustiva (4 × 4) ──────────────────
//
// Los 4 caminos válidos y los 12 inválidos. Que estén los 16 es lo que hace
// demostrable el criterio 2 del SOM: no hay par sin test.

test t_pending_to_in_progress() {
  valid_transition(Pending, InProgress)
}

test t_pending_to_pending() {
  !valid_transition(Pending, Pending)
}

test t_pending_to_observed() {
  !valid_transition(Pending, Observed)
}

test t_pending_to_completed() {
  !valid_transition(Pending, Completed)
}

test t_in_progress_to_completed() {
  valid_transition(InProgress, Completed)
}

test t_in_progress_to_observed() {
  valid_transition(InProgress, Observed)
}

test t_in_progress_to_pending() {
  !valid_transition(InProgress, Pending)
}

test t_in_progress_to_in_progress() {
  !valid_transition(InProgress, InProgress)
}

test t_observed_to_in_progress() {
  valid_transition(Observed, InProgress)
}

test t_observed_to_completed() {
  !valid_transition(Observed, Completed)
}

test t_observed_to_pending() {
  !valid_transition(Observed, Pending)
}

test t_observed_to_observed() {
  !valid_transition(Observed, Observed)
}

test t_completed_is_terminal_to_pending() {
  !valid_transition(Completed, Pending)
}

test t_completed_is_terminal_to_in_progress() {
  !valid_transition(Completed, InProgress)
}

test t_completed_is_terminal_to_observed() {
  !valid_transition(Completed, Observed)
}

test t_completed_is_terminal_to_completed() {
  !valid_transition(Completed, Completed)
}

// ── Tests: reglas del datum ──────────────────────────────────────────────

const root: ByteArray =
  #"1111111111111111111111111111111111111111111111111111111111111111"

fn sample(state: StageState, critical: Bool) -> StageDatum {
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

test t_identity_preserved_ok() {
  let old = sample(InProgress, True)
  identity_preserved(old, StageDatum { ..old, state: Completed })
}

test t_identity_rejects_project_swap() {
  let old = sample(InProgress, True)
  !identity_preserved(old, StageDatum { ..old, project_ref: #"6f74726f" })
}

test t_identity_rejects_stage_swap() {
  let old = sample(InProgress, True)
  !identity_preserved(old, StageDatum { ..old, stage_ref: #"6f74726f" })
}

test t_identity_rejects_sequence_swap() {
  let old = sample(InProgress, True)
  !identity_preserved(old, StageDatum { ..old, sequence_order: 2 })
}

test t_identity_rejects_criticality_swap() {
  let old = sample(InProgress, True)
  !identity_preserved(old, StageDatum { ..old, validation_critical: False })
}

test t_critical_needs_a_full_commitment() {
  and {
    completion_evidence_ok(True, root),
    !completion_evidence_ok(True, ""),
    !completion_evidence_ok(True, #"1111"),
  }
}

test t_non_critical_completes_without_evidence() {
  completion_evidence_ok(False, "")
}

test t_evolution_completes_critical_with_evidence() {
  let old = sample(InProgress, True)
  let new =
    StageDatum { ..old, state: Completed, evidence_root: root, completed_at: 5 }
  valid_datum_evolution(
    old,
    new,
    Completed,
    Some(Completion { evidence_root: root, now: 5 }),
  )
}

test t_evolution_rejects_critical_without_evidence() {
  let old = sample(InProgress, True)
  let new = StageDatum { ..old, state: Completed, completed_at: 5 }
  !valid_datum_evolution(
    old,
    new,
    Completed,
    Some(Completion { evidence_root: "", now: 5 }),
  )
}

test t_evolution_rejects_completion_without_payload() {
  let old = sample(InProgress, False)
  let new = StageDatum { ..old, state: Completed }
  !valid_datum_evolution(old, new, Completed, None)
}

test t_evolution_rejects_payload_on_non_completion() {
  let old = sample(InProgress, False)
  let new = StageDatum { ..old, state: Observed }
  !valid_datum_evolution(
    old,
    new,
    Observed,
    Some(Completion { evidence_root: root, now: 5 }),
  )
}

test t_evolution_rejects_datum_state_mismatch() {
  let old = sample(Pending, False)
  let new = StageDatum { ..old, state: Observed }
  !valid_datum_evolution(old, new, InProgress, None)
}

test t_evolution_rejects_evidence_rewrite_on_flag() {
  let old =
    StageDatum { ..sample(InProgress, True), evidence_root: #"2222222222" }
  let new = StageDatum { ..old, state: Observed, evidence_root: root }
  !valid_datum_evolution(old, new, Observed, None)
}

test t_evolution_rejects_completed_at_rewrite_on_flag() {
  let old = sample(InProgress, False)
  let new = StageDatum { ..old, state: Observed, completed_at: 9 }
  !valid_datum_evolution(old, new, Observed, None)
}

test t_evolution_rejects_zero_timestamp() {
  let old = sample(InProgress, False)
  let new = StageDatum { ..old, state: Completed }
  !valid_datum_evolution(
    old,
    new,
    Completed,
    Some(Completion { evidence_root: "", now: 0 }),
  )
}

test t_evolution_rejects_leaving_terminal() {
  let old =
    StageDatum {
      ..sample(Completed, True),
      evidence_root: root,
      completed_at: 5,
    }
  let new = StageDatum { ..old, state: Observed }
  !valid_datum_evolution(old, new, Observed, None)
}
