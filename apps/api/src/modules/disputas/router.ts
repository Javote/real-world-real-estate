import { implement } from "@orpc/server";
import { contrato } from "@plataforma/shared/contract";
import { guardOrpc } from "../../middlewares/guard-orpc.js";
import type { Contexto } from "../../platform/contexto.js";
import { valor } from "../../platform/resultado.js";
import * as casos from "./casos.js";

const impl = implement(contrato.disputas).$context<Contexto>().use(guardOrpc);

// Con guard, `usuario` siempre está: sin sesión, `guardOrpc` ya contestó 401.
export const disputasRouter = impl.router({
  abrir: impl.abrir.handler(({ context, input }) =>
    casos.abrir(context, {
      stageId: input.stageId,
      reason: input.reason,
      actorId: context.usuario!.id
    })
  ),
  listar: impl.listar.handler(({ context, input }) =>
    casos.listar(context, { projectId: input.projectId, status: input.status })
  ),
  resolver: impl.resolver.handler(async ({ context, input, errors }) =>
    valor(
      await casos.resolver(context, {
        id: input.id,
        outcome: input.outcome,
        resolution: input.resolution,
        actorId: context.usuario!.id
      }),
      errors
    )
  )
});
