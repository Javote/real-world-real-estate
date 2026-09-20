import fs from "node:fs";
import path from "node:path";
import {
  cuidParamSchema,
  stageEvidenceUploadResultSchema,
  stageEvidenceUploadSchema
} from "@plataforma/shared";
import { type Request, Router } from "express";
import type { z } from "zod";
import { createId } from "../db/id";
import { anchorCommitmentEvent } from "../domain/anchoring";
import { notifyUnitInvestors } from "../domain/notify";
import { crearBundle, transitionStage } from "../domain/stage-transition";
import { db } from "../lib/db";
import { call, ORPCError, os } from "../lib/orpc";
import { storage } from "../lib/storage";
import { uploadSingleEvidence } from "../lib/upload";
import { authenticate, authorize } from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";
import { writeAuditLog } from "../utils/audit";
import { EVIDENCE_SAFE_COLUMNS } from "./_shared";

// **La subida anclada de evidencia por stage** (M2-D5 filas 38 y 44c) —
// M3-BE-13 y M3-SC-02, patrones P4 y P5.
//
// Un solo endpoint, y en archivo propio porque no se parece a nada más del
// prefijo: es el único que combina multipart, storage, hashing, armado de
// bundle y anclaje en la misma request. M2-D5 §2.2 lo obliga —*"client awaits
// success with TXID/Merkle root in the same response"*— porque es lo que
// alimenta el `AnchoringSuccessModal`, la única superficie de prueba que se
// abre sola (M2-D4 §6.3).
//
// **SPEC-212 — investigación "Multer + `call()`" (2026-09-20), adoptada en
// alcance acotado.** Esta sigue siendo la única ruta de §D que no migra a
// `OpenAPIHandler` — la razón no cambió: bufferea el multipart entero en
// memoria sin límite configurable (ver `CLAUDE.md` de este subárbol, §Trampas
// verificadas). Lo que sí cambia es SOLO el paso de validación de los campos
// de texto: `stageEvidenceUploadSchema.safeParse(req.body)` se reemplazó por
// `call(validarCamposDeTexto, req.body)`, que corre el MISMO schema a través
// del `.input()` de un procedimiento oRPC. El resultado, verificado con un
// smoke test: el 400 ahora tiene el mismo shape (`ORPCError.toJSON()`,
// `{code, status, data: {issues}}`) que las otras 45 rutas de §A-D, en vez de
// `error.flatten()` — que es lo que hoy las 45 devuelven y esta única ruta no
// devolvía. **A propósito no se llevó el resto del handler adentro de un
// procedimiento oRPC** (storage, bundle, anclaje, notificaciones, audit log,
// transición de stage): es lógica de dominio con side effects que ya
// funciona y no es lo que esta investigación puso en duda — meterla adentro
// del `.handler()` de un procedimiento hubiera sido un cambio mucho más
// grande que "unificar el shape del 400", sin necesidad. Por eso
// `borrarHuerfano()` y todo lo que sigue después de la validación no se tocó.
// Sin `.output()`: el valor que devuelve el `.handler()` YA es la salida
// transformada de `stageEvidenceUploadSchema` (`authoritative` a `boolean`,
// `issuingAuthority` a `string | null`) — volver a pasarla por el mismo
// schema como output typa contra su forma de ENTRADA (pre-transform, donde
// `authoritative` todavía es `string`) y no compila. No hace falta: nadie
// más consume el output de este procedimiento por HTTP, es un passthrough
// de validación en proceso.
const validarCamposDeTexto = os
  .route({ method: "POST", path: "/projects/{id}/stages/{stageId}/evidence" })
  .input(stageEvidenceUploadSchema)
  .handler(({ input }) => input);

const router = Router();

router.param("id", paramValidator(cuidParamSchema));
router.param("stageId", paramValidator(cuidParamSchema));

router.use(authenticate);

/**
 * Fila 38 y 44c — la subida del developer, scopeada al stage — **M3-BE-13** y
 * **M3-SC-02**, patrones P4 y P5.
 *
 * Es la MISMA subida que `POST /projects/:id/evidence` con el path y la forma
 * que el backlog pide, y con una diferencia que no es cosmética: acá el stage
 * es obligatorio y **la respuesta trae el Merkle root y el TXID en el mismo
 * request**. M2-D5 §2.2 lo fija: *"back end submits to Cardano; client awaits
 * success with TXID/Merkle root in the same response"* — es lo que alimenta el
 * `AnchoringSuccessModal`, la única superficie de prueba que se abre sola
 * (M2-D4 §6.3).
 *
 * **El bundle se rearma en cada subida.** Cada uno es un acta del conjunto que
 * existía en ese momento, no un índice que se edita: el root ya anclado tiene
 * que seguir verificando después de que se suba el archivo siguiente.
 *
 * **La asimetría de siempre** (D-059): el archivo y su hash quedan escritos
 * aunque el anclaje falle. En ese caso `anchor.status` es `Failed`, el TXID es
 * `null` y la UI muestra "Pendiente" — nunca "Verificado" (regla 17).
 */
router.post(
  "/projects/:id/stages/:stageId/evidence",
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { param: "id" }, membresias: ["developer"] }
  }),
  (req, res, next) => {
    uploadSingleEvidence(req, res, (err) => (err ? next(err) : next()));
  },
  async (req: Request<{ id: string; stageId: string }>, res, next) => {
    const { id: projectId, stageId } = req.params;

    if (!req.file) return res.status(400).json({ message: "File is required" });

    const borrarHuerfano = () => {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    };

    // `call()` corre `stageEvidenceUploadSchema` a través de `.input()` — el
    // MISMO schema que antes validaba con `safeParse`, ahora vía oRPC para
    // que el 400 tenga el shape unificado de las otras 45 rutas (ver el
    // comentario grande de arriba). Un `ORPCError` es un rechazo CLASIFICADO
    // (acá, `BAD_REQUEST` de `.input()`) — se responde directo con su propio
    // `status`/`toJSON()`, igual que hace `OpenAPIHandler.encodeError` para
    // las otras 45 rutas; nunca pasa por `errorHandler`, así que tampoco por
    // Sentry — mismo criterio que un `.errors()` con nombre en cualquier
    // procedimiento oRPC (una validación fallida no es un fallo del
    // servidor). Cualquier OTRA excepción (no `ORPCError`) sigue yendo a
    // `next(err)` — esta ruta nunca dejó de ser Express llano, así que un
    // error genuinamente no clasificado sigue llegando a `errorHandler`/
    // Sentry como siempre, a diferencia de `OpenAPIHandler.handle()`.
    let parsed: z.infer<typeof stageEvidenceUploadSchema>;
    try {
      parsed = await call(validarCamposDeTexto, req.body);
    } catch (err) {
      borrarHuerfano();
      if (err instanceof ORPCError) return res.status(err.status).json(err.toJSON());
      return next(err);
    }

    const stage = await db
      .selectFrom("Stage")
      .selectAll()
      .where("id", "=", stageId)
      .where("projectId", "=", projectId)
      .executeTakeFirst();

    if (!stage) {
      borrarHuerfano();
      return res.status(404).json({ message: "Stage does not belong to project" });
    }

    // **`Completed` es terminal en la FSM (D-020) y también acá.** Sin este
    // chequeo el pipeline de evidencia no se enteraba de que el stage había
    // cerrado: la subida armaba un bundle NUEVO, con un root nuevo, y lo
    // anclaba por metadata — mientras el datum del hilo conserva para siempre
    // el root congelado al certificar.
    //
    // La consecuencia es visible y es de la regla 17: `GET /projects/:id/
    // stages/:stageId` devuelve el bundle **más reciente**
    // (`orderBy createdAt desc limit 1`), así que la pantalla mostraría ese
    // `commitmentHash` al lado del evento de certificación, cuyo `commitment`
    // es el viejo. Un root exhibido junto a un TXID que no lo atestigua.
    //
    // **Dónde va la documentación posterior al cierre:** `POST /developer/
    // documents`, que es a nivel proyecto y no toca el bundle de ningún stage.
    // Por eso esto rechaza en vez de aceptar-y-no-rebundlear: aceptar en
    // silencio dejaría al developer creyendo que subió evidencia de la etapa.
    if (stage.state === "Completed") {
      borrarHuerfano();
      return res.status(409).json({
        message: "A completed stage does not accept more evidence",
        code: "STAGE_ALREADY_COMPLETED"
      });
    }

    const guardado = await storage.put({
      localPath: path.resolve(req.file.path),
      key: `evidence/${projectId}/${req.file.filename}`,
      contentType: req.file.mimetype
    });

    if (storage.driver === "s3" && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    const now = new Date();
    const creada = await db
      .insertInto("Evidence")
      .values({
        id: createId(),
        projectId,
        stageId,
        uploadedById: req.user!.id,
        evidenceType: parsed.evidenceType,
        category: parsed.category,
        authoritative: parsed.authoritative ?? false,
        issuingAuthority: parsed.issuingAuthority,
        originalFilename: req.file.originalname,
        storedFilename: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        storagePath: guardado.storageRef,
        sha256Hash: guardado.sha256,
        uploadedAt: now,
        createdAt: now,
        updatedAt: now
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    // El acta del conjunto que existe AHORA, con el archivo recién subido
    // adentro. Nunca es null: acabamos de insertar al menos una evidencia.
    const merkleRoot = await crearBundle(stage, req.user!.id);

    const bundle = await db
      .selectFrom("EvidenceBundle")
      .select(["id", "commitmentHash"])
      .where("stageId", "=", stage.id)
      .orderBy("createdAt", "desc")
      .limit(1)
      .executeTakeFirstOrThrow();

    // Se ancla el ROOT del bundle, no el hash del archivo: el archivo suelto ya
    // tiene su propia ruta de anclaje (`POST /evidence/:id/anchor`), y lo que
    // el patrón P5 muestra es el root con las hojas debajo.
    const anchor = await anchorCommitmentEvent({
      projectId,
      stageId: stage.id,
      evidenceId: creada.id,
      eventType: "EVIDENCE_ANCHOR",
      commitment: bundle.commitmentHash,
      // Ref opaca: el id del bundle, nunca el nombre del archivo (regla 2).
      reference: bundle.id
    });

    const evidence = await db
      .selectFrom("Evidence")
      .select(EVIDENCE_SAFE_COLUMNS)
      .where("id", "=", creada.id)
      .executeTakeFirstOrThrow();

    // Los investors del proyecto se enteran de que hay evidencia nueva. Con
    // clave, no con copy (regla 15).
    //
    // SPEC-209 (B-13): antes esto era un `SELECT id` seguido de un `for` que
    // llamaba a `notifyUnitInvestor` por unidad — y esa función VUELVE a
    // consultar `Unit.investorId`, el dato que la query de acá ya tenía y
    // descartaba. Dos queries secuenciales por unidad, adentro de la misma
    // request que el frontend espera para el `AnchoringSuccessModal`. Ahora
    // se trae `investorId` de una y se inserta todo en un solo `INSERT`.
    const unidades = await db
      .selectFrom("Unit")
      .select(["id", "investorId"])
      .where("projectId", "=", projectId)
      .where("investorId", "is not", null)
      .execute();

    await notifyUnitInvestors(
      unidades
        .filter((u): u is { id: string; investorId: string } => u.investorId !== null)
        .map((u) => ({ unitId: u.id, investorId: u.investorId })),
      {
        category: "document",
        titleKey: "notifications.evidence.uploaded",
        params: { stageName: stage.name }
      }
    );

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "UPLOAD_STAGE_EVIDENCE",
      entityType: "Evidence",
      entityId: creada.id,
      metadata: { bundleId: bundle.id, merkleRoot, txid: anchor.txid }
    });

    // M1-D2c: "Pending → InProgress : work initiated". La primera evidencia
    // que un developer sube a un stage Pending ES la señal de que el trabajo
    // arrancó — no hace falta un botón aparte (ver CLAUDE.md raíz). Mismo
    // criterio que POST /projects/:id/evidence; `Observed → InProgress` no se
    // dispara acá a propósito, es una acción explícita aparte.
    if (stage.state === "Pending") {
      await transitionStage({
        stageId: stage.id,
        to: "InProgress",
        actorUserId: req.user!.id,
        auditAction: "STAGE_WORK_INITIATED"
      });
    }

    return res.status(201).json(
      stageEvidenceUploadResultSchema.parse({
        evidence,
        bundleId: bundle.id,
        merkleRoot: bundle.commitmentHash,
        anchor
      })
    );
  }
);

export default router;
