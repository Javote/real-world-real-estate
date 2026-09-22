# Mutantes de los puntos de rechazo del validador

Corrida: 2026-09-22T02:12:19.529Z · aiken aiken v1.1.21+42babe5

**51 mutantes: 50 muertos, 1 vivos, 0 inválidos.**

| Archivo:línea | Qué se sacó | Chequeo original | Resultado | Tests que lo detectaron |
|---|---|---|---|---|
| `validators/stage.ak:37` | condición de filtro | `list.filter(outputs, fn(output) { output.address == address })` | muerto | `spend_accepts_an_unrelated_output_elsewhere` |
| `validators/stage.ak:51` | conjunción de and | `output.address.payment_credential == Script(policy),` | muerto | `mint_rejects_token_not_locked_in_the_script` |
| `validators/stage.ak:52` | conjunción de and | `assets.quantity_of(output.value, policy, stage_ref) == 1,` | muerto | `mint_rejects_output_holding_extra_units_of_the_token` |
| `validators/stage.ak:60` | condición de filtro | `\|> list.filter(fn(input) { input.output.address == address })` | muerto | `spend_accepts_an_extra_wallet_input` |
| `validators/stage.ak:69` | punta infinita aceptada | `expect Finite(lower) = range.lower_bound.bound_type` | muerto | `spend_rejects_missing_lower_bound` |
| `validators/stage.ak:70` | punta infinita aceptada | `expect Finite(upper) = range.upper_bound.bound_type` | muerto | `spend_rejects_missing_upper_bound` |
| `validators/stage.ak:72` | conjunción de and | `now >= lower,` | muerto | `spend_rejects_timestamp_one_below_lower_bound` |
| `validators/stage.ak:73` | conjunción de and | `now <= upper,` | muerto | `spend_rejects_timestamp_outside_validity_range`, `spend_rejects_timestamp_one_above_upper_bound` |
| `validators/stage.ak:91` | expect booleano | `expect assets.quantity_of( own_input.output.value, own_policy, old_datum.stage_ref, ) == 1` | VIVO |  |
| `validators/stage.ak:100` | expect booleano | `expect inputs_at_address(tx.inputs, own_address) == 1` | muerto | `spend_rejects_two_script_inputs` |
| `validators/stage.ak:101` | patrón de lista: elementos de más | `expect [continuing_output] = at_address(tx.outputs, own_address)` | muerto | `spend_rejects_a_second_output_at_the_exact_script_address` |
| `validators/stage.ak:104` | patrón de lista: elementos de más | `expect [_] = carrying_thread(tx.outputs, own_policy, old_datum.stage_ref)` | muerto | `spend_rejects_thread_split_across_a_staking_variant_of_the_script_address` |
| `validators/stage.ak:107` | expect booleano | `expect list.has(tx.extra_signatories, admin)` | muerto | `spend_rejects_missing_admin_signature` |
| `validators/stage.ak:125` | expect booleano | `expect continuing_output.value == own_input.output.value` | muerto | `spend_rejects_ada_drain_while_keeping_the_token` |
| `validators/stage.ak:136` | conjunción de and | `valid_datum_evolution(old_datum, new_datum, to, completion),` | muerto | `spend_rejects_new_datum_of_the_wrong_type`, `spend_rejects_invalid_transition`, `spend_rejects_leaving_completed` y 4 más |
| `validators/stage.ak:137` | conjunción de and | `time_ok,` | muerto | `spend_rejects_timestamp_outside_validity_range`, `spend_rejects_open_ended_validity_range`, `spend_rejects_timestamp_one_below_lower_bound` y 3 más |
| `validators/stage.ak:144` | expect booleano | `expect list.has(tx.extra_signatories, admin)` | muerto | `mint_rejects_missing_admin_signature` |
| `validators/stage.ak:150` | patrón de lista: elementos de más | `expect [Pair(asset_name, 1)] = dict.to_pairs(assets.tokens(tx.mint, policy_id))` | muerto | `mint_rejects_two_asset_names_when_both_are_present_in_the_output` |
| `validators/stage.ak:150` | patrón de lista: cualquier cantidad | `expect [Pair(asset_name, 1)] = dict.to_pairs(assets.tokens(tx.mint, policy_id))` | muerto | `mint_rejects_a_burn` |
| `validators/stage.ak:153` | patrón de lista: elementos de más | `expect [thread_output] = carrying_thread(tx.outputs, policy_id, asset_name)` | muerto | `mint_rejects_two_outputs_each_carrying_one_unit` |
| `validators/stage.ak:158` | conjunción de and | `initial_datum.stage_ref == asset_name,` | muerto | `mint_rejects_asset_name_not_matching_stage_ref` |
| `validators/stage.ak:159` | conjunción de and | `valid_initial_datum(initial_datum),` | muerto | `mint_rejects_starting_outside_pending`, `mint_rejects_preloaded_evidence` |
| `validators/stage.ak:164` | fail | `fail` | muerto | `else_rejects_other_script_purposes` |
| `lib/propnexus/fsm.ak:95` | rama de when | `Pending -> to == InProgress` | muerto | `t_pending_to_pending`, `t_pending_to_observed`, `t_pending_to_completed` |
| `lib/propnexus/fsm.ak:96` | rama de when | `InProgress -> to == Observed \|\| to == Completed` | muerto | `t_in_progress_to_pending`, `t_in_progress_to_in_progress` |
| `lib/propnexus/fsm.ak:97` | rama de when | `Observed -> to == InProgress` | muerto | `t_observed_to_completed`, `t_observed_to_pending`, `t_observed_to_observed` |
| `lib/propnexus/fsm.ak:98` | rama de when | `Completed -> False` | muerto | `t_completed_is_terminal_to_pending`, `t_completed_is_terminal_to_in_progress`, `t_completed_is_terminal_to_observed` y 3 más |
| `lib/propnexus/fsm.ak:106` | conjunción de and | `new.project_ref == old.project_ref,` | muerto | `t_identity_rejects_project_swap` |
| `lib/propnexus/fsm.ak:107` | conjunción de and | `new.stage_ref == old.stage_ref,` | muerto | `t_identity_rejects_stage_swap`, `spend_rejects_identity_rewrite` |
| `lib/propnexus/fsm.ak:108` | conjunción de and | `new.sequence_order == old.sequence_order,` | muerto | `t_identity_rejects_sequence_swap` |
| `lib/propnexus/fsm.ak:109` | conjunción de and | `new.validation_critical == old.validation_critical,` | muerto | `t_identity_rejects_criticality_swap` |
| `lib/propnexus/fsm.ak:122` | cuerpo de if | `bytearray.length(evidence_root) == commitment_length` | muerto | `t_critical_needs_a_full_commitment`, `t_evolution_rejects_critical_without_evidence`, `spend_rejects_completing_critical_without_evidence` |
| `lib/propnexus/fsm.ak:136` | conjunción de and | `new.state == to,` | muerto | `t_evolution_rejects_datum_state_mismatch` |
| `lib/propnexus/fsm.ak:137` | conjunción de and | `valid_transition(old.state, to),` | muerto | `t_evolution_rejects_leaving_terminal`, `spend_rejects_leaving_completed` |
| `lib/propnexus/fsm.ak:138` | conjunción de and | `identity_preserved(old, new),` | muerto | `spend_rejects_identity_rewrite` |
| `lib/propnexus/fsm.ak:143` | conjunción de and | `to == Completed,` | muerto | `t_evolution_rejects_completion_payload_matching_a_non_completing_transition` |
| `lib/propnexus/fsm.ak:144` | conjunción de and | `new.evidence_root == evidence_root,` | muerto | `t_evolution_rejects_evidence_root_mismatch_between_redeemer_and_datum` |
| `lib/propnexus/fsm.ak:145` | conjunción de and | `new.completed_at == now,` | muerto | `t_evolution_rejects_completed_at_mismatch_between_redeemer_and_now` |
| `lib/propnexus/fsm.ak:146` | conjunción de and | `now > 0,` | muerto | `t_evolution_rejects_zero_timestamp` |
| `lib/propnexus/fsm.ak:147` | conjunción de and | `completion_evidence_ok(old.validation_critical, evidence_root),` | muerto | `t_evolution_rejects_critical_without_evidence`, `spend_rejects_completing_critical_without_evidence` |
| `lib/propnexus/fsm.ak:151` | conjunción de and | `to != Completed,` | muerto | `t_evolution_rejects_completion_without_payload` |
| `lib/propnexus/fsm.ak:152` | conjunción de and | `new.evidence_root == old.evidence_root,` | muerto | `t_evolution_rejects_evidence_rewrite_on_flag`, `prop_non_completing_evolution_preserves_evidence` |
| `lib/propnexus/fsm.ak:153` | conjunción de and | `new.completed_at == old.completed_at,` | muerto | `t_evolution_rejects_completed_at_rewrite_on_flag`, `prop_non_completing_evolution_preserves_evidence` |
| `lib/propnexus/fsm.ak:162` | conjunción de and | `len > 0,` | muerto | `t_initial_rejects_empty_refs` |
| `lib/propnexus/fsm.ak:163` | conjunción de and | `len <= max_ref_length,` | muerto | `t_initial_rejects_ref_longer_than_an_asset_name` |
| `lib/propnexus/fsm.ak:173` | conjunción de and | `d.state == Pending,` | muerto | `t_initial_rejects_non_pending_state`, `mint_rejects_starting_outside_pending` |
| `lib/propnexus/fsm.ak:174` | conjunción de and | `d.evidence_root == "",` | muerto | `t_initial_rejects_preloaded_evidence` |
| `lib/propnexus/fsm.ak:175` | conjunción de and | `d.completed_at == 0,` | muerto | `t_initial_rejects_preloaded_timestamp` |
| `lib/propnexus/fsm.ak:176` | conjunción de and | `d.sequence_order > 0,` | muerto | `t_initial_rejects_non_positive_sequence` |
| `lib/propnexus/fsm.ak:177` | conjunción de and | `valid_ref(d.project_ref),` | muerto | `t_initial_rejects_empty_refs` |
| `lib/propnexus/fsm.ak:178` | conjunción de and | `valid_ref(d.stage_ref),` | muerto | `t_initial_rejects_empty_refs`, `t_initial_rejects_ref_longer_than_an_asset_name` |

Los 7 `expect` que desarman o castean no se mutan: los cubre `rechazos-trazas.mjs`.
