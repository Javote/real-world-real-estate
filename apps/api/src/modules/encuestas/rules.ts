import { NPS_MINIMUM_RESPONSES, type NpsSummary } from "@plataforma/shared";

/** La fórmula fija de NPS: 9-10 promueve, 7-8 es pasivo, 0-6 detracta. */
export function categoria(score: number): "promoter" | "passive" | "detractor" {
  if (score >= 9) return "promoter";
  if (score >= 7) return "passive";
  return "detractor";
}

/** `% promotores − % detractores`. Sin respuestas es `null`: 0 sería "tantos promotores como detractores". */
export function resumen(scores: readonly number[], enviadas: number): NpsSummary {
  const cuenta = { promoter: 0, passive: 0, detractor: 0 };
  for (const s of scores) cuenta[categoria(s)]++;
  const n = scores.length;
  return {
    promoters: cuenta.promoter,
    passives: cuenta.passive,
    detractors: cuenta.detractor,
    responseCount: n,
    sentCount: enviadas,
    score: n === 0 ? null : ((cuenta.promoter - cuenta.detractor) / n) * 100,
    minimumResponses: NPS_MINIMUM_RESPONSES,
    belowMinimum: n < NPS_MINIMUM_RESPONSES
  };
}
