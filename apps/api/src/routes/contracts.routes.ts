import { contractReleaseSchema, cuidParamSchema } from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import { reconciliarParaLectura } from "../domain/reconcile.js";
import { db } from "../lib/db.js";
import { delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc.js";
import { authenticate, authorize, CUALQUIER_ROL } from "../middlewares/auth.js";
import { paramValidator } from "../middlewares/validate-params.js";

const PREFIJO_ABSOLUTO = "/api/v1/contracts";

const router = Router();

router.param("contractId", paramValidator(cuidParamSchema));

router.use(authenticate);

const releasesProcedure = os
  .route({ method: "GET", path: "/{contractId}/releases" })
  .input(z.strictObject({ contractId: cuidParamSchema }))
  .output(z.array(contractReleaseSchema))
  .handler(async ({ input }) => {
    const contrato = await db
      .selectFrom("Contract")
      .innerJoin("Unit", "Unit.id", "Contract.unitId")
      .select(["Contract.id as id", "Unit.projectId as projectId"])
      .where("Contract.id", "=", input.contractId)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: las dos ramas de authorize({ alguna }) ya cargaron el contrato */
    if (!contrato) throw new ORPCError("NOT_FOUND", { message: "Contract not found" });

    await reconciliarParaLectura({ projectId: contrato.projectId });

    const releases = await db
      .selectFrom("PaymentAttestation")
      .leftJoin("OnChainEvent", (join) =>
        join
          .onRef("OnChainEvent.referenceId", "=", "PaymentAttestation.id")
          .on("OnChainEvent.eventType", "=", "PAYMENT_RELEASE")
      )
      .select([
        "PaymentAttestation.id as id",
        "PaymentAttestation.stageNumber as stageNumber",
        "PaymentAttestation.amountMinorUnits as amountMinorUnits",
        "PaymentAttestation.releasedAt as releasedAt",
        "OnChainEvent.commitment as commitment",
        "OnChainEvent.txid as txid",
        "OnChainEvent.status as anchorStatus"
      ])
      .where("PaymentAttestation.contractId", "=", contrato.id)
      .orderBy("PaymentAttestation.stageNumber", "asc")
      .execute();

    return z.array(contractReleaseSchema).parse(releases);
  });
const releasesHandler = new OpenAPIHandler({ releasesProcedure });

router.get(
  "/:contractId/releases",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: {
      alguna: [
        { dueño: { via: "Contract", param: "contractId" } },
        {
          proyecto: { via: "Contract", param: "contractId" },
          membresias: ["developer", "buyer", "verifier"]
        }
      ]
    }
  }),
  delegarAOrpc(releasesHandler, PREFIJO_ABSOLUTO)
);

export const contractsOrpcRouter = {
  releasesProcedure
};

export default router;
