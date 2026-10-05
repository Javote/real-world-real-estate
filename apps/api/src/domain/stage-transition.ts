import { createHash } from "node:crypto";
import type { AnchorReceipt } from "@plataforma/cardano";
import {
  type AuditAction,
  buildStageDatum,
  canTransition,
  evidenciaSinAtribuir,
  merkleRoot,
  refToHex,
  STAGE_TRANSITION_ERRORS,
  type StageState
} from "@plataforma/shared";
import { createId } from "../db/id.js";
import type {
  Database,
  StageState as DbStageState,
  OnChainEventRow,
  OnChainEventType,
  StageRow
} from "../db/types.js";
import { Sentry } from "../instrumentation.js";
import { anchorPort } from "../lib/anchor.js";
import { db } from "../lib/db.js";
import type { ExpressionBuilder } from "../lib/kysely.js";
import { writeAuditLog } from "../utils/audit.js";

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

const sha256Pair = (a: string, b: string) =>
  createHash("sha256")
    .update(Buffer.from(a + b, "hex"))
    .digest("hex");

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

export function ultimoBundlePorStage(eb: ExpressionBuilder<Database, keyof Database>) {
  return eb
    .selectFrom("EvidenceBundle as ultimo")
    .selectAll("ultimo")
    .where(({ exists, selectFrom, not }) =>
      not(
        exists(
          selectFrom("EvidenceBundle as masNuevo")
            .select("masNuevo.id")
            .whereRef("masNuevo.stageId", "=", "ultimo.stageId")
            .whereRef("masNuevo.createdAt", ">", "ultimo.createdAt")
        )
      )
    )
    .as("EvidenceBundle");
}

export async function cabezaDelHilo(stageId: string): Promise<string | null> {
  const ultimo = await db
    .selectFrom("OnChainEvent")
    .selectAll()
    .where("stageId", "=", stageId)
    // El índice es compartido con los anclajes por metadata: el hilo son solo los eventos con outputRef.
    .where("outputRef", "is not", null)
    .orderBy("eventIndex", "desc")
    .limit(1)
    .executeTakeFirst();

  return ultimo?.outputRef ?? null;
}

async function anchorEvent(
  event: OnChainEventRow,
  stage: StageRow,
  previous: StageRow | null
): Promise<OnChainEventRow> {
  /* v8 ignore if -- @preserve: los tres llamadores le pasan un evento recién insertado, sin txid */
  if (event.txid) return event;

  const root = await rootDelStage(stage.id);
  const commitment = stage.state === "Completed" && root !== "" ? root : null;

  let receipt: AnchorReceipt;
  try {
    receipt =
      previous === null
        ? await anchorPort().openThread({ datum: buildStageDatum(toDatumSource(stage, "")) })
        : await anchorPort().advanceThread({
            outputRef: (await cabezaDelHilo(stage.id)) ?? "",
            previous: buildStageDatum(
              /* v8 ignore next -- @preserve: `Completed` es terminal: nunca hay una transición CON ESE stage de origen, así que `previous.state` nunca es "Completed" */
              toDatumSource(previous, previous.state === "Completed" ? root : "")
            ),
            next: buildStageDatum(toDatumSource(stage, stage.state === "Completed" ? root : ""))
          });
  } catch (error) {
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

  let evento = await db
    .updateTable("OnChainEvent")
    .set({
      txid: receipt.txid,
      network: anchorPort().network,
      outputRef: receipt.outputRef,
      status: receipt.status,
      commitment,
      updatedAt: new Date()
    })
    .where("id", "=", event.id)
    .returningAll()
    .executeTakeFirstOrThrow();

  try {
    const blockTimestamp = await anchorPort().confirmedAt(receipt.txid);
    if (blockTimestamp !== null) {
      evento = await db
        .updateTable("OnChainEvent")
        .set({
          status: "Confirmed",
          blockTimestamp: new Date(blockTimestamp),
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

export type TransitionFailure =
  | { ok: false; status: 404; code: "STAGE_NOT_FOUND" }
  | { ok: false; status: 409; code: "STAGE_TRANSITION_INVALID"; from: StageState; to: StageState }
  | { ok: false; status: 409; code: "STAGE_EVIDENCE_REQUIRED" }
  | { ok: false; status: 409; code: "STAGE_EVIDENCE_UNATTRIBUTED" };

export type TransitionResult =
  | { ok: true; stage: StageRow; anchor: OnChainEventRow }
  | TransitionFailure;

export async function transitionStage(input: {
  stageId: string;
  to: DbStageState;
  actorUserId: string;
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
    const evidencias = await db
      .selectFrom("Evidence")
      .select(["id", "authoritative", "issuingAuthority"])
      .where("stageId", "=", existing.id)
      .execute();

    if (evidencias.length === 0) {
      return { ok: false, status: 409, code: STAGE_TRANSITION_ERRORS.evidenceRequired };
    }

    if (evidencias.some(evidenciaSinAtribuir)) {
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
    // Compare-and-set: si otra transición ganó en el medio, esta no escribe.
    .where("state", "=", existing.state)
    .returningAll()
    .executeTakeFirst();

  if (!stage) {
    return {
      ok: false,
      status: 409,
      code: STAGE_TRANSITION_ERRORS.invalid,
      from: existing.state,
      to: input.to
    };
  }

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
    metadata: {
      from: existing.state,
      to: input.to,
      txid: anchor.txid,
      ...(input.note ? { note: input.note } : {})
    }
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
