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
