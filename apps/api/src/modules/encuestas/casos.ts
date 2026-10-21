import { randomBytes } from "node:crypto";
import { err, type NpsSummary, type NpsSurveyResponse, ok, type Result } from "@plataforma/shared";
import { createId } from "../../db/id.js";
import { enLote } from "../../lib/db.js";
import { auditSiGano } from "../../platform/audit.js";
import type { Contexto } from "../../platform/contexto.js";
import { notifySiGano } from "../../platform/notify.js";
import * as q from "./queries.js";
import { resumen as resumir } from "./rules.js";

type Deps = Pick<Contexto, "db" | "clock">;

/**
 * El disparo de D-104: la primera liberación de un contrato del investor le manda la encuesta, una
 * sola vez por proyecto. La notificación entra solo si la encuesta es nueva.
 */
export async function enviarPorPrimeraLiberacion(
  deps: Deps,
  destino: { investorId: string; projectId: string; unitId: string }
): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await enLote(
    q.crearSiNoHay(deps.db, {
      id: createId(),
      investorId: destino.investorId,
      projectId: destino.projectId,
      triggerEventType: "FIRST_RELEASE",
      token,
      sentAt: deps.clock()
    }),
    notifySiGano(deps.db, {
      userId: destino.investorId,
      category: "release",
      titleKey: "notifications.survey.nps",
      params: { surveyToken: token },
      unitId: destino.unitId
    })
  );
}

// El audit dice que respondió, no qué: el puntaje y el comentario son la respuesta, no el registro.
export async function responder(
  deps: Deps,
  input: { token: string; score: number; comment: string | undefined }
): Promise<Result<NpsSurveyResponse, "NOT_FOUND" | "SURVEY_ALREADY_ANSWERED">> {
  const encuesta = await q.encuestaPorToken(deps.db, input.token);
  if (!encuesta) return err("NOT_FOUND");
  if (encuesta.respondedAt !== null) return err("SURVEY_ALREADY_ANSWERED");

  const [[reclamada]] = await enLote(
    q.reclamarRespuesta(deps.db, {
      token: input.token,
      score: input.score,
      comment: input.comment || null,
      respondedAt: deps.clock()
    }),
    auditSiGano(deps.db, {
      actorUserId: encuesta.investorId,
      action: "RESPOND_NPS_SURVEY",
      entityType: "NpsSurvey",
      entityId: encuesta.id
    })
  );
  // Otra respuesta con el mismo token ganó entre la lectura y el reclamo.
  if (!reclamada) return err("SURVEY_ALREADY_ANSWERED");
  return ok({ respondedAt: new Date(reclamada.respondedAt!) });
}

export async function resumen(
  deps: Pick<Contexto, "db">,
  projectIds: readonly string[] | undefined
): Promise<NpsSummary> {
  const { scores, enviadas } = await q.puntajes(deps.db, projectIds);
  return resumir(scores, enviadas);
}
