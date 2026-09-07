import { type Request, Router } from "express";
import { db } from "../lib/db";
import { authenticate, authorize, CUALQUIER_ROL } from "../middlewares/auth";

// Contratos y liberaciones (M2-D5 filas 23-24, 40-41) — **M3-SC-03**.
//
// **Cada liberación es su propio evento on-chain** (M2-D4 P10): el contrato es
// una entidad lógica, el artefacto anclado es cada release. Y "release"
// significa **anclar el evento de liberación**, no ejecutar un pago (D-021): la
// plataforma no mueve un centavo, registra que se liberó.

const router = Router();

router.use(authenticate);

/** Fila 23-24 — las liberaciones del contrato, cada una con su TXID (P10). */
/**
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
  async (req: Request<{ contractId: string }>, res) => {
    const contrato = await db
      .selectFrom("Contract")
      .select("id")
      .where("id", "=", req.params.contractId)
      .executeTakeFirst();

    if (!contrato) return res.status(404).json({ message: "Contract not found" });

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

    return res.json(releases);
  }
);

export default router;
