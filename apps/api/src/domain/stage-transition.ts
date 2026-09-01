import { createHash } from "node:crypto";
import {
  buildStageDatum,
  canTransition,
  merkleRoot,
  STAGE_TRANSITION_ERRORS,
  type StageState
} from "@plataforma/shared";
import { createId } from "../db/id";
import type {
  StageState as DbStageState,
  OnChainEventRow,
  OnChainEventType,
  StageRow
} from "../db/types";
import { anchorPort } from "../lib/anchor";
import { db } from "../lib/db";
import { writeAuditLog } from "../utils/audit";

// **El único lugar donde el estado de un stage cambia.**
//
// Vive fuera de las rutas porque tres superficies distintas hacen la misma
// transición con distinta autorización: el developer avanza el stage
// (`PATCH /stages/:id/state`), el certifier certifica
// (`POST /certifier/stages/:id/certify`) y observa
// (`POST /certifier/stages/:id/observe`). Si cada ruta escribiera su propia
// versión, la tabla de transiciones volvería a existir tres veces — que es
// exactamente el problema que D-059 cerró.

/**
 * Registra el evento on-chain **pendiente** de una transición ya declarada.
 *
 * La asimetría es deliberada (D-059): la declaración se registra siempre y la
 * prueba queda `Pending` hasta que exista TXID confirmado. Al revés no puede
 * pasar — nunca hay prueba de algo que no se declaró — y mientras no haya TXID
 * la UI muestra "Pendiente", nunca "Verificado" (regla 17).
 *
 * `eventIndex` es la posición en el hilo on-chain: 0 es el `mint` del thread
 * token, 1..n las transiciones. El índice único `(stageId, eventIndex)` es
 * lo que vuelve idempotente el anclaje (regla 8).
 */
async function recordOnChainEvent(input: {
  projectId: string;
  stageId: string;
  eventType: OnChainEventType;
  fromState: StageState | null;
  toState: StageState;
}) {
  const previo = await db
    .selectFrom("OnChainEvent")
    .select("eventIndex")
    .where("stageId", "=", input.stageId)
    .orderBy("eventIndex", "desc")
    .limit(1)
    .executeTakeFirst();

  const now = new Date();

  return db
    .insertInto("OnChainEvent")
    .values({
      id: createId(),
      projectId: input.projectId,
      stageId: input.stageId,
      eventIndex: previo ? previo.eventIndex + 1 : 0,
      eventType: input.eventType,
      fromState: input.fromState,
      toState: input.toState,
      commitment: null,
      status: "Pending",
      txid: null,
      outputRef: null,
      blockTimestamp: null,
      createdAt: now,
      updatedAt: now
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

/**
 * La fila de `Stage` en la forma que espera el productor del datum.
 *
 * `evidenceRoot` va vacío **siempre**: el Merkle root del bundle no lo calcula
 * nadie todavía (no existe `EvidenceBundle`). Consecuencia visible y
 * documentada en SPEC-013 §Preguntas abiertas: completar un stage
 * `validationCritical` queda **registrado pero no anclado**, porque el
 * validador exige 32 bytes de commitment y acá no hay ninguno.
 */
function toDatumSource(stage: StageRow, evidenceRoot: string) {
  return {
    id: stage.id,
    projectId: stage.projectId,
    sequenceOrder: stage.sequenceOrder,
    validationCritical: Boolean(stage.validationCritical),
    state: stage.state,
    evidenceRoot,
    completedAt: stage.certifiedAt ? new Date(stage.certifiedAt).getTime() : 0
  };
}

/** El hash de dos nodos del árbol. Node acá, WebCrypto el día que verifique el
 * browser: por eso `merkleRoot` recibe la función en vez de importarla. */
const sha256Pair = (a: string, b: string) =>
  createHash("sha256")
    .update(Buffer.from(a + b, "hex"))
    .digest("hex");

/**
 * Arma el bundle que sostiene el cierre de un stage y devuelve su Merkle root
 * (`bundle_commitment_hash` de M1-D2 §2).
 *
 * **Es un acta, no un índice:** se escribe con la evidencia que existía en este
 * momento y no se toca más. Si después se sube más evidencia, es otro bundle —
 * el root ya anclado tiene que seguir verificando.
 */
async function crearBundle(stage: StageRow, actorUserId: string): Promise<string | null> {
  const evidencias = await db
    .selectFrom("Evidence")
    .select(["id", "sha256Hash"])
    .where("stageId", "=", stage.id)
    .orderBy("uploadedAt", "asc")
    .execute();

  if (evidencias.length === 0) return null;

  const root = merkleRoot(
    evidencias.map((e) => e.sha256Hash),
    sha256Pair
  );

  const bundleId = createId();
  await db
    .insertInto("EvidenceBundle")
    .values({
      id: bundleId,
      projectId: stage.projectId,
      stageId: stage.id,
      commitmentHash: root,
      createdById: actorUserId,
      createdAt: new Date()
    })
    .execute();

  await db
    .insertInto("EvidenceBundleItem")
    .values(
      evidencias.map((e) => ({
        bundleId,
        evidenceId: e.id,
        sha256Hash: e.sha256Hash
      }))
    )
    .execute();

  return root;
}

/** El root del último bundle del stage, o vacío si todavía no tiene. */
async function rootDelStage(stageId: string): Promise<string> {
  const bundle = await db
    .selectFrom("EvidenceBundle")
    .select("commitmentHash")
    .where("stageId", "=", stageId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .executeTakeFirst();

  return bundle?.commitmentHash ?? "";
}

/** La cabeza del hilo: el UTxO vivo del thread token de este stage. */
async function cabezaDelHilo(stageId: string): Promise<string | null> {
  const ultimo = await db
    .selectFrom("OnChainEvent")
    .selectAll()
    .where("stageId", "=", stageId)
    .where("outputRef", "is not", null)
    .orderBy("eventIndex", "desc")
    .limit(1)
    .executeTakeFirst();

  return ultimo?.outputRef ?? null;
}

/**
 * Ancla un evento ya registrado y le escribe el resultado.
 *
 * **El registro nunca depende del anclaje** (D-059, SPEC-013 §Invariante 2): si
 * el puerto rechaza o se cae, la declaración ya está escrita y el evento queda
 * `Failed`. La respuesta sigue siendo 200 — lo que el usuario declaró, ocurrió;
 * lo que falta es la prueba, y la UI la muestra como tal (regla 17).
 */
async function anchorEvent(
  event: OnChainEventRow,
  stage: StageRow,
  previous: StageRow | null
): Promise<OnChainEventRow> {
  // Idempotencia (regla 8): un evento ya anclado no se vuelve a anclar.
  if (event.txid) return event;

  try {
    // El root que va al datum sale del bundle del stage. Antes de que existiera
    // `EvidenceBundle` esto era siempre vacío, y por eso un stage crítico se
    // completaba en el registro pero el validador rechazaba su anclaje.
    const root = await rootDelStage(stage.id);
    const receipt =
      previous === null
        ? await anchorPort().openThread({ datum: buildStageDatum(toDatumSource(stage, "")) })
        : await anchorPort().advanceThread({
            outputRef: (await cabezaDelHilo(stage.id)) ?? "",
            // El datum previo se reconstruye con el root que ya tenía: si el
            // bundle se creó recién, el UTxO viejo NO lo lleva.
            previous: buildStageDatum(
              toDatumSource(previous, previous.state === "Completed" ? root : "")
            ),
            next: buildStageDatum(toDatumSource(stage, stage.state === "Completed" ? root : ""))
          });

    const proof = receipt.status === "Confirmed" ? await anchorPort().verify(receipt.txid) : null;

    return await db
      .updateTable("OnChainEvent")
      .set({
        txid: receipt.txid,
        // La red viaja con el TXID, siempre en el mismo `set` (D-080): el CHECK
        // de la tabla rechaza el par incompleto.
        network: anchorPort().network,
        outputRef: receipt.outputRef,
        status: receipt.status,
        // Qué commitment quedó anclado en ESTE evento. Vacío mientras el stage
        // no se completa: hasta entonces el datum no lleva root.
        commitment: stage.state === "Completed" ? root : null,
        blockTimestamp: proof ? new Date(proof.blockTimestamp) : null,
        updatedAt: new Date()
      })
      .where("id", "=", event.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  } catch (error) {
    // El detalle va al log del servidor, no al cliente (errorHandler §regla 2).
    console.error("[anchor] el anclaje falló", { eventId: event.id, error });

    return await db
      .updateTable("OnChainEvent")
      .set({ status: "Failed", updatedAt: new Date() })
      .where("id", "=", event.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}

/** ¿Este stage ya tiene hilo en la cadena? Si lo tiene, su identidad on-chain
 * (orden y criticidad) es inmutable: el validador la rechaza reescrita. */
async function tieneHiloAnclado(stageId: string): Promise<boolean> {
  const anclado = await db
    .selectFrom("OnChainEvent")
    .select("id")
    .where("stageId", "=", stageId)
    .where("txid", "is not", null)
    .limit(1)
    .executeTakeFirst();

  return anclado !== undefined;
}

/** Lo que puede salir mal, con el código que la ruta traduce a HTTP. */
export type TransitionFailure =
  | { ok: false; status: 404; code: "STAGE_NOT_FOUND" }
  | { ok: false; status: 409; code: "STAGE_TRANSITION_INVALID"; from: StageState; to: StageState }
  | { ok: false; status: 409; code: "STAGE_EVIDENCE_REQUIRED" }
  | { ok: false; status: 409; code: "STAGE_EVIDENCE_UNATTRIBUTED" };

export type TransitionResult =
  | { ok: true; stage: StageRow; anchor: OnChainEventRow }
  | TransitionFailure;

/**
 * Aplica una transición de estado con todo lo que implica: valida contra la
 * tabla (D-020), exige evidencia donde corresponde, escribe el registro, congela
 * el bundle al completar, registra el evento on-chain y lo ancla.
 *
 * **El registro nunca depende del anclaje** (D-059): si el puerto falla, la
 * declaración ya está escrita y el evento queda `Failed`.
 */
export async function transitionStage(input: {
  stageId: string;
  to: DbStageState;
  actorUserId: string;
  /** Nota del certifier al observar. Va al audit log, no al datum. */
  note?: string;
  auditAction?: string;
}): Promise<TransitionResult> {
  const existing = await db
    .selectFrom("Stage")
    .selectAll()
    .where("id", "=", input.stageId)
    .executeTakeFirst();

  if (!existing) return { ok: false, status: 404, code: "STAGE_NOT_FOUND" };

  if (!canTransition(existing.state, input.to)) {
    return {
      ok: false,
      status: 409,
      code: STAGE_TRANSITION_ERRORS.invalid,
      from: existing.state,
      to: input.to
    };
  }

  if (input.to === "Completed" && existing.validationCritical) {
    // Una sola consulta para los dos chequeos. `authoritative` llega como
    // boolean porque el plugin coerciona el RESULTADO; en un `where` no lo
    // haría —solo transforma resultados—, así que el filtro vive acá.
    const evidencias = await db
      .selectFrom("Evidence")
      .select(["id", "authoritative", "issuingAuthority"])
      .where("stageId", "=", existing.id)
      .execute();

    if (evidencias.length === 0) {
      return { ok: false, status: 409, code: STAGE_TRANSITION_ERRORS.evidenceRequired };
    }

    // D-028 (a): el rechazo ocurre en la transición, no en el upload. Subir una
    // evidencia autoritativa sin atribución siempre se puede; avanzar el stage
    // con ella adentro, no.
    //
    // D-086 eliminó la otra mitad: que un revisor haya atestiguado ya NO es
    // condición. La app no revisa ni certifica; respalda evidencia verificada
    // afuera.
    if (evidencias.some((e) => e.authoritative && !e.issuingAuthority?.trim())) {
      return { ok: false, status: 409, code: STAGE_TRANSITION_ERRORS.evidenceUnattributed };
    }
  }

  const data: {
    state: DbStageState;
    updatedAt: Date;
    certifiedAt?: Date;
    certifiedById?: string;
  } = { state: input.to, updatedAt: new Date() };

  if (input.to === "Completed") {
    data.certifiedAt = new Date();
    data.certifiedById = input.actorUserId;
  }

  const stage = await db
    .updateTable("Stage")
    .set(data)
    .where("id", "=", input.stageId)
    .returningAll()
    .executeTakeFirstOrThrow();

  if (input.to === "Completed") {
    await crearBundle(stage, input.actorUserId);
  }

  const evento = await recordOnChainEvent({
    projectId: stage.projectId,
    stageId: stage.id,
    eventType: "STAGE_TRANSITION",
    fromState: existing.state,
    toState: input.to
  });

  const anchor = await anchorEvent(evento, stage, existing);

  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: input.auditAction ?? "CHANGE_STAGE_STATE",
    entityType: "Stage",
    entityId: stage.id,
    metadata: { from: existing.state, to: input.to, ...(input.note ? { note: input.note } : {}) }
  });

  return { ok: true, stage, anchor };
}

export { anchorEvent, crearBundle, recordOnChainEvent, rootDelStage, tieneHiloAnclado };
