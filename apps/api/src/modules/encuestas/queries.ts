import type { NpsTriggerEvent } from "@plataforma/shared";
import type { Ejecutor } from "../../platform/audit.js";

export const encuestaPorToken = (e: Ejecutor, token: string) =>
  e
    .selectFrom("NpsSurvey")
    .select(["id", "investorId", "respondedAt"])
    .where("token", "=", token)
    .executeTakeFirst();

/** El reclamo de la respuesta, sin ejecutar: una encuesta se responde una sola vez. */
export const reclamarRespuesta = (
  e: Ejecutor,
  respuesta: { token: string; score: number; comment: string | null; respondedAt: Date }
) =>
  e
    .updateTable("NpsSurvey")
    .set({
      score: respuesta.score,
      comment: respuesta.comment,
      respondedAt: respuesta.respondedAt
    })
    .where("token", "=", respuesta.token)
    .where("respondedAt", "is", null)
    .returning("respondedAt");

/**
 * La encuesta, sin ejecutar, solo si ese investor todavía no tiene una por ese evento en ese proyecto
 * (índice único): la segunda liberación no vuelve a preguntar.
 */
export const crearSiNoHay = (
  e: Ejecutor,
  fila: {
    id: string;
    investorId: string;
    projectId: string;
    triggerEventType: NpsTriggerEvent;
    token: string;
    sentAt: Date;
  }
) =>
  e
    .insertInto("NpsSurvey")
    .values({ ...fila, score: null, comment: null, respondedAt: null })
    .onConflict((oc) => oc.columns(["investorId", "projectId", "triggerEventType"]).doNothing());

/** Los puntajes respondidos y cuántas se mandaron, en los proyectos dados o en todos. */
export async function puntajes(e: Ejecutor, projectIds: readonly string[] | undefined) {
  let consulta = e.selectFrom("NpsSurvey").select(["score", "respondedAt"]);
  if (projectIds) consulta = consulta.where("projectId", "in", projectIds);
  const filas = await consulta.execute();
  return {
    enviadas: filas.length,
    scores: filas.flatMap((f) => (f.respondedAt !== null && f.score !== null ? [f.score] : []))
  };
}
