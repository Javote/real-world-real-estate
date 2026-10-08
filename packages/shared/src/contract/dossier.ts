import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  dossierRejectResultSchema,
  dossierSchema,
  dossierShareSchema,
  dossierSignResultSchema,
  notarySignatureSchema,
  publicDossierSchema,
  rejectDossierSchema
} from "../dossier";
import { cursorPaginationSchema, paginatedResponseSchema } from "../pagination";
import { notaryKpisSchema, pendingDossierSchema } from "../panels";
import { cuidParamSchema, hex64ParamSchema } from "../params";
import type { MetaDeProcedimiento } from "./guard";

const base = oc.$meta<MetaDeProcedimiento>({});

// El escribano no tiene membresía por proyecto: la cola es compartida (SPEC-615, decisión 1).
const NOTARY_SOLO_ROL = {
  guard: { roles: ["admin", "notary"], acceso: "soloRol" }
} satisfies MetaDeProcedimiento;
const NOTARY_LO_SUYO = {
  guard: { roles: ["admin", "notary"], acceso: { scopeEnQuery: "Dossier.signedById = usuario" } }
} satisfies MetaDeProcedimiento;
const DUEÑO_DE_LA_UNIDAD = {
  guard: { roles: ["admin", "buyer"], acceso: { dueño: { via: "Unit", param: "id" } } }
} satisfies MetaDeProcedimiento;

const NO_ENCONTRADO = { NOT_FOUND: { status: 404, message: "Dossier not found" } };
const porId = z.strictObject({ id: cuidParamSchema });

/** Un archivo en la respuesta: el handler devuelve un `File` y oRPC lo manda como binario. */
type Binario = { readonly size: number; readonly type: string };
const binario = z.custom<Binario>(
  (v) => typeof v === "object" && v !== null && "arrayBuffer" in v && "size" in v
);

export const dossierContrato = {
  notary: {
    kpis: base
      .route({ method: "GET", path: "/notary/kpis" })
      .meta(NOTARY_LO_SUYO)
      .output(notaryKpisSchema),

    pendientes: base
      .route({ method: "GET", path: "/notary/dossiers/pending" })
      .meta(NOTARY_SOLO_ROL)
      .output(z.array(pendingDossierSchema)),

    porId: base
      .route({ method: "GET", path: "/notary/dossiers/{id}" })
      .meta(NOTARY_SOLO_ROL)
      .errors(NO_ENCONTRADO)
      .input(porId)
      .output(dossierSchema),

    firmar: base
      .route({
        method: "POST",
        path: "/notary/dossiers/{id}/sign",
        outputStructure: "detailed",
        successStatus: 201
      })
      .meta(NOTARY_SOLO_ROL)
      .errors({
        ...NO_ENCONTRADO,
        DOSSIER_NOT_SIGNABLE: { status: 409, message: "Dossier is not awaiting signature" }
      })
      .input(porId)
      .output(
        z.union([
          z.strictObject({ status: z.literal(200), body: dossierSignResultSchema }),
          z.strictObject({ status: z.literal(201), body: dossierSignResultSchema })
        ])
      ),

    rechazar: base
      .route({ method: "POST", path: "/notary/dossiers/{id}/reject" })
      .meta(NOTARY_SOLO_ROL)
      .errors({
        ...NO_ENCONTRADO,
        DOSSIER_SIGNED: { status: 409, message: "Dossier already signed" },
        DOSSIER_NOT_REJECTABLE: { status: 409, message: "Dossier is not awaiting review" }
      })
      .input(rejectDossierSchema.extend({ id: cuidParamSchema }))
      .output(dossierRejectResultSchema),

    firmas: base
      .route({ method: "GET", path: "/notary/signatures" })
      .meta(NOTARY_LO_SUYO)
      .input(cursorPaginationSchema)
      .output(paginatedResponseSchema(notarySignatureSchema))
  },

  investor: {
    dossier: base
      .route({ method: "GET", path: "/investor/units/{id}/dossier" })
      .meta(DUEÑO_DE_LA_UNIDAD)
      .errors(NO_ENCONTRADO)
      .input(porId)
      .output(dossierSchema),

    exportar: base
      .route({
        method: "GET",
        path: "/investor/units/{id}/dossier/export.pdf",
        outputStructure: "detailed"
      })
      .meta(DUEÑO_DE_LA_UNIDAD)
      .errors(NO_ENCONTRADO)
      .input(porId)
      .output(z.object({ headers: z.record(z.string(), z.string()).optional(), body: binario })),

    compartir: base
      .route({ method: "POST", path: "/investor/units/{id}/dossier/share", successStatus: 201 })
      .meta(DUEÑO_DE_LA_UNIDAD)
      .errors(NO_ENCONTRADO)
      .input(porId)
      .output(dossierShareSchema)
  },

  publico: {
    dossier: base
      .route({ method: "GET", path: "/public/dossier/{shareToken}" })
      .meta({ guard: { sinSesion: true } })
      .errors(NO_ENCONTRADO)
      .input(z.strictObject({ shareToken: hex64ParamSchema }))
      .output(publicDossierSchema)
  }
};
