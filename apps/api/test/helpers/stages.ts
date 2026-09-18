import { INITIAL_STAGE_STATE } from "@plataforma/shared";
import { createId } from "../../src/db/id";
import { anchorEvent, recordOnChainEvent } from "../../src/domain/stage-transition";
import { db } from "../../src/lib/db";

// 2026-09-08: reemplaza al `POST /api/v1/projects/:id/stages` que la suite
// usaba para crear una etapa suelta con hilo real — la ruta se borró (era
// anterior al Stage template de 10, ninguna decisión de producto la pedía
// después de eso, y ningún componente del front la llamó nunca). Lo que las
// pruebas necesitaban no era la ruta HTTP: era una etapa con su mint real.
// Esta función hace exactamente lo que hacía el handler, sin pasar por
// Express — mismas dos llamadas de dominio (`recordOnChainEvent` +
// `anchorEvent`), mismo shape de retorno (`{ ...stage, anchor }`) para que
// las aserciones existentes (`.id`, `.anchor.status`, `.anchor.outputRef`)
// seguiran andando igual.
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
