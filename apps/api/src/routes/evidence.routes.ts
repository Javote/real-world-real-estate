import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import {
  bundleFilesSchema,
  cuidParamSchema,
  EVIDENCE_UNATTRIBUTED,
  evidenceProofSchema,
  evidenceSchema,
  evidenciaSinAtribuir,
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
import type { UserRole } from "../db/types.js";
import { anclarEvidenciaUnaVez } from "../domain/anchoring.js";
import {
  hilosSospechosos,
  reconciliarAnclajes,
  reconciliarParaLectura,
  repararHilosSospechosos
} from "../domain/reconcile.js";
import { db } from "../lib/db.js";
import { conUsuario, delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc.js";
import { storage } from "../lib/storage.js";
import { ANY_MEMBERSHIP, authenticate, authorize, CUALQUIER_ROL } from "../middlewares/auth.js";
import { paramValidator } from "../middlewares/validate-params.js";
import { writeAuditLog } from "../utils/audit.js";
import { EVIDENCE_SAFE_COLUMNS } from "./_shared.js";

const evidenceDetailSchema = evidenceSchema.extend({
  project: projectSchema,
  stage: stageSchema.nullable(),
  uploadedBy: z.strictObject({ id: z.string(), email: z.email(), fullName: z.string() })
});

const PREFIJO_ABSOLUTO = "/api/v1/evidence";

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

    /* v8 ignore if -- @preserve: authorize({ proyecto }) ya confirmó que existe (Evidence) */
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

    /* v8 ignore if -- @preserve: authorize({ proyecto }) ya confirmó que existe (Evidence) */
    if (!evidence) throw new ORPCError("NOT_FOUND", { message: "Evidence not found" });

    if (!(await storage.exists(evidence.storagePath))) {
      throw new ORPCError("NOT_FOUND", { message: "Stored file not found" });
    }

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

    /* v8 ignore if -- @preserve: authorize({ proyecto }) ya confirmó que existe (Evidence) */
    if (!existing) throw new ORPCError("NOT_FOUND", { message: "Evidence not found" });

    if (
      evidenciaSinAtribuir({
        authoritative: body.authoritative ?? existing.authoritative,
        issuingAuthority:
          body.issuingAuthority === undefined ? existing.issuingAuthority : body.issuingAuthority
      })
    ) {
      throw new ORPCError("BAD_REQUEST", {
        message: EVIDENCE_UNATTRIBUTED,
        data: { code: EVIDENCE_UNATTRIBUTED }
      });
    }

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

    /* v8 ignore if -- @preserve: authorize({ proyecto }) ya confirmó que existe (Evidence) */
    if (!evidencia) throw new ORPCError("NOT_FOUND", { message: "Evidence not found" });

    await reconciliarParaLectura({ evidenceId: evidencia.id });

    const { evento: anclado, nuevo } = await anclarEvidenciaUnaVez({
      projectId: evidencia.projectId,
      stageId: evidencia.stageId,
      evidenceId: evidencia.id,
      eventType: "EVIDENCE_ANCHOR",
      commitment: evidencia.sha256Hash,
      reference: evidencia.id
    });

    if (!nuevo) return { status: 200 as const, body: onChainEventSchema.parse(anclado) };

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

    /* v8 ignore if -- @preserve: authorize({ proyecto }) ya confirmó que existe (EvidenceBundle) */
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
