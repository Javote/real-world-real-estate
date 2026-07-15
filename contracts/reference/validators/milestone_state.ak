//// Validador de la máquina de estados de Milestone (patrón "state thread").
////
//// Modelo: cada milestone vive como UN UTxO en la dirección de este script,
//// identificado por un "thread token" (NFT de esta misma policy cuyo
//// asset name = milestone_ref). Cada transición de estado consume ese UTxO
//// y lo recrea en la misma dirección con el datum actualizado. El TXID de
//// cada transición es la prueba pública e inmutable del cambio de estado.
////
//// Handlers:
////   mint  → Init: acuña el thread token y crea el milestone en Pending.
////           Retire: quema el token (cierre administrativo).
////   spend → Start / Certify / Flag / Reopen según la tabla de transiciones.
////
//// ⚠️ Sintaxis asumida: Aiken v1.1.x + stdlib v2. Verificar contra la
//// versión instalada (`aiken --version`) antes de asumir nombres de módulos.

use aiken/collection/dict
use aiken/collection/list
use aiken/interval.{Finite}
use cardano/address.{Script}
use cardano/assets.{PolicyId}
use cardano/transaction.{InlineDatum, OutputReference, Transaction, find_input}
use plataforma/milestone.{
  Action, Certify, Flag, MilestoneDatum, Pending, Reopen, Start,
  required_signer, valid_transition,
}

pub type MintAction {
  /// Crear el milestone: acuña 1 thread token y lo deposita en el script
  /// con datum inicial en Pending.
  Init
  /// Quemar el thread token (solo cantidades negativas).
  Retire
}

validator milestone_state {
  // ────────────────────────────────────────────────────────────────────
  // SPEND: transiciones de estado
  // ────────────────────────────────────────────────────────────────────
  spend(
    datum: Option<MilestoneDatum>,
    action: Action,
    own_ref: OutputReference,
    self: Transaction,
  ) {
    expect Some(old) = datum

    // 1. Localizar el input propio → dirección del script.
    //    El hash del script es también la policy del thread token
    //    (mismo validador para mint y spend).
    expect Some(own_input) = find_input(self.inputs, own_ref)
    let own_address = own_input.output.address
    expect Script(own_hash) = own_address.payment_credential

    // 2. Exactamente UNA salida de continuación: misma dirección,
    //    portando el thread token del milestone. Evita duplicar el hilo
    //    y protege contra double-satisfaction.
    expect [continuing] =
      list.filter(
        self.outputs,
        fn(o) {
          o.address == own_address && assets.quantity_of(
            o.value,
            own_hash,
            old.milestone_ref,
          ) == 1
        },
      )

    // 3. Datum nuevo, inline y bien tipado.
    expect InlineDatum(raw_datum) = continuing.datum
    expect new: MilestoneDatum = raw_datum

    // 4. La identidad del milestone es inmutable.
    let identity_preserved = and {
        new.milestone_ref == old.milestone_ref,
        new.developer == old.developer,
        new.certifier == old.certifier,
      }

    // 5. Transición permitida por la tabla + firma del actor correcto.
    let transition_ok = valid_transition(old.state, action, new.state)
    let signed_by_actor =
      list.has(self.extra_signatories, required_signer(old, action))

    // 6. Reglas específicas de cada acción.
    let action_rules =
      when action is {
        // Certificar exige evidencia anclada y timestamp coherente con
        // el rango de validez de la transacción.
        Certify { evidence_root, now } -> {
          let evidence_ok = and {
              evidence_root != "",
              new.evidence_root == evidence_root,
            }
          let time_ok =
            when self.validity_range.lower_bound.bound_type is {
              // La tx debe declarar un lower bound finito y `now` no puede
              // ser anterior a él (el backend setea lower bound = now).
              Finite(lower) -> and {
                  new.certified_at == now,
                  now >= lower,
                }
              _ -> False
            }
          evidence_ok? && time_ok?
        }
        // Start no puede tocar evidencia ni certificación.
        Start -> and {
            new.evidence_root == old.evidence_root,
            new.certified_at == 0,
          }
        // Flag preserva la evidencia y la fecha de certificación previas
        // (la observación queda trazada off-chain con notas + audit_log).
        Flag -> and {
            new.evidence_root == old.evidence_root,
            new.certified_at == old.certified_at,
          }
        // Reopen vuelve a InProgress; la evidencia previa se preserva.
        Reopen -> new.evidence_root == old.evidence_root
      }

    identity_preserved? && transition_ok? && signed_by_actor? && action_rules?
  }

  // ────────────────────────────────────────────────────────────────────
  // MINT: creación (Init) y cierre (Retire) del thread token
  // ────────────────────────────────────────────────────────────────────
  mint(action: MintAction, policy_id: PolicyId, self: Transaction) {
    let minted = dict.to_pairs(assets.tokens(self.mint, policy_id))
    when action is {
      Init -> {
        // Se acuña exactamente 1 token; su asset name = milestone_ref.
        expect [Pair(asset_name, 1)] = minted

        // El token debe quedar depositado en este mismo script...
        expect [out] =
          list.filter(
            self.outputs,
            fn(o) {
              o.address.payment_credential == Script(policy_id) && assets.quantity_of(
                o.value,
                policy_id,
                asset_name,
              ) == 1
            },
          )

        // ...con un datum inicial consistente y en Pending.
        expect InlineDatum(raw_datum) = out.datum
        expect d: MilestoneDatum = raw_datum
        and {
          d.milestone_ref == asset_name,
          d.state == Pending,
          d.evidence_root == "",
          d.certified_at == 0,
          // El developer dueño del proyecto autoriza la creación.
          list.has(self.extra_signatories, d.developer),
        }
      }
      // Retire: solo quemas (cantidades negativas), nada se acuña.
      Retire ->
        list.all(minted, fn(pair) { let Pair(_, qty) = pair
          qty < 0 })
    }
  }

  else(_) {
    fail
  }
}
