import { createHash } from "node:crypto";
import type { AnchorReceipt } from "@plataforma/cardano";
import {
  type AuditAction,
  buildStageDatum,
  canTransition,
  merkleRoot,
  refToHex,
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
import { Sentry } from "../instrumentation";
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
 * **`eventIndex` es la posición en el log de eventos del stage, NO en su hilo
 * on-chain.** El comentario decía lo segundo y era falso: los anclajes por
 * metadata (`EVIDENCE_ANCHOR`, D-006) también consumen índice desde
 * `anchorCommitmentEvent`, y esos nunca tocan el validador. En producción, el
 * stage "Terminaciones" de `torre-a` tiene `0` mint · `1` transición · `2,3,4`
 * evidencia · `5` transición: **el hilo es una subsecuencia del índice**, no el
 * índice.
 *
 * **No hay bug, y conviene saber por qué**: `cabezaDelHilo` no ordena por
 * `eventIndex` a secas — filtra `outputRef is not null` primero, y un anclaje
 * por metadata siempre lo tiene en `null` porque no hay UTxO de por medio. Si
 * alguien alguna vez "simplifica" ese filtro confiando en este índice,
 * `advanceThread` va a intentar gastar el UTxO equivocado. Hay un test que lo
 * fija (`stage-transitions.test.ts` → "un EVIDENCE_ANCHOR con índice mayor no
 * corre la cabeza del hilo").
 *
 * El índice único `(stageId, eventIndex)` es lo que vuelve idempotente el
 * anclaje (regla 8), y eso funciona igual sea cual sea el tipo de evento.
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
 *
 * **Y es idempotente por contenido** (regla 8): si el acta vigente del stage ya
 * dice exactamente este root, se devuelve esa en vez de escribir otra igual.
 * Un acta del mismo conjunto **es** la misma acta — el comentario de arriba lo
 * afirmaba y el código hacía lo contrario.
 *
 * No es teórico: completar un stage llamaba a `crearBundle` dos veces —una en
 * `POST /developer/projects/:id/stages/:stageId/evidence` y otra acá, desde
 * `transitionStage`— y la segunda insertaba una fila gemela. En producción, el
 * stage "Terminaciones" de `torre-a` quedó con 3 evidencias, **4 bundles y 3
 * roots distintos**. Inocuo en valor (el root repetido es el mismo) pero el
 * `leftJoin EvidenceBundle` del listado del certifier duplica filas por eso.
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

  // Se compara contra el acta **vigente** (la última), no contra cualquiera
  // del historial: lo que se pregunta es "¿el acta de este stage ya dice
  // esto?", que es la misma fila que después lee `rootDelStage` para armar el
  // datum. Un root que ya existió y dejó de ser el vigente sí merece acta
  // nueva — es un conjunto de evidencia distinto del actual.
  if ((await rootDelStage(stage.id)) === root) return root;

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
export async function cabezaDelHilo(stageId: string): Promise<string | null> {
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
 *
 * **El recibo se guarda apenas existe, no cuando termina de confirmar**
 * (cerrado el 2026-09-10, ver `specs/REPORTE-2026-09-10-prueba-de-volumen.md`
 * §Cómo hacerlo más robusto). Antes había un solo `UPDATE`, después de
 * `verify()`: si el proceso moría entre que `openThread`/`advanceThread`
 * devolvía el `txid` y que ese `UPDATE` corría, la transacción quedaba
 * confirmada en la cadena y la base no se enteraba nunca — el hilo del stage
 * quedaba vivo en un UTxO que nadie sabe cuál es (D-058), indistinguible de un
 * anclaje que nunca se intentó. La prueba de volumen lo produjo de verdad: un
 * reinicio de Render a mitad de esa ventana. Separar la escritura del recibo
 * de la espera de confirmación no evita el reinicio — evita que el reinicio se
 * lleve puesto un TXID que ya es real.
 */
async function anchorEvent(
  event: OnChainEventRow,
  stage: StageRow,
  previous: StageRow | null
): Promise<OnChainEventRow> {
  // Idempotencia (regla 8): un evento ya anclado no se vuelve a anclar.
  if (event.txid) return event;

  // El root que va al datum sale del bundle del stage. Antes de que existiera
  // `EvidenceBundle` esto era siempre vacío, y por eso un stage crítico se
  // completaba en el registro pero el validador rechazaba su anclaje.
  const root = await rootDelStage(stage.id);
  const commitment = stage.state === "Completed" ? root : null;

  let receipt: AnchorReceipt;
  try {
    receipt =
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
  } catch (error) {
    // Acá el error es real: nunca hubo receipt, la transacción no salió a la
    // cadena (rechazo del validador, UTxO inexistente, wallet sin fondos). El
    // detalle va al log del servidor y a Sentry, no al cliente (errorHandler
    // §regla 2) — antes solo quedaba en `console.error`, invisible salvo que
    // alguien fuera a buscarlo en los logs de Render (retención corta) en el
    // momento exacto.
    console.error("[anchor] el anclaje falló", { eventId: event.id, error });
    Sentry.captureException(error, {
      tags: { area: "anchor" },
      extra: { eventId: event.id, stageId: stage.id }
    });

    return await db
      .updateTable("OnChainEvent")
      .set({ status: "Failed", updatedAt: new Date() })
      .where("id", "=", event.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  // El recibo existe: la transacción salió a la cadena, con TXID real. Se
  // guarda YA, antes de esperar la confirmación — es la escritura crítica, la
  // que D-058 no puede permitirse perder.
  let evento = await db
    .updateTable("OnChainEvent")
    .set({
      txid: receipt.txid,
      // La red viaja con el TXID, siempre en el mismo `set` (D-080): el CHECK
      // de la tabla rechaza el par incompleto.
      network: anchorPort().network,
      outputRef: receipt.outputRef,
      status: receipt.status,
      commitment,
      updatedAt: new Date()
    })
    .where("id", "=", event.id)
    .returningAll()
    .executeTakeFirstOrThrow();

  // Confirmar es best-effort, a propósito: si esto falla o el proceso muere
  // acá, el evento queda `Pending` con TXID real — nunca `Failed`, porque el
  // anclaje ya ocurrió. D-077 (reconciliación en lectura) lo termina de
  // resolver la próxima vez que alguien mire este stage.
  //
  // El receipt llega `Pending` siempre, con los dos adaptadores (D-087): no
  // se le pregunta si dice "Confirmed" — se verifica, sin excepción. Contra
  // el simulador esto encuentra el proof al toque (su ledger queda listo
  // desde el `commit`); contra Preprod, todavía no hay nada que ver.
  try {
    const proof = await anchorPort().verify(receipt.txid);
    if (proof) {
      evento = await db
        .updateTable("OnChainEvent")
        .set({
          status: "Confirmed",
          blockTimestamp: new Date(proof.blockTimestamp),
          updatedAt: new Date()
        })
        .where("id", "=", event.id)
        .returningAll()
        .executeTakeFirstOrThrow();
    }
  } catch (error) {
    console.error("[anchor] la confirmación falló — el anclaje ya está guardado", {
      eventId: event.id,
      error
    });
  }

  return evento;
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
  auditAction?: AuditAction;
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

export type RetryMintFailure =
  | { ok: false; status: 404; code: "STAGE_NOT_FOUND" | "STAGE_CREATED_EVENT_NOT_FOUND" }
  | {
      ok: false;
      status: 409;
      code: "STAGE_ALREADY_ADVANCED" | "THREAD_ALREADY_OPEN" | "THREAD_ALREADY_ON_CHAIN";
    };

export type RetryMintResult =
  | { ok: true; stage: StageRow; anchor: OnChainEventRow }
  | RetryMintFailure;

/**
 * Reintenta el mint de un stage cuyo `openThread` original falló —red caída,
 * wallet sin fondos— y quedó sin hilo on-chain. Idempotente por `anchorEvent`
 * (regla 8): si el mint ya tiene TXID, es un no-op.
 *
 * **Solo mientras el stage siga en `Pending`.** Un stage que ya avanzó
 * off-chain sin hilo —el caso de uno sembrado directo en la base, no de un
 * mint que falló— no tiene forma honesta de mintear: el validador exige
 * `valid_initial_datum` (estado `Pending`, sin evidencia, sin fecha), y
 * fabricar ese datum inicial para un stage que ya progresó sería reescribir
 * una secuencia que D-008 dice que ni nosotros podemos falsificar. Para ese
 * caso no hay reintento — queda `Failed`, que es la verdad.
 *
 * **La base no es la única fuente de la decisión de mintear** (SPEC-301). El
 * validador solo garantiza un token por transacción, no uno por stage —
 * `THREAD_ALREADY_OPEN` únicamente sabe lo que `OnChainEvent` sabe, y esa
 * fila puede tener `outputRef` en `null` con el hilo vivo igual (un reinicio
 * a mitad de `anchorEvent`, ver su docstring). Antes de mintear se le
 * pregunta a la cadena — la única que de verdad tiene el token — con
 * `findLiveThread`. Si ya tiene un hilo, **no se mintea**: es
 * `THREAD_ALREADY_ON_CHAIN`, distinto de `THREAD_ALREADY_OPEN` porque el
 * remedio es otro (`POST /evidence/reconcile`, no nada).
 *
 * **Fail-closed:** si `findLiveThread` tira, el error se propaga sin
 * capturar y no se llega a mintear — acuñar de más es irreversible (no hay
 * burn) y no mintear no pierde nada, se reintenta. `mode === "disabled"` se
 * saltea esta consulta (no hay cadena que preguntarle, mismo criterio que
 * `repararHilosSospechosos`) y sigue funcionando como antes de esta spec.
 */
export async function retryStageMint(stageId: string): Promise<RetryMintResult> {
  const stage = await db
    .selectFrom("Stage")
    .selectAll()
    .where("id", "=", stageId)
    .executeTakeFirst();
  if (!stage) return { ok: false, status: 404, code: "STAGE_NOT_FOUND" };

  if (stage.state !== "Pending") {
    return { ok: false, status: 409, code: "STAGE_ALREADY_ADVANCED" };
  }

  if ((await cabezaDelHilo(stage.id)) !== null) {
    return { ok: false, status: 409, code: "THREAD_ALREADY_OPEN" };
  }

  if (anchorPort().mode !== "disabled") {
    const hiloEnCadena = await anchorPort().findLiveThread(refToHex(stage.id));
    if (hiloEnCadena !== null) {
      return { ok: false, status: 409, code: "THREAD_ALREADY_ON_CHAIN" };
    }
  }

  const evento = await db
    .selectFrom("OnChainEvent")
    .selectAll()
    .where("stageId", "=", stage.id)
    .where("eventType", "=", "STAGE_CREATED")
    .orderBy("eventIndex", "asc")
    .limit(1)
    .executeTakeFirst();

  if (!evento) return { ok: false, status: 404, code: "STAGE_CREATED_EVENT_NOT_FOUND" };

  const anchor = await anchorEvent(evento, stage, null);
  return { ok: true, stage, anchor };
}

export { anchorEvent, crearBundle, recordOnChainEvent, rootDelStage };
