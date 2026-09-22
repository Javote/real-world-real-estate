import { createHash } from "node:crypto";
import { Readable } from "node:stream";
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
import { Router } from "express";
import { z } from "zod";
import type { UserRole } from "../db/types";
import { anchorCommitmentEvent } from "../domain/anchoring";
import {
  hilosSospechosos,
  reconciliarAnclajes,
  reconciliarParaLectura,
  repararHilosSospechosos
} from "../domain/reconcile";
import { db } from "../lib/db";
import { conUsuario, delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc";
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

// **SPEC-216 §E7 — migrado a oRPC (D-066), las 8 rutas.**
// `GET /:id/download` cierra con `SPEC-217`: oRPC SÍ sirve un stream real sin
// bufferearlo (ver `downloadEvidenceProcedure`).
//
// **`POST /:id/anchor` repite el 200/201 idempotente que SPEC-212 §A ya
// resolvió** (`outputStructure: "detailed"`, unión discriminada por
// `status`, nunca un `status: z.union([...])` adentro de un solo objeto) —
// mismo shape exacto que `signDossierProcedure` en `notary.routes.ts`.
//
// **`DELETE /:id` necesita `.errors({EVIDENCE_ANCHORED})`**: `res.body.code`
// está fijado por `test/spec-210-borrar-evidencia-anclada.test.ts`.

const PREFIJO_ABSOLUTO = "/api/v1/evidence";

/** El contexto que cada procedimiento recibe — siempre el usuario ya
 * autenticado por `authenticate`, corrido antes de que oRPC vea la request. */
export type EvidenceContext = { user: { id: string; email: string; role: UserRole } };
const orpc = os.$context<EvidenceContext>();

const router = Router();

router.param("id", paramValidator(cuidParamSchema));
router.param("bundleId", paramValidator(cuidParamSchema));
router.param("fileHash", paramValidator(hex64ParamSchema));

router.use(authenticate);

const evidenceDetailProcedure = os
  .route({ method: "GET", path: "/{id}" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(evidenceDetailSchema)
  .handler(async ({ input }) => {
    const evidence = await db
      .selectFrom("Evidence")
      .select(EVIDENCE_SAFE_COLUMNS)
      .where("id", "=", input.id)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: authorize({ proyecto }) ya confirmó que existe (Evidence) (SPEC-018) */
    if (!evidence) throw new ORPCError("NOT_FOUND", { message: "Evidence not found" });

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

    return evidenceDetailSchema.parse({ ...evidence, project, stage, uploadedBy });
  });
const evidenceDetailHandler = new OpenAPIHandler({ evidenceDetailProcedure });

router.get(
  "/:id",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { via: "Evidence", param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  delegarAOrpc(evidenceDetailHandler, PREFIJO_ABSOLUTO)
);

/**
 * **SPEC-217 — streaming real con oRPC, verificado leyendo el código de
 * `@orpc/openapi` y `@orpc/standard-server-node`.** Con `outputStructure:
 * "detailed"` y un `body` que sea un `ReadableStream` WEB, `encode()` lo deja
 * pasar sin serializar y `sendStandardResponse()` lo pipea al socket
 * (`Readable.fromWeb(body).pipe(res)`): ningún `Buffer.concat` ni límite de
 * tamaño en el camino. Por eso `storage.read()` (un `Readable` de Node) se
 * envuelve con `Readable.toWeb()` — devolver el `Readable` crudo no matchea
 * ninguna rama y saldría serializado como JSON.
 *
 * Los dos 404 se resuelven ANTES de armar el stream: ningún header se escribe
 * si no hay nada que servir. `Content-Type` y `Content-Disposition` salen del
 * registro, nunca de lo que la librería infiera. Además, `sendStandardResponse`
 * engancha `'error'` del stream y hace `res.destroy(error)`: un storage que
 * falla a mitad de la descarga corta la respuesta en vez de tirar una
 * excepción sin capturar (el código anterior no tenía manejador).
 *
 * **No agregar `CompressionPlugin` a `OpenAPIHandler` sin excluir esta ruta**:
 * comprimir cambia el perfil de memoria que esta ruta existe para proteger.
 */
const downloadEvidenceProcedure = os
  .route({ method: "GET", path: "/{id}/download", outputStructure: "detailed" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(
    z.object({
      headers: z.record(z.string(), z.string()).optional(),
      body: z.instanceof(ReadableStream)
    })
  )
  .handler(async ({ input }) => {
    const evidence = await db
      .selectFrom("Evidence")
      .selectAll()
      .where("id", "=", input.id)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: authorize({ proyecto }) ya confirmó que existe (Evidence) (SPEC-018) */
    if (!evidence) throw new ORPCError("NOT_FOUND", { message: "Evidence not found" });

    if (!(await storage.exists(evidence.storagePath))) {
      throw new ORPCError("NOT_FOUND", { message: "Stored file not found" });
    }

    // El nombre visible sale del registro, no del objeto guardado.
    const contenido = await storage.read(evidence.storagePath);
    return {
      headers: {
        "content-type": evidence.mimeType,
        "content-disposition": `attachment; filename="${encodeURIComponent(evidence.originalFilename)}"`
      },
      body: Readable.toWeb(contenido) as ReadableStream
    };
  });
const downloadEvidenceHandler = new OpenAPIHandler({ downloadEvidenceProcedure });

router.get(
  "/:id/download",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { via: "Evidence", param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  delegarAOrpc(downloadEvidenceHandler, PREFIJO_ABSOLUTO)
);

const updateEvidenceProcedure = orpc
  .route({ method: "PATCH", path: "/{id}" })
  .input(updateEvidenceSchema.extend({ id: cuidParamSchema }))
  .output(evidenceSchema)
  .handler(async ({ input, context }) => {
    const { id, ...body } = input;

    const existing = await db
      .selectFrom("Evidence")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: authorize({ proyecto }) ya confirmó que existe (Evidence) (SPEC-018) */
    if (!existing) throw new ORPCError("NOT_FOUND", { message: "Evidence not found" });

    if (body.stageId) {
      const stage = await db
        .selectFrom("Stage")
        .select("id")
        .where("id", "=", body.stageId)
        .where("projectId", "=", existing.projectId)
        .executeTakeFirst();

      if (!stage) {
        throw new ORPCError("BAD_REQUEST", { message: "Stage does not belong to project" });
      }
    }

    await db
      .updateTable("Evidence")
      .set({ ...body, updatedAt: new Date() })
      .where("id", "=", id)
      .execute();

    const evidence = await db
      .selectFrom("Evidence")
      .select(EVIDENCE_SAFE_COLUMNS)
      .where("id", "=", id)
      .executeTakeFirst();

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "UPDATE_EVIDENCE",
      entityType: "Evidence",
      entityId: id
    });

    return evidenceSchema.parse(evidence);
  });
const updateEvidenceHandler = new OpenAPIHandler({ updateEvidenceProcedure });

router.patch(
  "/:id",
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { via: "Evidence", param: "id" }, membresias: ["developer"] }
  }),
  delegarAOrpc(updateEvidenceHandler, PREFIJO_ABSOLUTO, conUsuario)
);

/**
 * `POST /api/v1/evidence/reconcile` — promueve a `Confirmed` los anclajes que
 * ya entraron en un bloque (SPEC-013 §C).
 *
 * **Sigue declarada antes que `/:id/anchor`, como en el Express original**:
 * cada procedimiento tiene su propio `OpenAPIHandler` montado en su propio
 * `router.post(...)`, así que Express ya resuelve cuál ruta matchea antes de
 * que oRPC entre en juego — la migración no cambia esa parte.
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
const reconcileEvidenceProcedure = os
  .route({ method: "POST", path: "/reconcile" })
  .output(reconciliationResultSchema)
  .handler(async () => {
    const reparados = await repararHilosSospechosos();
    const resultado = await reconciliarAnclajes();
    const sospechosos = await hilosSospechosos();
    return reconciliationResultSchema.parse({ ...resultado, sospechosos, reparados });
  });
const reconcileEvidenceHandler = new OpenAPIHandler({ reconcileEvidenceProcedure });

router.post(
  "/reconcile",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  delegarAOrpc(reconcileEvidenceHandler, PREFIJO_ABSOLUTO)
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
 * **Idempotente** (regla 8): si ese archivo ya tiene su anclaje, devuelve el
 * mismo evento (200) en vez de gastar otra transacción (201) — mismo patrón
 * que `signDossierProcedure` de `notary.routes.ts` (SPEC-212 §A).
 */
const anchorEvidenceProcedure = orpc
  .route({
    method: "POST",
    path: "/{id}/anchor",
    outputStructure: "detailed",
    successStatus: 201
  })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(
    z.union([
      z.strictObject({ status: z.literal(200), body: onChainEventSchema }),
      z.strictObject({ status: z.literal(201), body: onChainEventSchema })
    ])
  )
  .handler(async ({ input, context }) => {
    const evidencia = await db
      .selectFrom("Evidence")
      .select(["id", "projectId", "stageId", "sha256Hash"])
      .where("id", "=", input.id)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: authorize({ proyecto }) ya confirmó que existe (Evidence) (SPEC-018) */
    if (!evidencia) throw new ORPCError("NOT_FOUND", { message: "Evidence not found" });

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
      return { status: 200 as const, body: onChainEventSchema.parse(yaAnclada) };
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
      actorUserId: context.user.id,
      action: "ANCHOR_EVIDENCE",
      entityType: "Evidence",
      entityId: evidencia.id,
      metadata: { txid: anclado.txid, status: anclado.status }
    });

    return { status: 201 as const, body: onChainEventSchema.parse(anclado) };
  });
const anchorEvidenceHandler = new OpenAPIHandler({ anchorEvidenceProcedure });

router.post(
  "/:id/anchor",
  authorize({
    roles: ["admin"],
    acceso: { proyecto: { via: "Evidence", param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  delegarAOrpc(anchorEvidenceHandler, PREFIJO_ABSOLUTO, conUsuario)
);

/**
 * SPEC-210 (B-15): antes esto borraba el archivo y la fila sin mirar si
 * había anclaje. `OnChainEvent.evidenceId` tiene `ON DELETE set null`, así
 * que el TXID sobrevivía en la cadena y en la tabla mientras el vínculo
 * con el archivo que probaba desaparecía — un evento `EVIDENCE_ANCHOR`
 * que terminaba anclando el hash de nada. Y si la evidencia estaba dentro
 * de un `EvidenceBundle` (`ON DELETE no action`), el borrado cortaba con
 * `SQLITE_CONSTRAINT_FOREIGNKEY`. La validación va ANTES de tocar storage o
 * la base: ningún archivo se borra si la fila no se iba a poder borrar.
 *
 * `EVIDENCE_ANCHORED` es un error con nombre — `res.body.code` está fijado
 * por `test/spec-210-borrar-evidencia-anclada.test.ts`.
 */
const deleteEvidenceProcedure = orpc
  .errors({
    EVIDENCE_ANCHORED: { status: 409, message: "Evidence is anchored and cannot be deleted" }
  })
  .route({ method: "DELETE", path: "/{id}", successStatus: 204 })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(z.void())
  .handler(async ({ input, context, errors }) => {
    const existing = await db
      .selectFrom("Evidence")
      .selectAll()
      .where("id", "=", input.id)
      .executeTakeFirst();

    if (!existing) throw new ORPCError("NOT_FOUND", { message: "Evidence not found" });

    const anclaje = await db
      .selectFrom("OnChainEvent")
      .select("id")
      .where("evidenceId", "=", existing.id)
      .executeTakeFirst();

    const enBundle = await db
      .selectFrom("EvidenceBundleItem")
      .select("bundleId")
      .where("evidenceId", "=", existing.id)
      .executeTakeFirst();

    if (anclaje || enBundle) {
      throw errors.EVIDENCE_ANCHORED({ message: "Evidence is anchored and cannot be deleted" });
    }

    await storage.remove(existing.storagePath);

    await db.deleteFrom("Evidence").where("id", "=", input.id).execute();

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "DELETE_EVIDENCE",
      entityType: "Evidence",
      entityId: input.id
    });
  });
const deleteEvidenceHandler = new OpenAPIHandler({ deleteEvidenceProcedure });

router.delete(
  "/:id",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  delegarAOrpc(deleteEvidenceHandler, PREFIJO_ABSOLUTO, conUsuario)
);

/**
 * Fila 25m — el camino de Merkle de un archivo dentro de su bundle.
 *
 * Es lo que vuelve real la promesa de M2-D4 P5: el revisor rehashea **su**
 * archivo, camina el árbol con estos hermanos y compara con la raíz anclada.
 * Sin esto, tendría que bajarse todos los archivos del bundle.
 */
const bundleProofProcedure = os
  .route({ method: "GET", path: "/{bundleId}/proof/{fileHash}" })
  .input(z.strictObject({ bundleId: cuidParamSchema, fileHash: hex64ParamSchema }))
  .output(evidenceProofSchema)
  .handler(async ({ input }) => {
    const items = await db
      .selectFrom("EvidenceBundleItem")
      .select(["sha256Hash", "evidenceId"])
      .where("bundleId", "=", input.bundleId)
      .execute();

    if (items.length === 0) throw new ORPCError("NOT_FOUND", { message: "Bundle not found" });

    const bundle = await db
      .selectFrom("EvidenceBundle")
      .select(["commitmentHash"])
      .where("id", "=", input.bundleId)
      .executeTakeFirstOrThrow();

    const item = items.find((i) => i.sha256Hash === input.fileHash);
    if (!item) {
      throw new ORPCError("NOT_FOUND", { message: "That hash is not part of this bundle" });
    }

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
        input.fileHash,
        sha256Pair
      );
      // Regla 17: sin TXID confirmado no hay timestamp que sostener.
      const confirmado = evidencia.anchorStatus === "Confirmed" && evidencia.txid !== null;
      return evidenceProofSchema.parse({
        merkleRoot: bundle.commitmentHash,
        leaf: input.fileHash,
        proof,
        signerUserId: evidencia.signerUserId,
        anchorStatus: evidencia.anchorStatus,
        txid: confirmado ? evidencia.txid : null,
        timestamp:
          confirmado && evidencia.blockTimestamp
            ? new Date(evidencia.blockTimestamp).toISOString()
            : null
      });
    } catch {
      throw new ORPCError("NOT_FOUND", { message: "That hash is not part of this bundle" });
    }
  });
const bundleProofHandler = new OpenAPIHandler({ bundleProofProcedure });

router.get(
  "/:bundleId/proof/:fileHash",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { via: "EvidenceBundle", param: "bundleId" }, membresias: ANY_MEMBERSHIP }
  }),
  delegarAOrpc(bundleProofHandler, PREFIJO_ABSOLUTO)
);

/** Fila 25m — los archivos del bundle con sus hashes. */
const bundleFilesProcedure = os
  .route({ method: "GET", path: "/{bundleId}/files" })
  .input(z.strictObject({ bundleId: cuidParamSchema }))
  .output(bundleFilesSchema)
  .handler(async ({ input }) => {
    const bundle = await db
      .selectFrom("EvidenceBundle")
      .selectAll()
      .where("id", "=", input.bundleId)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: authorize({ proyecto }) ya confirmó que existe (EvidenceBundle) (SPEC-018) */
    if (!bundle) throw new ORPCError("NOT_FOUND", { message: "Bundle not found" });

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

    return bundleFilesSchema.parse({
      bundleId: bundle.id,
      merkleRoot: bundle.commitmentHash,
      files: items
    });
  });
const bundleFilesHandler = new OpenAPIHandler({ bundleFilesProcedure });

router.get(
  "/:bundleId/files",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { via: "EvidenceBundle", param: "bundleId" }, membresias: ANY_MEMBERSHIP }
  }),
  delegarAOrpc(bundleFilesHandler, PREFIJO_ABSOLUTO)
);

/** El router oRPC combinado de esta vertical — lo consume
 * `scripts/generate-openapi.ts` para generar el fragmento de OpenAPI de las 8
 * rutas migradas. */
export const evidenceOrpcRouter = {
  evidenceDetailProcedure,
  downloadEvidenceProcedure,
  updateEvidenceProcedure,
  reconcileEvidenceProcedure,
  anchorEvidenceProcedure,
  deleteEvidenceProcedure,
  bundleProofProcedure,
  bundleFilesProcedure
};

export default router;
