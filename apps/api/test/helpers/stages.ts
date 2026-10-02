import { INITIAL_STAGE_STATE } from "@plataforma/shared";
import { createId } from "../../src/db/id";
import { anchorEvent, recordOnChainEvent } from "../../src/domain/stage-transition";
import { db } from "../../src/lib/db";

export async function crearStageMinteado(input: {
  projectId: string;
  name: string;
  sequenceOrder: number;
  validationCritical?: boolean;
  actorUserId: string;
}) {
  const now = new Date();

  const stage = await db
    .insertInto("Stage")
    .values({
      id: createId(),
      projectId: input.projectId,
      name: input.name,
      sequenceOrder: input.sequenceOrder,
      state: INITIAL_STAGE_STATE,
      validationCritical: input.validationCritical ?? true,
      createdAt: now,
      updatedAt: now
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const evento = await recordOnChainEvent({
    projectId: stage.projectId,
    stageId: stage.id,
    eventType: "STAGE_CREATED",
    fromState: null,
    toState: stage.state
  });
  const anchor = await anchorEvent(evento, stage, null);

  return { ...stage, anchor };
}
