import { Constr, Data } from "@lucid-evolution/lucid";
import type { StageDatum, StageState } from "@plataforma/shared";

// El códec: `StageDatum` de TypeScript ⇄ el `Data` de Plutus que el validador
// decodifica.
//
// **Acá viven los bugs de esta rebanada.** Un campo corrido o un índice de
// constructor equivocado no falla al compilar: falla al gastar, con un mensaje
// que no dice nada, después de firmar y pagar el fee. Por eso el orden de todo
// lo de abajo NO es libre — sale de `contracts/lib/propnexus/fsm.ak`:
//
//   StageState  → Pending=0 · InProgress=1 · Observed=2 · Completed=3
//                 (el orden de declaración del tipo, nada más)
//   StageDatum  → constructor 0, campos EN ORDEN
//   Bool        → False=0 · True=1 (convención de Plutus, no nuestra)
//   Option      → Some=0 · None=1
//
// Y el chequeo real no es este comentario: es `codec.test.ts`, que compara
// contra el mismo hex que `t_golden_datum_encoding` fija del lado de Aiken.

/** Índice de constructor de cada estado. El orden es el del tipo en Aiken. */
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

/** `StageDatum` → `Data`, listo para `Data.to()`. */
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

/** El datum serializado en hex — lo que viaja en el output inline. */
export function encodeStageDatum(datum: StageDatum): string {
  return Data.to(stageDatumToData(datum));
}

/**
 * La vuelta: del datum on-chain al objeto. Es lo que permite **verificar** sin
 * confiar en nuestra base — leer el UTxO y reconstruir qué dice la cadena.
 */
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

/**
 * El redeemer `Advance { to, completion }`. `completion` es `Some` exactamente
 * cuando la transición va a `Completed` — el validador lo exige, así que
 * construirlo mal se rechaza on-chain (`valid_datum_evolution`).
 */
export function encodeAdvanceRedeemer(input: {
  to: StageState;
  completion: { evidenceRoot: string; now: number } | null;
}): string {
  const completion =
    input.completion === null
      ? new Constr(1, []) // None
      : new Constr(0, [
          new Constr(0, [input.completion.evidenceRoot, BigInt(input.completion.now)])
        ]); // Some(Completion { .. })

  return Data.to(new Constr(0, [stateToData(input.to), completion]));
}

/** El redeemer del `mint`: `Init`, único constructor. */
export function encodeInitRedeemer(): string {
  return Data.to(new Constr(0, []));
}
