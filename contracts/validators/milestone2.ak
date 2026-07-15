use aiken/collection/list
use cardano/address.{Address}
use aiken/crypto.{VerificationKeyHash}
use cardano/transaction.{
  InlineDatum,
  Input,
  Output,
  OutputReference,
  Transaction,
}

pub type MilestoneState {
  Pending
  InProgress
  Observed
  Completed
}

pub type MilestoneDatum {
  project_id: ByteArray,
  project_name: ByteArray,
  milestone_id: Int,
  state: MilestoneState,
}

pub type MilestoneRedeemer {
  UpdateState(MilestoneState)
}

pub fn valid_transition(from: MilestoneState, to: MilestoneState) -> Bool {
  when from is {
    Pending -> to == InProgress
    InProgress -> to == Observed || to == Completed
    Observed -> to == InProgress
    Completed -> False
  }
}

fn find_own_input(
  inputs: List<Input>,
  own_ref: OutputReference,
) -> Input {
  expect Some(input) =
    list.find(inputs, fn(input) { input.output_reference == own_ref })

  input
}

fn count_inputs_at_address(
  inputs: List<Input>,
  address: Address,
) -> Int {
  inputs
    |> list.filter(fn(input) { input.output.address == address })
    |> list.length
}

fn count_outputs_at_address(
  outputs: List<Output>,
  address: Address,
) -> Int {
  outputs
    |> list.filter(fn(output) { output.address == address })
    |> list.length
}

fn find_single_output_at_address(
  outputs: List<Output>,
  address: Address,
) -> Output {
  expect [output] =
    outputs
      |> list.filter(fn(output) { output.address == address })

  output
}

validator milestone(admin: VerificationKeyHash) {
  spend(
    datum: Option<MilestoneDatum>,
    redeemer: MilestoneRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    expect Some(old_datum) = datum

    let own_input = find_own_input(tx.inputs, own_ref)
    let own_address = own_input.output.address

    expect count_inputs_at_address(tx.inputs, own_address) == 1
    expect count_outputs_at_address(tx.outputs, own_address) == 1

    expect list.has(tx.extra_signatories, admin)

    let continuing_output =
      find_single_output_at_address(tx.outputs, own_address)

    expect InlineDatum(raw_new_datum) = continuing_output.datum
    expect new_datum: MilestoneDatum = raw_new_datum

    let UpdateState(requested_state) = redeemer

    expect new_datum.state == requested_state
    expect new_datum.project_id == old_datum.project_id
    expect new_datum.project_name == old_datum.project_name
    expect new_datum.milestone_id == old_datum.milestone_id
    expect valid_transition(old_datum.state, new_datum.state)
    expect continuing_output.value == own_input.output.value

    True
  }
}
