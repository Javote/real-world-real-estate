import { Constr, Data } from "@lucid-evolution/lucid";
import type { StageDatum, StageState } from "@plataforma/shared";

// Los índices salen del orden de declaración en contracts/lib/propnexus/fsm.ak: no son libres.
const STAGE_STATE_INDEX: Record<StageState, number> = {
  Pending: 0,
  InProgress: 1,
  Observed: 2,
  Completed: 3
};

const STATE_BY_INDEX = Object.entries(STAGE_STATE_INDEX).reduce<Record<number, StageState>>(
  (acc, [state, index]) => {
    acc[index] = state as StageState;
    return acc;
  },
  {}
);

function boolToData(value: boolean): Constr<Data> {
  return new Constr(value ? 1 : 0, []);
}

function stateToData(state: StageState): Constr<Data> {
  return new Constr(STAGE_STATE_INDEX[state], []);
}

export function stageDatumToData(datum: StageDatum): Constr<Data> {
  return new Constr(0, [
    datum.projectRef,
    datum.stageRef,
    BigInt(datum.sequenceOrder),
    boolToData(datum.validationCritical),
    stateToData(datum.state),
    datum.evidenceRoot,
    BigInt(datum.completedAt)
  ]);
}

export function encodeStageDatum(datum: StageDatum): string {
  return Data.to(stageDatumToData(datum));
}

export function decodeStageDatum(hex: string): StageDatum {
  const data = Data.from(hex) as Constr<Data>;
  const [projectRef, stageRef, sequenceOrder, critical, state, evidenceRoot, completedAt] =
    data.fields;

  const criticalIndex = (critical as Constr<Data>).index;
  const stateIndex = (state as Constr<Data>).index;
  const decoded = STATE_BY_INDEX[stateIndex];

  if (decoded === undefined) {
    throw new Error(`Índice de estado desconocido en el datum: ${stateIndex}`);
  }

  return {
    projectRef: projectRef as string,
    stageRef: stageRef as string,
    sequenceOrder: Number(sequenceOrder as bigint),
    validationCritical: criticalIndex === 1,
    state: decoded,
    evidenceRoot: evidenceRoot as string,
    completedAt: Number(completedAt as bigint)
  };
}

export function encodeAdvanceRedeemer(input: {
  to: StageState;
  completion: { evidenceRoot: string; now: number } | null;
}): string {
  const completion =
    input.completion === null
      ? new Constr(1, [])
      : new Constr(0, [
          new Constr(0, [input.completion.evidenceRoot, BigInt(input.completion.now)])
        ]);

  return Data.to(new Constr(0, [stateToData(input.to), completion]));
}

export function encodeInitRedeemer(): string {
  return Data.to(new Constr(0, []));
}
