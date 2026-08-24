import { createHash } from "node:crypto";
import {
  buildStageDatum,
  canTransition,
  INITIAL_STAGE_STATE,
  merkleRoot,
  STAGE_TRANSITION_ERRORS,
  stageTransitionSchema
} from "@plataforma/shared";
import { type Request, Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import type { OnChainEventRow, OnChainEventType, StageRow, StageState } from "../db/types";
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
 * token, 1..n las transiciones. El índice único `(stageId, eventIndex)` es
 * lo que vuelve idempotente el anclaje (regla 8).
 */
async function recordOnChainEvent(input: {
  projectId: string;
  stageId: string;
  eventType: OnChainEventType;
  fromState: StageState | null;
  toState: StageState;
}) {
  const previo = await db
    .selectFrom("OnChainEvent")
    .select("eventIndex")
    .where("stageId", "=", input.stageId)
    .orderBy("eventIndex", "desc")
    .limit(1)
    .executeTakeFirst();

  const now = new Date();

  return db
    .insertInto("OnChainEvent")
    .values({
      id: createId(),
      projectId: input.projectId,
      stageId: input.stageId,
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
 * La fila de `Stage` en la forma que espera el productor del datum.
 *
 * `evidenceRoot` va vacío **siempre**: el Merkle root del bundle no lo calcula
 * nadie todavía (no existe `EvidenceBundle`). Consecuencia visible y
 * documentada en SPEC-013 §Preguntas abiertas: completar un stage
 * `validationCritical` queda **registrado pero no anclado**, porque el
 * validador exige 32 bytes de commitment y acá no hay ninguno.
 */
function toDatumSource(stage: StageRow, evidenceRoot: string) {
  return {
    id: stage.id,
    projectId: stage.projectId,
    sequenceOrder: stage.sequenceOrder,
    validationCritical: Boolean(stage.validationCritical),
    state: stage.state,
    evidenceRoot,
    completedAt: stage.certifiedAt ? new Date(stage.certifiedAt).getTime() : 0
  };
}

/** El hash de dos nodos del árbol. Node acá, WebCrypto el día que verifique el
 * browser: por eso `merkleRoot` recibe la función en vez de importarla. */
const sha256Pair = (a: string, b: string) =>
  createHash("sha256")
    .update(Buffer.from(a + b, "hex"))
    .digest("hex");

/**
 * Arma el bundle que sostiene el cierre de un stage y devuelve su Merkle root
 * (`bundle_commitment_hash` de M1-D2 §2).
 *
 * **Es un acta, no un índice:** se escribe con la evidencia que existía en este
 * momento y no se toca más. Si después se sube más evidencia, es otro bundle —
 * el root ya anclado tiene que seguir verificando.
 */
async function crearBundle(stage: StageRow, actorUserId: string): Promise<string | null> {
  const evidencias = await db
    .selectFrom("Evidence")
    .select(["id", "sha256Hash"])
    .where("stageId", "=", stage.id)
    .orderBy("uploadedAt", "asc")
    .execute();

  if (evidencias.length === 0) return null;

  const root = merkleRoot(
    evidencias.map((e) => e.sha256Hash),
    sha256Pair
  );

  const bundleId = createId();
  await db
    .insertInto("EvidenceBundle")
    .values({
      id: bundleId,
      projectId: stage.projectId,
      stageId: stage.id,
      commitmentHash: root,
      createdById: actorUserId,
      createdAt: new Date()
    })
    .execute();

  await db
    .insertInto("EvidenceBundleItem")
    .values(
      evidencias.map((e) => ({
        bundleId,
        evidenceId: e.id,
        sha256Hash: e.sha256Hash
      }))
    )
    .execute();

  return root;
}

/** El root del último bundle del stage, o vacío si todavía no tiene. */
async function rootDelStage(stageId: string): Promise<string> {
  const bundle = await db
    .selectFrom("EvidenceBundle")
    .select("commitmentHash")
    .where("stageId", "=", stageId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .executeTakeFirst();

  return bundle?.commitmentHash ?? "";
}

/** La cabeza del hilo: el UTxO vivo del thread token de este stage. */
async function cabezaDelHilo(stageId: string): Promise<string | null> {
  const ultimo = await db
    .selectFrom("OnChainEvent")
    .selectAll()
    .where("stageId", "=", stageId)
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
  stage: StageRow,
  previous: StageRow | null
): Promise<OnChainEventRow> {
  // Idempotencia (regla 8): un evento ya anclado no se vuelve a anclar.
  if (event.txid) return event;

  try {
    // El root que va al datum sale del bundle del stage. Antes de que existiera
    // `EvidenceBundle` esto era siempre vacío, y por eso un stage crítico se
    // completaba en el registro pero el validador rechazaba su anclaje.
    const root = await rootDelStage(stage.id);
    const receipt =
      previous === null
        ? await anchorPort.openThread({ datum: buildStageDatum(toDatumSource(stage, "")) })
        : await anchorPort.advanceThread({
            outputRef: (await cabezaDelHilo(stage.id)) ?? "",
            // El datum previo se reconstruye con el root que ya tenía: si el
            // bundle se creó recién, el UTxO viejo NO lo lleva.
            previous: buildStageDatum(
              toDatumSource(previous, previous.state === "Completed" ? root : "")
            ),
            next: buildStageDatum(toDatumSource(stage, stage.state === "Completed" ? root : ""))
          });

    const proof = receipt.status === "Confirmed" ? await anchorPort.verify(receipt.txid) : null;

    return await db
      .updateTable("OnChainEvent")
      .set({
        txid: receipt.txid,
        outputRef: receipt.outputRef,
        status: receipt.status,
        // Qué commitment quedó anclado en ESTE evento. Vacío mientras el stage
        // no se completa: hasta entonces el datum no lleva root.
        commitment: stage.state === "Completed" ? root : null,
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
async function tieneHiloAnclado(stageId: string): Promise<boolean> {
  const anclado = await db
    .selectFrom("OnChainEvent")
    .select("id")
    .where("stageId", "=", stageId)
    .where("txid", "is not", null)
    .limit(1)
    .executeTakeFirst();

  return anclado !== undefined;
}

router.get(
  "/projects/:id/stages",
  requireProjectAccess({ param: "id" }, ANY_MEMBERSHIP),
  async (req, res) => {
    const result = await db
      .selectFrom("Stage")
      .selectAll()
      .where("projectId", "=", req.params.id)
      .orderBy("sequenceOrder", "asc")
      .execute();

    return res.json(result);
  }
);

router.post(
  "/projects/:id/stages",
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
      validationCritical: z.boolean().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }

    const now = new Date();

    const stage = await db
      .insertInto("Stage")
      .values({
        id: createId(),
        projectId: req.params.id,
        name: parsed.data.name,
        sequenceOrder: parsed.data.sequenceOrder,
        state: INITIAL_STAGE_STATE,
        // D-061: todo stage es validation-critical. El default deja de ser un
        // flag que alguien se olvida de marcar; desmarcarlo es explícito.
        validationCritical: parsed.data.validationCritical ?? true,
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

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "CREATE_STAGE",
      entityType: "Stage",
      entityId: stage.id
    });

    return res.status(201).json({ ...stage, anchor });
  }
);

router.get(
  "/stages/:id",
  requireProjectAccess({ via: "Stage", param: "id" }, ANY_MEMBERSHIP),
  async (req, res) => {
    const stage = await db
      .selectFrom("Stage")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!stage) {
      return res.status(404).json({ message: "Stage not found" });
    }

    const [evidences, project] = await Promise.all([
      db.selectFrom("Evidence").selectAll().where("stageId", "=", stage.id).execute(),
      db.selectFrom("Project").selectAll().where("id", "=", stage.projectId).executeTakeFirst()
    ]);

    return res.json({ ...stage, evidences, project });
  }
);

router.patch(
  "/stages/:id",
  requireRole("admin", "developer"),
  requireProjectAccess({ via: "Stage", param: "id" }, ["developer"]),
  // `Request<{ id: string }>` porque en Express 5 `req.params.id` es
  // `string | string[]`, y `tieneHiloAnclado` necesita un id, no una lista.
  async (req: Request<{ id: string }>, res) => {
    const stageExisting = await db
      .selectFrom("Stage")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!stageExisting) {
      return res.status(404).json({ message: "Stage not found" });
    }

    const schema = z.object({
      name: z.string().min(1).optional(),
      sequenceOrder: z.number().int().positive().optional(),
      validationCritical: z.boolean().optional()
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

    const stage = await db
      .updateTable("Stage")
      .set({ ...parsed.data, updatedAt: new Date() })
      .where("id", "=", req.params.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "UPDATE_STAGE",
      entityType: "Stage",
      entityId: stage.id
    });

    return res.json(stage);
  }
);

router.patch(
  "/stages/:id/state",
  requireRole("admin", "developer"),
  requireProjectAccess({ via: "Stage", param: "id" }, ["developer"]),
  async (req, res) => {
    const parsed = stageTransitionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }

    const existing = await db
      .selectFrom("Stage")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!existing) {
      return res.status(404).json({ message: "Stage not found" });
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
        .where("stageId", "=", existing.id)
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

    const stage = await db
      .updateTable("Stage")
      .set(data)
      .where("id", "=", req.params.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    // Al completar, la evidencia del stage se congela en un bundle y su Merkle
    // root es lo que viaja al datum. Se arma acá y no antes porque es el acta
    // del cierre: la evidencia que existía en el momento de completar.
    if (to === "Completed") {
      await crearBundle(stage, req.user!.id);
    }

    // La declaración quedó registrada; la prueba se ancla a continuación.
    const evento = await recordOnChainEvent({
      projectId: stage.projectId,
      stageId: stage.id,
      eventType: "STAGE_TRANSITION",
      fromState: existing.state,
      toState: to
    });
    const anchor = await anchorEvent(evento, stage, existing);

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "CHANGE_STAGE_STATE",
      entityType: "Stage",
      entityId: stage.id,
      metadata: { from: existing.state, to }
    });

    return res.json({ ...stage, anchor });
  }
);

export default router;
