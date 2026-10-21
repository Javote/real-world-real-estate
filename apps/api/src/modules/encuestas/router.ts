import { implement } from "@orpc/server";
import { contrato } from "@plataforma/shared/contract";
import { guardOrpc } from "../../middlewares/guard-orpc.js";
import type { Contexto } from "../../platform/contexto.js";
import { valor } from "../../platform/resultado.js";
import * as casos from "./casos.js";

const impl = implement(contrato.encuestas).$context<Contexto>().use(guardOrpc);

export const encuestasRouter = impl.router({
  responder: impl.responder.handler(async ({ context, input, errors }) =>
    valor(
      await casos.responder(context, {
        token: input.token,
        score: input.score,
        comment: input.comment
      }),
      errors
    )
  ),
  resumen: impl.resumen.handler(({ context }) => casos.resumen(context, undefined))
});
