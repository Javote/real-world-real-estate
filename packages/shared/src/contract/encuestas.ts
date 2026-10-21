import { oc } from "@orpc/contract";
import { npsSummarySchema, npsSurveyResponseSchema, respondNpsSurveySchema } from "../nps";
import { hex64ParamSchema } from "../params";
import type { MetaDeProcedimiento } from "./guard";

const base = oc.$meta<MetaDeProcedimiento>({});

export const encuestasContrato = {
  // Sin sesión a propósito: el link de la notificación tiene que poder responderse sin loguearse.
  responder: base
    .route({ method: "POST", path: "/investor/surveys/{token}/respond" })
    .meta({ guard: { sinSesion: true } })
    .errors({
      NOT_FOUND: { status: 404, message: "Survey not found" },
      SURVEY_ALREADY_ANSWERED: { status: 409, message: "Survey already answered" }
    })
    .input(respondNpsSurveySchema.extend({ token: hex64ParamSchema }))
    .output(npsSurveyResponseSchema),

  resumen: base
    .route({ method: "GET", path: "/admin/nps" })
    .meta({ guard: { roles: ["admin"], acceso: "soloRol" } })
    .output(npsSummarySchema)
};
