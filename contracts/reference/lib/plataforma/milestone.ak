//// Máquina de estados de Milestone — núcleo puro (sin contexto de transacción).
//// Estados del diseño aprobado:
////   Pending → InProgress → Certified
////   InProgress | Certified → Observed (flag / correctivo)
////   Observed → InProgress (reopen / remediación)
////
//// Este módulo es lógica pura y testeable con `aiken check`.
//// El validador (validators/milestone_state.ak) solo agrega los chequeos
//// de transacción (firmas, continuidad del UTxO, thread token).

pub type MilestoneState {
  Pending
  InProgress
  Certified
  Observed
}

pub type MilestoneDatum {
  /// Referencia opaca al milestone (uuid como bytes). Sin PII, nunca.
  milestone_ref: ByteArray,
  /// Payment key hash del developer del proyecto.
  developer: ByteArray,
  /// Payment key hash del certificador asignado.
  certifier: ByteArray,
  /// Estado actual.
  state: MilestoneState,
  /// Merkle root del bundle de evidencia que sustenta la certificación.
  /// Vacío ("") hasta llegar a Certified.
  evidence_root: ByteArray,
  /// Timestamp POSIX (ms) de certificación. 0 hasta Certified.
  certified_at: Int,
}

pub type Action {
  /// Pending → InProgress (developer)
  Start
  /// InProgress → Certified (certificador; exige evidencia)
  Certify { evidence_root: ByteArray, now: Int }
  /// InProgress | Certified → Observed (certificador)
  Flag
  /// Observed → InProgress (developer, tras remediación)
  Reopen
}

/// Tabla de transiciones válida según el diagrama de estados aprobado.
pub fn valid_transition(
  from: MilestoneState,
  action: Action,
  to: MilestoneState,
) -> Bool {
  when (from, action, to) is {
    (Pending, Start, InProgress) -> True
    (InProgress, Certify { .. }, Certified) -> True
    (InProgress, Flag, Observed) -> True
    (Certified, Flag, Observed) -> True
    (Observed, Reopen, InProgress) -> True
    _ -> False
  }
}

/// Quién debe firmar cada acción.
pub fn required_signer(datum: MilestoneDatum, action: Action) -> ByteArray {
  when action is {
    Start -> datum.developer
    Reopen -> datum.developer
    Certify { .. } -> datum.certifier
    Flag -> datum.certifier
  }
}

// ── Tests del núcleo puro ────────────────────────────────────────────────

test pending_can_start() {
  valid_transition(Pending, Start, InProgress)
}

test in_progress_can_be_certified() {
  valid_transition(
    InProgress,
    Certify { evidence_root: #"aa", now: 1 },
    Certified,
  )
}

test in_progress_can_be_flagged() {
  valid_transition(InProgress, Flag, Observed)
}

test certified_can_be_flagged() {
  valid_transition(Certified, Flag, Observed)
}

test observed_can_reopen() {
  valid_transition(Observed, Reopen, InProgress)
}

test cannot_certify_from_pending() {
  !valid_transition(Pending, Certify { evidence_root: #"aa", now: 1 }, Certified)
}

test cannot_start_twice() {
  !valid_transition(InProgress, Start, InProgress)
}

test cannot_reopen_certified_directly() {
  // Certified solo sale vía Flag → Observed → Reopen
  !valid_transition(Certified, Reopen, InProgress)
}

test cannot_jump_observed_to_certified() {
  !valid_transition(Observed, Certify { evidence_root: #"aa", now: 1 }, Certified)
}

test signer_matrix() {
  let d =
    MilestoneDatum {
      milestone_ref: #"01",
      developer: #"de",
      certifier: #"ce",
      state: Pending,
      evidence_root: "",
      certified_at: 0,
    }
  and {
    required_signer(d, Start) == #"de",
    required_signer(d, Reopen) == #"de",
    required_signer(d, Certify { evidence_root: #"aa", now: 1 }) == #"ce",
    required_signer(d, Flag) == #"ce",
  }
}
