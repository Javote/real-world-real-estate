import { createHash } from "node:crypto";
import {
  bundleFilesSchema,
  cuidParamSchema,
  evidenceProofSchema,
  evidenceSchema,
  hex64ParamSchema,
  merkleProof,
  onChainEventSchema,
  projectSchema,
  reconciliationResultSchema,
  stageSchema,
  updateEvidenceSchema
} from "@plataforma/shared";
import { type Request, Router } from "express";
import { z } from "zod";
import { anchorCommitmentEvent } from "../domain/anchoring";
import {
  hilosSospechosos,
  reconciliarAnclajes,
  reconciliarParaLectura,
  repararHilosSospechosos
} from "../domain/reconcile";
import { db } from "../lib/db";
import { storage } from "../lib/storage";
import { ANY_MEMBERSHIP, authenticate, authorize, CUALQUIER_ROL } from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";
import { writeAuditLog } from "../utils/audit";
import { EVIDENCE_SAFE_COLUMNS } from "./_shared";

/** `GET /:id` compone la evidencia con su proyecto, stage y quien la subió. */
const evidenceDetailSchema = evidenceSchema.extend({
  project: projectSchema,
  stage: stageSchema.nullable(),
  uploadedBy: z.strictObject({ id: z.string(), email: z.email(), fullName: z.string() })
});

const router = Router();

router.param("id", paramValidator(cuidParamSchema));
router.param("bundleId", paramValidator(cuidParamSchema));
router.param("fileHash", paramValidator(hex64ParamSchema));

router.use(authenticate);

router.get(
  "/:id",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { via: "Evidence", param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  async (req, res) => {
    const evidence = await db
      .selectFrom("Evidence")
      .select(EVIDENCE_SAFE_COLUMNS)
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!evidence) {
      return res.status(404).json({ message: "Evidence not found" });
    }

    const [project, stage, uploadedBy] = await Promise.all([
      db.selectFrom("Project").selectAll().where("id", "=", evidence.projectId).executeTakeFirst(),
      evidence.stageId
        ? db.selectFrom("Stage").selectAll().where("id", "=", evidence.stageId).executeTakeFirst()
        : Promise.resolve(null),
      db
        .selectFrom("User")
        .select(["id", "email", "fullName"])
        .where("id", "=", evidence.uploadedById)
        .executeTakeFirst()
    ]);

    return res.json(evidenceDetailSchema.parse({ ...evidence, project, stage, uploadedBy }));
  }
);

router.get(
  "/:id/download",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { via: "Evidence", param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  async (req, res) => {
    const evidence = await db
      .selectFrom("Evidence")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!evidence) {
      return res.status(404).json({ message: "Evidence not found" });
    }

    if (!(await storage.exists(evidence.storagePath))) {
      return res.status(404).json({ message: "Stored file not found" });
    }

    // Se streamea desde el storage en vez de `res.download`: con `s3` no hay
    // ruta local que pasarle, y el nombre visible sale del registro, no del
    // objeto guardado.
    res.setHeader("Content-Type", evidence.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(evidence.originalFilename)}"`
    );
    const contenido = await storage.read(evidence.storagePath);
    return contenido.pipe(res);
  }
);

router.patch(
  "/:id",
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { via: "Evidence", param: "id" }, membresias: ["developer"] }
  }),
  async (req: Request<{ id: string }>, res) => {
    const existing = await db
      .selectFrom("Evidence")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!existing) {
      return res.status(404).json({ message: "Evidence not found" });
    }

    const parsed = updateEvidenceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }

    if (parsed.data.stageId) {
      const stage = await db
        .selectFrom("Stage")
        .select("id")
        .where("id", "=", parsed.data.stageId)
        .where("projectId", "=", existing.projectId)
        .executeTakeFirst();

      if (!stage) {
        return res.status(400).json({
          message: "Stage does not belong to project"
        });
      }
    }

    await db
      .updateTable("Evidence")
      .set({ ...parsed.data, updatedAt: new Date() })
      .where("id", "=", req.params.id)
      .execute();

    const evidence = await db
      .selectFrom("Evidence")
      .select(EVIDENCE_SAFE_COLUMNS)
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "UPDATE_EVIDENCE",
      entityType: "Evidence",
      entityId: req.params.id
    });

    return res.json(evidenceSchema.parse(evidence));
  }
);

/**
 * **Anclar el hash de un archivo. Lo dispara el admin, nunca el upload** (D-061).
 *
 * Es el camino `Evidence Anchor Transactions` de `M1-D2/1-system-architecture`:
 * metadata suelta (label 1904, D-006), sin validador. Prueba *este archivo
 * existía a esta hora* — no que un stage avanzó, que es lo que prueba el hilo.
 *
 * Por qué manual: una vez en la cadena no se borra. Anclar en el upload
 * anclaría borradores, archivos subidos por error y versiones que todavía no
 * son la buena. Y M2-D4 §6.3 pide que toda superficie de prueba la inicie el
 * usuario.
 *
 * Idempotente (regla 8): si ese archivo ya tiene su anclaje, devuelve el mismo
 * evento en vez de gastar otra transacción.
 */
/**
 * `POST /api/v1/evidence/reconcile` — promueve a `Confirmed` los anclajes que
 * ya entraron en un bloque (SPEC-013 §C).
 *
 * **Va antes de `/:id/anchor` a propósito:** Express matchea por orden, y
 * `"reconcile"` encajaría en `:id` si se declarara después. El síntoma sería un
 * 404 buscando una evidencia con id "reconcile".
 *
 * Sin body y sin parámetros: revisa lo que haya pendiente. Es idempotente por
 * construcción —un evento ya confirmado no vuelve a consultarse— así que
 * dispararlo de más no cuesta nada.
 *
 * Lo dispara alguien de afuera: hoy a mano, mañana un cron de GitHub Actions.
 * **Nunca un `setInterval` acá adentro** (D-003 · D-040): con el servicio
 * dormido a los 15 minutos, un timer interno deja de contar y nadie se entera.
 *
 * **Desde el 2026-09-10 también devuelve `sospechosos`** (`hilosSospechosos`):
 * transiciones sin TXID que el stage ya dejó atrás — la señal del patrón que
 * la prueba de volumen de ese día encontró a mano. Ver `domain/reconcile.ts`
 * y `specs/REPORTE-2026-09-10-prueba-de-volumen.md`.
 *
 * **Y desde la misma fecha, antes de mirar nada, intenta repararlos solo**
 * (`repararHilosSospechosos`, Capa 1): busca el UTxO vivo de cada sospechoso
 * directo en la cadena y, si existe y coincide con lo que el evento ya
 * declaraba, completa el `txid`/`outputRef` que faltaba — sin firmar ni
 * gastar nada. Por eso el orden de las tres llamadas es secuencial y no un
 * `Promise.all`: reparar puede dejarle `txid` a un evento que hasta hace un
 * instante no tenía, y `reconciliarAnclajes` necesita correr **después** para
 * promoverlo a `Confirmed` en la misma respuesta — si no, quedaría `Pending`
 * hasta el próximo disparo. `sospechosos` se pide al final para que ya no
 * liste lo que se acaba de reparar.
 */
router.post("/reconcile", authorize({ roles: ["admin"], acceso: "soloRol" }), async (_req, res) => {
  const reparados = await repararHilosSospechosos();
  const resultado = await reconciliarAnclajes();
  const sospechosos = await hilosSospechosos();
  res.json(reconciliationResultSchema.parse({ ...resultado, sospechosos, reparados }));
});

router.post(
  "/:id/anchor",
  authorize({
    roles: ["admin"],
    acceso: { proyecto: { via: "Evidence", param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  async (req: Request<{ id: string }>, res) => {
    const evidencia = await db
      .selectFrom("Evidence")
      .select(["id", "projectId", "stageId", "sha256Hash"])
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!evidencia) {
      return res.status(404).json({ message: "Evidence not found" });
    }

    // Si ya está anclada, la respuesta es ese evento: se confirma antes de
    // devolverlo, para no contestar "Pendiente" sobre algo que ya está en un
    // bloque (D-077).
    await reconciliarParaLectura({ evidenceId: evidencia.id });

    const yaAnclada = await db
      .selectFrom("OnChainEvent")
      .selectAll()
      .where("evidenceId", "=", evidencia.id)
      .where("txid", "is not", null)
      .executeTakeFirst();

    if (yaAnclada) {
      return res.status(200).json(onChainEventSchema.parse(yaAnclada));
    }

    // SPEC-206 (B-08): esto era ~60 líneas reimplementando inline lo que
    // `anchorCommitmentEvent` ya hace — leer el `eventIndex` previo, insertar
    // `Pending`, guardar el recibo apenas existe, confirmar best-effort,
    // marcar `Failed` si el puerto explota. Habían divergido: esta copia no
    // escribía `referenceId`, así que una evidencia anclada por acá (a
    // diferencia de una por `POST /developer/documents`) no era reconciliable
    // por su ref. `reference`/`evidenceId` son el mismo id a propósito: es la
    // ref opaca al registro, nunca el nombre del archivo (regla 2).
    const anclado = await anchorCommitmentEvent({
      projectId: evidencia.projectId,
      stageId: evidencia.stageId,
      evidenceId: evidencia.id,
      eventType: "EVIDENCE_ANCHOR",
      commitment: evidencia.sha256Hash,
      reference: evidencia.id
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "ANCHOR_EVIDENCE",
      entityType: "Evidence",
      entityId: evidencia.id,
      metadata: { txid: anclado.txid, status: anclado.status }
    });

    return res.status(201).json(onChainEventSchema.parse(anclado));
  }
);

router.delete(
  "/:id",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  async (req: Request<{ id: string }>, res) => {
    const existing = await db
      .selectFrom("Evidence")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!existing) {
      return res.status(404).json({ message: "Evidence not found" });
    }

    await storage.remove(existing.storagePath);

    await db.deleteFrom("Evidence").where("id", "=", req.params.id).execute();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "DELETE_EVIDENCE",
      entityType: "Evidence",
      entityId: req.params.id
    });

    return res.status(204).send();
  }
);

/**
 * Fila 25m — el camino de Merkle de un archivo dentro de su bundle.
 *
 * Es lo que vuelve real la promesa de M2-D4 P5: el revisor rehashea **su**
 * archivo, camina el árbol con estos hermanos y compara con la raíz anclada.
 * Sin esto, tendría que bajarse todos los archivos del bundle.
 */
router.get(
  "/:bundleId/proof/:fileHash",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { via: "EvidenceBundle", param: "bundleId" }, membresias: ANY_MEMBERSHIP }
  }),
  async (req, res) => {
    const items = await db
      .selectFrom("EvidenceBundleItem")
      .select(["sha256Hash", "evidenceId"])
      .where("bundleId", "=", req.params.bundleId as string)
      .execute();

    if (items.length === 0) return res.status(404).json({ message: "Bundle not found" });

    const bundle = await db
      .selectFrom("EvidenceBundle")
      .select(["commitmentHash"])
      .where("id", "=", req.params.bundleId as string)
      .executeTakeFirstOrThrow();

    const item = items.find((i) => i.sha256Hash === req.params.fileHash);
    if (!item) return res.status(404).json({ message: "That hash is not part of this bundle" });

    await reconciliarParaLectura({ evidenceId: item.evidenceId });

    const evidencia = await db
      .selectFrom("Evidence")
      .leftJoin("OnChainEvent", (join) =>
        join
          .onRef("OnChainEvent.evidenceId", "=", "Evidence.id")
          .on("OnChainEvent.eventType", "=", "EVIDENCE_ANCHOR")
      )
      .select([
        "Evidence.uploadedById as signerUserId",
        "OnChainEvent.status as anchorStatus",
        "OnChainEvent.txid as txid",
        "OnChainEvent.blockTimestamp as blockTimestamp"
      ])
      .where("Evidence.id", "=", item.evidenceId)
      .executeTakeFirstOrThrow();

    const sha256Pair = (a: string, b: string) =>
      createHash("sha256")
        .update(Buffer.from(a + b, "hex"))
        .digest("hex");

    try {
      const proof = merkleProof(
        items.map((i) => i.sha256Hash),
        req.params.fileHash as string,
        sha256Pair
      );
      // Regla 17: sin TXID confirmado no hay timestamp que sostener.
      const confirmado = evidencia.anchorStatus === "Confirmed" && evidencia.txid !== null;
      const body = evidenceProofSchema.parse({
        merkleRoot: bundle.commitmentHash,
        leaf: req.params.fileHash as string,
        proof,
        signerUserId: evidencia.signerUserId,
        anchorStatus: evidencia.anchorStatus,
        txid: confirmado ? evidencia.txid : null,
        timestamp:
          confirmado && evidencia.blockTimestamp
            ? new Date(evidencia.blockTimestamp).toISOString()
            : null
      });
      return res.json(body);
    } catch {
      return res.status(404).json({ message: "That hash is not part of this bundle" });
    }
  }
);

/** Fila 25m — los archivos del bundle con sus hashes. */
router.get(
  "/:bundleId/files",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { via: "EvidenceBundle", param: "bundleId" }, membresias: ANY_MEMBERSHIP }
  }),
  async (req, res) => {
    const bundle = await db
      .selectFrom("EvidenceBundle")
      .selectAll()
      .where("id", "=", req.params.bundleId as string)
      .executeTakeFirst();

    if (!bundle) return res.status(404).json({ message: "Bundle not found" });

    const items = await db
      .selectFrom("EvidenceBundleItem")
      .leftJoin("Evidence", "Evidence.id", "EvidenceBundleItem.evidenceId")
      .select([
        "EvidenceBundleItem.evidenceId as evidenceId",
        "EvidenceBundleItem.sha256Hash as sha256Hash",
        "Evidence.originalFilename as filename"
      ])
      .where("EvidenceBundleItem.bundleId", "=", bundle.id)
      .execute();

    return res.json(
      bundleFilesSchema.parse({
        bundleId: bundle.id,
        merkleRoot: bundle.commitmentHash,
        files: items
      })
    );
  }
);

export default router;
