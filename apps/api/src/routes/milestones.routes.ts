import {
  buildStageDatum,
  canTransition,
  INITIAL_STAGE_STATE,
  STAGE_TRANSITION_ERRORS,
  stageTransitionSchema
} from "@plataforma/shared";
import { type Request, Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import type { MilestoneRow, MilestoneState, OnChainEventRow, OnChainEventType } from "../db/types";
import { anchorPort } from "../lib/anchor";
import { db } from "../lib/db";
import {
  ANY_MEMBERSHIP,
  authenticate,
  requireProjectAccess,
  requireRole
} from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";

const router = Router();

router.use(authenticate);

/**
 * Registra el evento on-chain **pendiente** de una transición ya declarada.
 *
 * La asimetría es deliberada (D-059): la declaración se registra siempre y la
 * prueba queda `Pending` hasta que exista TXID confirmado. Al revés no puede
 * pasar — nunca hay prueba de algo que no se declaró — y mientras no haya TXID
 * la UI muestra "Pendiente", nunca "Verificado" (regla 17).
 *
 * `eventIndex` es la posición en el hilo on-chain: 0 es el `mint` del thread
 * token, 1..n las transiciones. El índice único `(milestoneId, eventIndex)` es
 * lo que vuelve idempotente el anclaje (regla 8).
 */
async function recordOnChainEvent(input: {
  projectId: string;
  milestoneId: string;
  eventType: OnChainEventType;
  fromState: MilestoneState | null;
  toState: MilestoneState;
}) {
  const previo = await db
    .selectFrom("OnChainEvent")
    .select("eventIndex")
    .where("milestoneId", "=", input.milestoneId)
    .orderBy("eventIndex", "desc")
    .limit(1)
    .executeTakeFirst();

  const now = new Date();

  return db
    .insertInto("OnChainEvent")
    .values({
      id: createId(),
      projectId: input.projectId,
      milestoneId: input.milestoneId,
      eventIndex: previo ? previo.eventIndex + 1 : 0,
      eventType: input.eventType,
      fromState: input.fromState,
      toState: input.toState,
      commitment: null,
      status: "Pending",
      txid: null,
      outputRef: null,
      blockTimestamp: null,
      createdAt: now,
      updatedAt: now
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

/**
 * La fila de `Milestone` en la forma que espera el productor del datum.
 *
 * `evidenceRoot` va vacío **siempre**: el Merkle root del bundle no lo calcula
 * nadie todavía (no existe `EvidenceBundle`). Consecuencia visible y
 * documentada en SPEC-013 §Preguntas abiertas: completar un stage
 * `validationCritical` queda **registrado pero no anclado**, porque el
 * validador exige 32 bytes de commitment y acá no hay ninguno.
 */
function toDatumSource(milestone: MilestoneRow) {
  return {
    id: milestone.id,
    projectId: milestone.projectId,
    sequenceOrder: milestone.sequenceOrder,
    validationCritical: Boolean(milestone.validationCritical),
    state: milestone.state,
    evidenceRoot: "",
    completedAt: milestone.certifiedAt ? new Date(milestone.certifiedAt).getTime() : 0
  };
}

/** La cabeza del hilo: el UTxO vivo del thread token de este stage. */
async function cabezaDelHilo(milestoneId: string): Promise<string | null> {
  const ultimo = await db
    .selectFrom("OnChainEvent")
    .selectAll()
    .where("milestoneId", "=", milestoneId)
    .where("outputRef", "is not", null)
    .orderBy("eventIndex", "desc")
    .limit(1)
    .executeTakeFirst();

  return ultimo?.outputRef ?? null;
}

/**
 * Ancla un evento ya registrado y le escribe el resultado.
 *
 * **El registro nunca depende del anclaje** (D-059, SPEC-013 §Invariante 2): si
 * el puerto rechaza o se cae, la declaración ya está escrita y el evento queda
 * `Failed`. La respuesta sigue siendo 200 — lo que el usuario declaró, ocurrió;
 * lo que falta es la prueba, y la UI la muestra como tal (regla 17).
 */
async function anchorEvent(
  event: OnChainEventRow,
  milestone: MilestoneRow,
  previous: MilestoneRow | null
): Promise<OnChainEventRow> {
  // Idempotencia (regla 8): un evento ya anclado no se vuelve a anclar.
  if (event.txid) return event;

  try {
    const receipt =
      previous === null
        ? await anchorPort.openThread({ datum: buildStageDatum(toDatumSource(milestone)) })
        : await anchorPort.advanceThread({
            outputRef: (await cabezaDelHilo(milestone.id)) ?? "",
            previous: buildStageDatum(toDatumSource(previous)),
            next: buildStageDatum(toDatumSource(milestone))
          });

    const proof = receipt.status === "Confirmed" ? await anchorPort.verify(receipt.txid) : null;

    return await db
      .updateTable("OnChainEvent")
      .set({
        txid: receipt.txid,
        outputRef: receipt.outputRef,
        status: receipt.status,
        blockTimestamp: proof ? new Date(proof.blockTimestamp) : null,
        updatedAt: new Date()
      })
      .where("id", "=", event.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  } catch (error) {
    // El detalle va al log del servidor, no al cliente (errorHandler §regla 2).
    console.error("[anchor] el anclaje falló", { eventId: event.id, error });

    return await db
      .updateTable("OnChainEvent")
      .set({ status: "Failed", updatedAt: new Date() })
      .where("id", "=", event.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}

/** ¿Este stage ya tiene hilo en la cadena? Si lo tiene, su identidad on-chain
 * (orden y criticidad) es inmutable: el validador la rechaza reescrita. */
async function tieneHiloAnclado(milestoneId: string): Promise<boolean> {
  const anclado = await db
    .selectFrom("OnChainEvent")
    .select("id")
    .where("milestoneId", "=", milestoneId)
    .where("txid", "is not", null)
    .limit(1)
    .executeTakeFirst();

  return anclado !== undefined;
}

router.get(
  "/projects/:id/milestones",
  requireProjectAccess({ param: "id" }, ANY_MEMBERSHIP),
  async (req, res) => {
    const result = await db
      .selectFrom("Milestone")
      .selectAll()
      .where("projectId", "=", req.params.id)
      .orderBy("sequenceOrder", "asc")
      .execute();

    return res.json(result);
  }
);

router.post(
  "/projects/:id/milestones",
  requireRole("admin", "developer"),
  requireProjectAccess({ param: "id" }, ["developer"]),
  async (req: Request<{ id: string }>, res) => {
    const schema = z.object({
      name: z.string().min(1),
      sequenceOrder: z.number().int().positive(),
      // `state` NO se acepta por body: todo stage nace en `Pending`. El
      // handler `mint` del validador lo exige para acuñar el hilo
      // (`valid_initial_datum`), así que dejar elegir el estado inicial acá
      // sería fabricar stages que no se pueden anclar.
      validationCritical: z.boolean().optional(),
      scopeType: z.string().optional(),
      scopeUnitCount: z.number().int().nonnegative().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }

    const now = new Date();

    const milestone = await db
      .insertInto("Milestone")
      .values({
        id: createId(),
        projectId: req.params.id,
        name: parsed.data.name,
        sequenceOrder: parsed.data.sequenceOrder,
        state: INITIAL_STAGE_STATE,
        validationCritical: parsed.data.validationCritical ?? false,
        scopeType: parsed.data.scopeType ?? "project_wide",
        scopeUnitCount: parsed.data.scopeUnitCount ?? 0,
        createdAt: now,
        updatedAt: now
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const evento = await recordOnChainEvent({
      projectId: milestone.projectId,
      milestoneId: milestone.id,
      eventType: "STAGE_CREATED",
      fromState: null,
      toState: milestone.state
    });
    const anchor = await anchorEvent(evento, milestone, null);

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "CREATE_MILESTONE",
      entityType: "Milestone",
      entityId: milestone.id
    });

    return res.status(201).json({ ...milestone, anchor });
  }
);

router.get(
  "/milestones/:id",
  requireProjectAccess({ via: "Milestone", param: "id" }, ANY_MEMBERSHIP),
  async (req, res) => {
    const milestone = await db
      .selectFrom("Milestone")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    const [evidences, project] = await Promise.all([
      db.selectFrom("Evidence").selectAll().where("milestoneId", "=", milestone.id).execute(),
      db.selectFrom("Project").selectAll().where("id", "=", milestone.projectId).executeTakeFirst()
    ]);

    return res.json({ ...milestone, evidences, project });
  }
);

router.patch(
  "/milestones/:id",
  requireRole("admin", "developer"),
  requireProjectAccess({ via: "Milestone", param: "id" }, ["developer"]),
  // `Request<{ id: string }>` porque en Express 5 `req.params.id` es
  // `string | string[]`, y `tieneHiloAnclado` necesita un id, no una lista.
  async (req: Request<{ id: string }>, res) => {
    const milestoneExisting = await db
      .selectFrom("Milestone")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!milestoneExisting) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    const schema = z.object({
      name: z.string().min(1).optional(),
      sequenceOrder: z.number().int().positive().optional(),
      validationCritical: z.boolean().optional(),
      scopeType: z.string().optional(),
      scopeUnitCount: z.number().int().nonnegative().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }

    // `sequenceOrder` y `validationCritical` son parte de la IDENTIDAD del
    // stage en el datum, y el validador exige que no cambie nunca
    // (`identity_preserved`). Con el hilo ya anclado, reescribirlas acá dejaría
    // a la base diciendo una cosa y a la cadena otra, sin forma de reconciliar.
    const tocaIdentidad =
      parsed.data.sequenceOrder !== undefined || parsed.data.validationCritical !== undefined;

    if (tocaIdentidad && (await tieneHiloAnclado(req.params.id))) {
      return res.status(409).json({
        message: "Stage identity is immutable once anchored",
        code: "STAGE_IDENTITY_IMMUTABLE"
      });
    }

    const milestone = await db
      .updateTable("Milestone")
      .set({ ...parsed.data, updatedAt: new Date() })
      .where("id", "=", req.params.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "UPDATE_MILESTONE",
      entityType: "Milestone",
      entityId: milestone.id
    });

    return res.json(milestone);
  }
);

router.patch(
  "/milestones/:id/state",
  requireRole("admin", "developer"),
  requireProjectAccess({ via: "Milestone", param: "id" }, ["developer"]),
  async (req, res) => {
    const parsed = stageTransitionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }

    const existing = await db
      .selectFrom("Milestone")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!existing) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    const to = parsed.data.state;

    // **La tabla de transiciones, aplicada.** Es el mismo espejo que corre en
    // `contracts/lib/propnexus/fsm.ak`: sin esto, una transición que la API
    // acepta y el validador rechaza arma la transacción, la firma, paga el fee
    // y falla en la cadena — con la base diciendo una cosa y la cadena otra.
    if (!canTransition(existing.state, to)) {
      return res.status(409).json({
        message: `Invalid stage transition: ${existing.state} → ${to}`,
        code: STAGE_TRANSITION_ERRORS.invalid,
        from: existing.state,
        to
      });
    }

    // Whitepaper §Signature and Certification Rules: un stage
    // `validation_critical` no llega a `Completed` sin su evidencia. El
    // validador lo rechaza on-chain (`completion_evidence_ok`); acá se rechaza
    // antes de que cueste un fee.
    //
    // **Este es el piso de D-028, no D-028 entera:** falta exigir atribución de
    // autoridad (`issuingAuthority`, `authorityReference`) y la atestación del
    // revisor, y esas columnas todavía no existen. Ver `CLAUDE.md` §Deuda.
    if (to === "Completed" && existing.validationCritical) {
      const evidencia = await db
        .selectFrom("Evidence")
        .select("id")
        .where("milestoneId", "=", existing.id)
        .limit(1)
        .executeTakeFirst();

      if (!evidencia) {
        return res.status(409).json({
          message: "A validation-critical stage cannot be completed without evidence",
          code: STAGE_TRANSITION_ERRORS.evidenceRequired
        });
      }
    }

    const data: {
      state: typeof to;
      updatedAt: Date;
      certifiedAt?: Date;
      certifiedById?: string;
    } = {
      state: to,
      updatedAt: new Date()
    };

    if (to === "Completed") {
      data.certifiedAt = new Date();
      data.certifiedById = req.user!.id;
    }

    const milestone = await db
      .updateTable("Milestone")
      .set(data)
      .where("id", "=", req.params.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    // La declaración quedó registrada; la prueba queda pendiente hasta que
    // exista el `AnchorPort` (D-014) y devuelva un TXID confirmado.
    const evento = await recordOnChainEvent({
      projectId: milestone.projectId,
      milestoneId: milestone.id,
      eventType: "STAGE_TRANSITION",
      fromState: existing.state,
      toState: to
    });
    const anchor = await anchorEvent(evento, milestone, existing);

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "CHANGE_MILESTONE_STATE",
      entityType: "Milestone",
      entityId: milestone.id,
      metadata: { from: existing.state, to }
    });

    return res.json({ ...milestone, anchor });
  }
);

export default router;
