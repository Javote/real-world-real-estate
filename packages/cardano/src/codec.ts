import { Constr, Data } from "@lucid-evolution/lucid";
import { type StageDatum, type StageState, stageDatumSchema } from "@plataforma/shared";
import { AnchorRejectedError } from "./port";

const STAGE_DATUM_FIELDS = 7;

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
  const data = Data.from(hex);
  if (!(data instanceof Constr) || data.index !== 0) {
    throw new AnchorRejectedError(
      "El datum no es un StageDatum: no es el constructor 0",
      "BAD_DATUM"
    );
  }
  if (data.fields.length !== STAGE_DATUM_FIELDS) {
    throw new AnchorRejectedError(
      `El datum tiene ${data.fields.length} campos y un StageDatum tiene ${STAGE_DATUM_FIELDS}`,
      "BAD_DATUM"
    );
  }
  const [projectRef, stageRef, sequenceOrder, critical, state, evidenceRoot, completedAt] =
    data.fields;

  const leido = stageDatumSchema.safeParse({
    projectRef,
    stageRef,
    sequenceOrder: enteroDeData(sequenceOrder),
    validationCritical: boolDeData(critical),
    state: estadoDeData(state),
    evidenceRoot,
    completedAt: enteroDeData(completedAt)
  });
  if (!leido.success) {
    const campos = leido.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new AnchorRejectedError(
      `El datum no cierra con stageDatumSchema: ${campos}`,
      "BAD_DATUM"
    );
  }
  return leido.data;
}

// Lo que no tiene la forma esperada se devuelve tal cual, para que lo rechace el schema.
function enteroDeData(valor: Data | undefined): unknown {
  return typeof valor === "bigint" ? Number(valor) : valor;
}

function boolDeData(valor: Data | undefined): unknown {
  if (!(valor instanceof Constr) || valor.fields.length !== 0) return valor;
  if (valor.index === 0) return false;
  if (valor.index === 1) return true;
  return valor;
}

function estadoDeData(valor: Data | undefined): unknown {
  if (!(valor instanceof Constr) || valor.fields.length !== 0) return valor;
  const estado = STATE_BY_INDEX[valor.index];
  if (estado === undefined) {
    throw new AnchorRejectedError(
      `Índice de estado desconocido en el datum: ${valor.index}`,
      "BAD_DATUM"
    );
  }
  return estado;
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
