import { implement } from "@orpc/server";
import { contrato } from "@plataforma/shared/contract";
import { guardOrpc } from "../../middlewares/guard-orpc.js";
import type { Contexto } from "../../platform/contexto.js";
import { valor } from "../../platform/resultado.js";
import * as casos from "./casos.js";

const impl = implement(contrato.dossier).$context<Contexto>().use(guardOrpc);

// Con guard, `usuario` siempre está: sin sesión, `guardOrpc` ya contestó 401.
export const dossierRouter = impl.router({
  notary: {
    kpis: impl.notary.kpis.handler(({ context }) =>
      casos.kpis(context, context.usuario!.role === "admin" ? null : context.usuario!.id)
    ),
    pendientes: impl.notary.pendientes.handler(({ context }) => casos.cola(context)),
    porId: impl.notary.porId.handler(async ({ context, input, errors }) =>
      valor(await casos.leerPorId(context, input.id), errors)
    ),
    firmar: impl.notary.firmar.handler(async ({ context, input, errors }) =>
      valor(
        await casos.firmar(context, { dossierId: input.id, notaryId: context.usuario!.id }),
        errors
      )
    ),
    rechazar: impl.notary.rechazar.handler(async ({ context, input, errors }) =>
      valor(
        await casos.rechazar(context, {
          dossierId: input.id,
          notaryId: context.usuario!.id,
          nota: input.note
        }),
        errors
      )
    ),
    firmas: impl.notary.firmas.handler(({ context, input }) =>
      casos.firmasDe(context, {
        limit: input.limit,
        cursor: input.cursor,
        signedById: context.usuario!.role === "admin" ? null : context.usuario!.id
      })
    )
  },

  investor: {
    dossier: impl.investor.dossier.handler(async ({ context, input, errors }) =>
      valor(await casos.leerDeLaUnidad(context, input.id), errors)
    ),
    exportar: impl.investor.exportar.handler(async ({ context, input, errors }) => {
      const { nombreArchivo, pdf } = valor(
        await casos.exportar(context, { unitId: input.id, actorId: context.usuario!.id }),
        errors
      );
      return {
        headers: { "content-disposition": `attachment; filename="${nombreArchivo}"` },
        body: new File([Uint8Array.from(pdf)], nombreArchivo, { type: "application/pdf" })
      };
    }),
    compartir: impl.investor.compartir.handler(async ({ context, input, errors }) =>
      valor(
        await casos.compartir(context, { unitId: input.id, actorId: context.usuario!.id }),
        errors
      )
    )
  },

  publico: {
    dossier: impl.publico.dossier.handler(async ({ context, input, errors }) =>
      valor(await casos.leerPublico(context, input.shareToken), errors)
    )
  }
});
