import { z } from "zod";

// SPEC-503: una pregunta, un número del 0 al 10 y un comentario opcional. Se mide, no se inventa.

/** Lo que dispara el envío (D-104): la primera liberación de un contrato del investor. */
export const NPS_TRIGGER_EVENTS = ["FIRST_RELEASE"] as const;
export const npsTriggerEventSchema = z.enum(NPS_TRIGGER_EVENTS);
export type NpsTriggerEvent = z.infer<typeof npsTriggerEventSchema>;

/**
 * Por debajo de esta cantidad de respuestas el NPS se reporta con la advertencia de muestra chica
 * (regla 17): un "1 de 1 encuestados" es ruido, no señal.
 */
export const NPS_MINIMUM_RESPONSES = 30;

/** "No sé" no es un valor: es no responder. */
export const npsScoreSchema = z.number().int().min(0).max(10);

export const respondNpsSurveySchema = z.strictObject({
  score: npsScoreSchema,
  comment: z.string().trim().max(1000).optional()
});
export type RespondNpsSurveyInput = z.infer<typeof respondNpsSurveySchema>;

export const npsSurveyResponseSchema = z.strictObject({ respondedAt: z.coerce.date() });
export type NpsSurveyResponse = z.infer<typeof npsSurveyResponseSchema>;

const cantidad = z.number().int().nonnegative();

/** Lo agregado, que es lo que se reporta: ni los comentarios ni quién respondió qué. */
export const npsSummarySchema = z.strictObject({
  promoters: cantidad,
  passives: cantidad,
  detractors: cantidad,
  responseCount: cantidad,
  sentCount: cantidad,
  /** `% promotores − % detractores`, de -100 a 100; `null` sin respuestas, que no es lo mismo que 0. */
  score: z.number().min(-100).max(100).nullable(),
  minimumResponses: cantidad,
  belowMinimum: z.boolean()
});
export type NpsSummary = z.infer<typeof npsSummarySchema>;
