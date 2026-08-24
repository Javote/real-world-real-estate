import { z } from "zod";
import { type StageState, stageStateSchema } from "./stage";

// El productor del datum: cómo una fila de `Stage` se convierte en el
// `StageDatum` que el validador Aiken espera (D-058).
//
// Vive acá y no en `apps/api` porque es **el contrato con la cadena**, igual
// que los schemas Zod son el contrato con el front: el día que exista el
// `AnchorPort` (D-014), quien arme la transacción tiene que producir
// exactamente estos bytes, y quien verifique desde afuera tiene que poder
// reproducirlos. Si el mapeo vive dentro de una ruta, no lo puede reproducir
// nadie.
//
// Acá no se arma ninguna transacción ni se habla con la cadena: son funciones
// puras sobre datos, y por eso se prueban sin red.

/**
 * Tope de una ref opaca, en bytes. **No es estético:** `stageRef` es el asset
 * name del thread token y Cardano no acepta más de 32 (D-058).
 */
export const MAX_REF_BYTES = 32;

/** Largo en hex de un SHA-256 / Merkle root: 32 bytes. */
export const COMMITMENT_HEX_LENGTH = 64;

/**
 * Una ref es el id off-chain **tal cual, en bytes** — hoy cuid2 (24
 * caracteres). Se descartó `sha256(id)`: no gana privacidad (un cuid2 no dice
 * nada de nadie, no es PII) y encarece la verificación independiente, porque el
 * verificador necesitaría saber que va hasheado además de conocer el id.
 *
 * ASCII imprimible y sin espacios, de 1 a 32 caracteres: entra cuid2 hoy y
 * entraría un UUID con guiones si el backend migra (M1-D2 y la regla 1 piden
 * UUID). Lo que NO se puede es cambiar de criterio con hilos ya acuñados: el
 * asset name es el id, y un NFT no se reacuña.
 */
export const refSchema = z
  .string()
  .regex(/^[\x21-\x7e]+$/, "una ref solo puede ser ASCII imprimible sin espacios")
  .max(MAX_REF_BYTES);

/** Hex de 64 caracteres, o vacío mientras no haya evidencia anclada. */
export const commitmentSchema = z.union([
  z.literal(""),
  z.string().regex(/^[0-9a-f]{64}$/, "un commitment es SHA-256 en hex minúscula")
]);

/** Espeja `StageDatum` de `contracts/lib/propnexus/fsm.ak`, campo por campo. */
export const stageDatumSchema = z.strictObject({
  /** hex de los bytes del id del proyecto */
  projectRef: z.string().regex(/^([0-9a-f]{2})+$/),
  /** hex de los bytes del id del stage; es también el asset name del thread token */
  stageRef: z.string().regex(/^([0-9a-f]{2})+$/),
  sequenceOrder: z.number().int().positive(),
  validationCritical: z.boolean(),
  state: stageStateSchema,
  evidenceRoot: commitmentSchema,
  /** POSIX ms. 0 mientras el stage no esté `Completed`. */
  completedAt: z.number().int().nonnegative()
});

export type StageDatum = z.infer<typeof stageDatumSchema>;

/**
 * Los bytes ASCII de un id, en hex. Sin `Buffer` ni `TextEncoder`: este package
 * lo compilan la API y el browser con `lib: ["ES2022"]` pelado (ver `auth.ts`).
 */
export function refToHex(id: string): string {
  const ref = refSchema.parse(id);
  let hex = "";
  for (let i = 0; i < ref.length; i += 1) {
    hex += ref.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return hex;
}

/** La vuelta, para verificar: de hex al id legible. */
export function hexToRef(hex: string): string {
  let ref = "";
  for (let i = 0; i < hex.length; i += 2) {
    ref += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16));
  }
  return ref;
}

/** La fila de `Stage` que hace falta para producir el datum. */
export interface StageDatumSource {
  id: string;
  projectId: string;
  sequenceOrder: number;
  validationCritical: boolean;
  state: StageState;
  /** Merkle root del bundle de evidencia, en hex. Vacío hasta `Completed`. */
  evidenceRoot?: string | null;
  /** POSIX ms, o null mientras no esté `Completed`. */
  completedAt?: number | null;
}

/**
 * Produce el datum. Lanza si la fila no puede representarse — que es lo que se
 * quiere: un datum inválido no se descubre al firmar la transacción, se
 * descubre acá.
 */
export function buildStageDatum(source: StageDatumSource): StageDatum {
  return stageDatumSchema.parse({
    projectRef: refToHex(source.projectId),
    stageRef: refToHex(source.id),
    sequenceOrder: source.sequenceOrder,
    validationCritical: source.validationCritical,
    state: source.state,
    evidenceRoot: source.evidenceRoot ?? "",
    completedAt: source.completedAt ?? 0
  });
}

/**
 * Espeja `valid_initial_datum` del validador: lo que el handler `mint` exige
 * para acuñar el hilo. Que la API lo compruebe antes de anclar convierte un
 * rechazo on-chain —que cuesta fee— en un rechazo local.
 */
export function isValidInitialDatum(datum: StageDatum): boolean {
  return (
    datum.state === "Pending" &&
    datum.evidenceRoot === "" &&
    datum.completedAt === 0 &&
    datum.sequenceOrder > 0 &&
    datum.projectRef.length > 0 &&
    datum.stageRef.length > 0
  );
}

/**
 * Espeja la regla del whitepaper §Signature and Certification Rules que el
 * validador aplica al completar: un stage `validation_critical` no llega a
 * `Completed` sin un commitment de evidencia de 32 bytes.
 */
export function canCompleteWithEvidence(
  validationCritical: boolean,
  evidenceRoot: string
): boolean {
  return !validationCritical || evidenceRoot.length === COMMITMENT_HEX_LENGTH;
}
