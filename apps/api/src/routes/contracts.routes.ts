import { contractReleaseSchema, cuidParamSchema } from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import { reconciliarParaLectura } from "../domain/reconcile";
import { db } from "../lib/db";
import { OpenAPIHandler, ORPCError, os } from "../lib/orpc";
import { authenticate, authorize, CUALQUIER_ROL } from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";

// Contratos y liberaciones (M2-D5 filas 23-24, 40-41) — **M3-SC-03**.
//
// **Cada liberación es su propio evento on-chain** (M2-D4 P10): el contrato es
// una entidad lógica, el artefacto anclado es cada release. Y "release"
// significa **anclar el evento de liberación**, no ejecutar un pago (D-021): la
// plataforma no mueve un centavo, registra que se liberó.
//
// **SPEC-216 §E3 — migrado a oRPC (D-066).** `authorize` sigue evaluando la
// única regla `{ alguna: [...] }` de toda la API ANTES de que oRPC vea la
// request (middleware Express, sin cambiar de capa, invariante 3 de
// SPEC-212) — para oRPC es una request que ya pasó `authorize` o una que
// nunca llega, no tiene que saber que la regla es disyuntiva. Sin `$context`:
// el procedimiento nunca toca `req.user`.

const PREFIJO_ABSOLUTO = "/api/v1/contracts";

const router = Router();

router.param("contractId", paramValidator(cuidParamSchema));

router.use(authenticate);

/**
 * Fila 23-24 — las liberaciones del contrato, cada una con su TXID (P10).
 *
 * **La única regla disyuntiva de la API**, y la razón por la que `authorize`
 * tiene `alguna`: las liberaciones las ve el investor **dueño** del contrato, o
 * cualquiera con **membresía** en el proyecto. Una cadena de middlewares es un
 * AND, así que con los guards sueltos esto no se podía declarar y vivía como
 * veinte líneas adentro del handler.
 *
 * Las dos ramas resuelven la misma fila por caminos distintos: `dueño` compara
 * `Contract.investorId`, `proyecto` sube por `Contract → Unit → projectId`. Un
 * contrato inexistente da 404 en las dos, y `evaluarRegla` devuelve ese 404;
 * si existe y ninguna rama pasa, gana el 403.
 */
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

    if (!contrato) throw new ORPCError("NOT_FOUND", { message: "Contract not found" });

    // **Reconciliar antes de consultar** (D-077): esta respuesta lleva
    // `anchorStatus`, y sin esto un anclaje que ya está en un bloque se sirve
    // como `Pending` para siempre. La regla vive en `reconcile.ts`: toda
    // lectura que devuelva el estado de un anclaje reconcilia su propio
    // alcance primero. Lo fija `test/reconcile-on-read.test.ts`.
    await reconciliarParaLectura({ projectId: contrato.projectId });

    // Cada release con su TXID (patrón P10). El vínculo es `referenceId`, que
    // guarda el id del propio release: buscarlos por su commitment no sirve
    // —el commitment incluye el timestamp de liberación— y sin la ref no había
    // forma de volver del registro off-chain a su transacción.
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
  async (req, res, next) => {
    const { matched } = await releasesHandler.handle(req, res, { prefix: PREFIJO_ABSOLUTO });
    if (!matched) next();
  }
);

/** El router oRPC combinado de esta vertical — lo consume
 * `scripts/generate-openapi.ts` para generar el fragmento de OpenAPI de la
 * única ruta migrada. */
export const contractsOrpcRouter = {
  releasesProcedure
};

export default router;
