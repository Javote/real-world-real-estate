import { oc } from "@orpc/contract";
import { documentCompletenessQuerySchema, documentCompletenessSchema } from "../pilot-metrics";
import type { MetaDeProcedimiento } from "./guard";

const base = oc.$meta<MetaDeProcedimiento>({});

// Números de negocio agregados de todos los proyectos: solo el admin (SPEC-501).
const SOLO_ADMIN = { guard: { roles: ["admin"], acceso: "soloRol" } } satisfies MetaDeProcedimiento;

export const metricasContrato = {
  completitud: base
    .route({ method: "GET", path: "/admin/document-completeness" })
    .meta(SOLO_ADMIN)
    .input(documentCompletenessQuerySchema)
    .output(documentCompletenessSchema)
};
