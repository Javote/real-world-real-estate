import type { Client } from "@orpc/client";
import type { AnyContractRouter, ContractRouterClient } from "@orpc/contract";
import type { Serialized } from "../serialize";
import { disputasContrato } from "./disputas";
import { dossierContrato } from "./dossier";
import { metricasContrato } from "./metricas";

export type * from "./guard";

/**
 * El contrato de la API (D-102): path, método, input, output, errores y `meta.guard` de cada
 * procedimiento, un módulo por clave. La API lo implementa y la web arma su cliente con él (SPEC-609).
 */
export const contrato = {
  dossier: dossierContrato,
  disputas: disputasContrato,
  metricas: metricasContrato
} satisfies AnyContractRouter;

/** El cliente como llega por el cable: una fecha del output es `string`, igual que en la web. */
export type ClienteCable<T> =
  T extends Client<infer C, infer I, infer O, infer E>
    ? Client<C, I, Serialized<O>, E>
    : { [K in keyof T]: ClienteCable<T[K]> };

export type ApiClient = ClienteCable<ContractRouterClient<typeof contrato>>;
