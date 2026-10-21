import { implement } from "@orpc/server";
import { contrato } from "@plataforma/shared/contract";
import { guardOrpc } from "../../middlewares/guard-orpc.js";
import type { Contexto } from "../../platform/contexto.js";
import * as casos from "./casos.js";

const impl = implement(contrato.metricas).$context<Contexto>().use(guardOrpc);

export const metricasRouter = impl.router({
  completitud: impl.completitud.handler(({ context, input }) =>
    casos.completitud(context, input.projectId)
  )
});
