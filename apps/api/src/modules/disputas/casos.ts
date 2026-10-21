import {
  type Dispute,
  type DisputeOutcome,
  type DisputeStatus,
  err,
  ok,
  type Result
} from "@plataforma/shared";
import { createId } from "../../db/id.js";
import { enLote } from "../../lib/db.js";
import { audit, auditSiGano } from "../../platform/audit.js";
import type { Contexto } from "../../platform/contexto.js";
import * as q from "./queries.js";

type Deps = Pick<Contexto, "db" | "clock">;

function aDisputa(fila: q.FilaDeDisputa): Dispute {
  return { ...fila, resolvedAt: fila.resolvedAt === null ? null : new Date(fila.resolvedAt) };
}

// `reason` y `resolution` no van al audit: son texto libre, y el audit dice quién hizo qué (regla 2).
export async function abrir(
  deps: Deps,
  input: { stageId: string; reason: string; actorId: string }
): Promise<Dispute> {
  const { projectId } = await q.proyectoDelStage(deps.db, input.stageId);
  const id = createId();
  const [[fila]] = await enLote(
    q.insertar(deps.db, {
      id,
      stageId: input.stageId,
      projectId,
      openedById: input.actorId,
      reason: input.reason,
      createdAt: deps.clock()
    }),
    audit(deps.db, {
      actorUserId: input.actorId,
      action: "OPEN_DISPUTE",
      entityType: "Dispute",
      entityId: id,
      metadata: { stageId: input.stageId }
    })
  );
  return aDisputa(fila!);
}

export async function listar(
  deps: Deps,
  filtro: { projectId: string; status: DisputeStatus | undefined }
): Promise<Dispute[]> {
  return (await q.delProyecto(deps.db, filtro.projectId, filtro.status)).map(aDisputa);
}

export async function resolver(
  deps: Deps,
  input: { id: string; outcome: DisputeOutcome; resolution: string; actorId: string }
): Promise<Result<Dispute, "NOT_FOUND" | "DISPUTE_ALREADY_RESOLVED" | "REFUND_WITHOUT_RELEASE">> {
  const disputa = await q.disputaPorId(deps.db, input.id);
  if (!disputa) return err("NOT_FOUND");
  if (disputa.status === "Resolved") return err("DISPUTE_ALREADY_RESOLVED");
  // No se declara el reembolso de algo que nunca se liberó.
  if (input.outcome === "RefundAgreed" && !(await q.huboLiberacion(deps.db, disputa.stageId))) {
    return err("REFUND_WITHOUT_RELEASE");
  }

  // Un lote: el reclamo y su audit, que entra solo si el reclamo ganó.
  const [[reclamada]] = await enLote(
    q.reclamarResolucion(deps.db, {
      id: disputa.id,
      outcome: input.outcome,
      resolution: input.resolution,
      resolvedById: input.actorId,
      resolvedAt: deps.clock()
    }),
    auditSiGano(deps.db, {
      actorUserId: input.actorId,
      action: "RESOLVE_DISPUTE",
      entityType: "Dispute",
      entityId: disputa.id,
      metadata: { outcome: input.outcome }
    })
  );
  // Otra resolución ganó entre la lectura y el reclamo.
  if (!reclamada) return err("DISPUTE_ALREADY_RESOLVED");
  return ok(aDisputa(reclamada));
}

/**
 * `disputeRate` (SPEC-502): disputas abiertas sobre liberaciones, decidido por el dueño el 2026-10-21.
 * Cuenta toda disputa, también la desestimada: el criterio mide cuánto se reclama. Sin liberaciones
 * no hay tasa (`null`), y puede pasar de 1 si se disputa más de lo que se liberó.
 */
export async function tasaDeDisputas(
  deps: Pick<Contexto, "db">,
  projectIds: readonly string[] | undefined
): Promise<{ disputes: number; releases: number; rate: number | null }> {
  const [disputes, releases] = await Promise.all([
    q.cantidadDeDisputas(deps.db, projectIds),
    q.cantidadDeLiberaciones(deps.db, projectIds)
  ]);
  return { disputes, releases, rate: releases === 0 ? null : disputes / releases };
}
