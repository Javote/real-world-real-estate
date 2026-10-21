import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  disputeSchema,
  listDisputesQuerySchema,
  openDisputeSchema,
  resolveDisputeSchema
} from "../disputes";
import { cuidParamSchema } from "../params";
import type { MetaDeProcedimiento } from "./guard";

const base = oc.$meta<MetaDeProcedimiento>({});

// Abrir y resolver son roles distintos a propósito (SPEC-502): quien reclama no cierra su reclamo.
const PARTE_DEL_STAGE = {
  guard: {
    roles: ["developer", "buyer"],
    acceso: {
      proyecto: { via: "Stage", param: "stageId", en: "body" },
      membresias: ["developer", "buyer"]
    }
  }
} satisfies MetaDeProcedimiento;

// El comprador no lista: el `reason` de otro comprador del proyecto no es suyo para leer.
const DEL_PROYECTO = {
  guard: {
    roles: ["admin", "developer", "verifier"],
    acceso: { proyecto: { param: "projectId" }, membresias: ["developer", "verifier"] }
  }
} satisfies MetaDeProcedimiento;

const CERTIFICADOR_DEL_PROYECTO = {
  guard: {
    roles: ["admin", "verifier"],
    acceso: { proyecto: { via: "Dispute", param: "id" }, membresias: ["verifier"] }
  }
} satisfies MetaDeProcedimiento;

export const disputasContrato = {
  abrir: base
    .route({ method: "POST", path: "/disputes", successStatus: 201 })
    .meta(PARTE_DEL_STAGE)
    .input(openDisputeSchema)
    .output(disputeSchema),

  listar: base
    .route({ method: "GET", path: "/disputes" })
    .meta(DEL_PROYECTO)
    .input(listDisputesQuerySchema)
    .output(z.array(disputeSchema)),

  resolver: base
    .route({ method: "POST", path: "/disputes/{id}/resolve" })
    .meta(CERTIFICADOR_DEL_PROYECTO)
    .errors({
      NOT_FOUND: { status: 404, message: "Dispute not found" },
      DISPUTE_ALREADY_RESOLVED: { status: 409, message: "Dispute is already resolved" },
      REFUND_WITHOUT_RELEASE: {
        status: 409,
        message: "No payment was released for this stage, so no refund can be agreed"
      }
    })
    .input(resolveDisputeSchema.extend({ id: cuidParamSchema }))
    .output(disputeSchema)
};
