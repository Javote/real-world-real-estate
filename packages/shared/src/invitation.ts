import { z } from "zod";

// La invitación del developer al investor (M2-D5 fila 39) — el primer paso
// de la secuencia unidad → invitación → contrato → liberación.

/** Body de `POST /developer/projects/:id/invitations`. */
export const createInvitationSchema = z.strictObject({
  unitId: z.string().min(1),
  investorEmail: z.email(),
  amountMinorUnits: z.number().int().positive(),
  currency: z.string().length(3)
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

/** Espeja los tres literales que escribe `investor.routes.ts`/`developer-comercial.routes.ts`. */
export const INVITATION_STATUSES = ["pending", "accepted", "declined"] as const;
export const invitationStatusSchema = z.enum(INVITATION_STATUSES);
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

/**
 * La fila de `Invitation` completa (`POST /developer/projects/:id/invitations`).
 *
 * **`respondedAt` no está en `TIMESTAMP_COLUMNS` del plugin de coerción**
 * (`sqlite-type-plugin.ts` lo documenta: falta a propósito junto con
 * `compiledAt`/`readAt`/`releasedAt`/`signedAt`, porque ya tienen datos y
 * consumidores del lado del front que esperan un `number`). Acá siempre llega
 * `null` — la invitación recién se crea — pero el tipo es el real, no el que
 * "debería" ser si se coercionara.
 */
export const invitationSchema = z.strictObject({
  id: z.string(),
  projectId: z.string(),
  unitId: z.string(),
  investorEmail: z.email(),
  amountMinorUnits: z.number().int().positive(),
  currency: z.string(),
  status: invitationStatusSchema,
  createdById: z.string().nullable(),
  createdAt: z.coerce.date(),
  respondedAt: z.number().nullable()
});
export type InvitationResponse = z.infer<typeof invitationSchema>;

/** Fila 63 — `GET /investor/invitations/:id`: la invitación que le llegó al investor. */
export const investorInvitationDetailSchema = z.strictObject({
  id: z.string(),
  investorEmail: z.email(),
  amountMinorUnits: z.number().int().positive(),
  currency: z.string(),
  status: invitationStatusSchema,
  createdAt: z.coerce.date(),
  unitReference: z.string(),
  projectName: z.string()
});
export type InvestorInvitationDetail = z.infer<typeof investorInvitationDetailSchema>;
