import { type CertifierInvitation, certifierInvitationSchema } from "@plataforma/shared";
import { db } from "../lib/db";

// SPEC-221 · la invitación a certificar un proyecto (D-095).
//
// La leen dos superficies —el admin, por proyecto; el certifier, las suyas— y
// las dos necesitan la misma forma: con el nombre del proyecto y del certifier,
// que la tabla guarda como ids. Una sola consulta para que no diverjan.

type Filtro =
  | { projectId: string }
  | { certifierId: string; soloPendientes: true }
  | { id: string };

export async function listarInvitacionesACertificar(
  filtro: Filtro
): Promise<CertifierInvitation[]> {
  let query = db
    .selectFrom("CertifierInvitation")
    .innerJoin("Project", "Project.id", "CertifierInvitation.projectId")
    .innerJoin("User", "User.id", "CertifierInvitation.certifierId")
    .select([
      "CertifierInvitation.id as id",
      "CertifierInvitation.projectId as projectId",
      "Project.name as projectName",
      "CertifierInvitation.certifierId as certifierId",
      "User.fullName as certifierName",
      "CertifierInvitation.status as status",
      "CertifierInvitation.createdAt as createdAt",
      "CertifierInvitation.respondedAt as respondedAt"
    ])
    .orderBy("CertifierInvitation.createdAt", "desc");

  if ("id" in filtro) query = query.where("CertifierInvitation.id", "=", filtro.id);
  else if ("projectId" in filtro)
    query = query.where("CertifierInvitation.projectId", "=", filtro.projectId);
  else
    query = query
      .where("CertifierInvitation.certifierId", "=", filtro.certifierId)
      .where("CertifierInvitation.status", "=", "pending");

  const filas = await query.execute();
  return filas.map((fila) => certifierInvitationSchema.parse(fila));
}
