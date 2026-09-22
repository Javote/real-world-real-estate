# Cada `expect` del validador contra el test que aborta en él

Corrida: 2026-09-22T01:24:33.503Z · aiken aiken v1.1.21+42babe5 · 85 tests, 85 en verde

**18 `expect`: 13 con test, 5 sin test.**

| Archivo:línea | `expect` | Tests que abortan ahí |
|---|---|---|
| `validators/stage.ak:69` | `expect Finite(lower) = range.lower_bound.bound_type` | `spend_rejects_open_ended_validity_range` |
| `validators/stage.ak:70` | `expect Finite(upper) = range.upper_bound.bound_type` | **ninguno** |
| `validators/stage.ak:84` | `expect Some(old_datum) = datum` | `spend_rejects_missing_datum` |
| `validators/stage.ak:85` | `expect Some(own_input) = find_input(tx.inputs, own_ref)` | `spend_rejects_unknown_own_ref` |
| `validators/stage.ak:87` | `expect Script(own_policy) = own_address.payment_credential` | **ninguno** |
| `validators/stage.ak:91` | `expect assets.quantity_of( own_input.output.value, own_policy, old_datum.stage_ref, ) == 1` | `spend_rejects_utxo_without_thread_token`, `spend_rejects_thread_token_of_another_stage`, `spend_rejects_utxo_with_two_units_of_own_token` |
| `validators/stage.ak:100` | `expect inputs_at_address(tx.inputs, own_address) == 1` | `spend_rejects_two_script_inputs` |
| `validators/stage.ak:101` | `expect [continuing_output] = at_address(tx.outputs, own_address)` | `spend_rejects_two_script_outputs`, `spend_rejects_no_continuing_output` |
| `validators/stage.ak:104` | `expect [_] = carrying_thread(tx.outputs, own_policy, old_datum.stage_ref)` | `spend_rejects_value_drain`, `spend_rejects_dropping_the_thread_token` |
| `validators/stage.ak:107` | `expect list.has(tx.extra_signatories, admin)` | `spend_rejects_missing_admin_signature`, `mint_rejects_missing_admin_signature` |
| `validators/stage.ak:109` | `expect InlineDatum(raw_new_datum) = continuing_output.datum` | `spend_rejects_non_inline_datum` |
| `validators/stage.ak:110` | `expect new_datum: StageDatum = raw_new_datum` | **ninguno** |
| `validators/stage.ak:125` | `expect continuing_output.value == own_input.output.value` | **ninguno** |
| `validators/stage.ak:144` | `expect list.has(tx.extra_signatories, admin)` | `spend_rejects_missing_admin_signature`, `mint_rejects_missing_admin_signature` |
| `validators/stage.ak:150` | `expect [Pair(asset_name, 1)] = dict.to_pairs(assets.tokens(tx.mint, policy_id))` | `mint_rejects_two_units_of_the_thread`, `mint_rejects_two_threads_in_one_tx`, `mint_rejects_a_burn` |
| `validators/stage.ak:153` | `expect [thread_output] = carrying_thread(tx.outputs, policy_id, asset_name)` | `mint_rejects_token_not_locked_in_the_script` |
| `validators/stage.ak:154` | `expect InlineDatum(raw_datum) = thread_output.datum` | `mint_rejects_non_inline_datum` |
| `validators/stage.ak:155` | `expect initial_datum: StageDatum = raw_datum` | **ninguno** |
