import {
  STAGE_TRANSITION_ERRORS,
  stageTransitionSchema,
  updateStageSchema
} from "@plataforma/shared";
import { type Request, Router } from "express";
import { cabezaDelHilo, transitionStage } from "../domain/stage-transition";
import { db } from "../lib/db";
import { ANY_MEMBERSHIP, authenticate, authorize, CUALQUIER_ROL } from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";

const router = Router();

router.use(authenticate);

router.get(
  "/:id",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { via: "Stage", param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  async (req, res) => {
    const stage = await db
      .selectFrom("Stage")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!stage) {
      return res.status(404).json({ message: "Stage not found" });
    }

    const [evidences, project, hilo] = await Promise.all([
      db.selectFrom("Evidence").selectAll().where("stageId", "=", stage.id).execute(),
      db.selectFrom("Project").selectAll().where("id", "=", stage.projectId).executeTakeFirst(),
      cabezaDelHilo(stage.id)
    ]);

    return res.json({ ...stage, evidences, project, hasOnChainThread: hilo !== null });
  }
);

router.patch(
  "/:id",
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { via: "Stage", param: "id" }, membresias: ["developer"] }
  }),
  // `Request<{ id: string }>` porque en Express 5 `req.params.id` es
  // `string | string[]`, y `cabezaDelHilo` necesita un id, no una lista.
  async (req: Request<{ id: string }>, res) => {
    const stageExisting = await db
      .selectFrom("Stage")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!stageExisting) {
      return res.status(404).json({ message: "Stage not found" });
    }

    const parsed = updateStageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }

    // `sequenceOrder` y `validationCritical` son parte de la IDENTIDAD del
    // stage en el datum, y el validador exige que no cambie nunca
    // (`identity_preserved`). Con el hilo ya anclado, reescribirlas acá dejaría
    // a la base diciendo una cosa y a la cadena otra, sin forma de reconciliar.
    //
    // **`cabezaDelHilo`, no "cualquier OnChainEvent con txid"**: un stage puede
    // tener evidencia anclada por metadata (`EVIDENCE_ANCHOR`) sin tener hilo
    // — ese anclaje no toca el validador ni la identidad del stage (D-006). Un
    // chequeo más ancho bloquearía cambios de orden/criticidad sobre un stage
    // que nunca minteó nada.
    const tocaIdentidad =
      parsed.data.sequenceOrder !== undefined || parsed.data.validationCritical !== undefined;

    if (tocaIdentidad && (await cabezaDelHilo(req.params.id)) !== null) {
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
  "/:id/state",
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { via: "Stage", param: "id" }, membresias: ["developer"] }
  }),
  async (req: Request<{ id: string }>, res) => {
    const parsed = stageTransitionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }

    // M2-D1 §Role Permission Matrix: "Stage certification" y "Stage
    // observation" son acciones exclusivas del certifier — esta ruta es la
    // del developer, y `authorize` de arriba solo garantiza rol+membresía,
    // no CUÁL transición. `transitionStage` valida que la FSM lo permita,
    // no quién la pide, así que sin este chequeo un developer podía
    // auto-certificar su propio stage vía esta misma ruta. `admin` no tiene
    // este límite (regla del bypass ya establecida en `projectScope`).
    if (req.user!.role !== "admin" && parsed.data.state !== "InProgress") {
      return res.status(403).json({
        message: "Only a certifier can move a stage to Completed or Observed",
        code: STAGE_TRANSITION_ERRORS.forbidden
      });
    }

    // Toda la lógica —tabla de transiciones, evidencia, bundle, anclaje,
    // audit log— vive en el dominio: esta ruta solo aporta su autorización y
    // traduce el resultado a HTTP.
    const resultado = await transitionStage({
      stageId: req.params.id,
      to: parsed.data.state,
      actorUserId: req.user!.id
    });

    if (!resultado.ok) {
      if (resultado.status === 404) return res.status(404).json({ message: "Stage not found" });
      if (resultado.code === "STAGE_TRANSITION_INVALID") {
        return res.status(409).json({
          message: `Invalid stage transition: ${resultado.from} → ${resultado.to}`,
          code: resultado.code,
          from: resultado.from,
          to: resultado.to
        });
      }
      return res.status(409).json({
        message: "A validation-critical stage cannot be completed without evidence",
        code: resultado.code
      });
    }

    return res.json({ ...resultado.stage, anchor: resultado.anchor });
  }
);

export default router;
