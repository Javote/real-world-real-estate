import type { Client } from "@orpc/client";
import type { AnyContractRouter, ContractRouterClient } from "@orpc/contract";
import type { Serialized } from "../serialize";

/**
 * El contrato de la API (D-102): path, método, input, output, errores y `meta.guard` de cada
 * procedimiento. Vacío hasta que A3 mude el primer módulo (SPEC-607, SPEC-615): la API lo implementa
 * y la web arma su cliente con él (SPEC-609).
 */
export const contrato = {} satisfies AnyContractRouter;

/** El cliente como llega por el cable: una fecha del output es `string`, igual que en la web. */
export type ClienteCable<T> =
  T extends Client<infer C, infer I, infer O, infer E>
    ? Client<C, I, Serialized<O>, E>
    : { [K in keyof T]: ClienteCable<T[K]> };

export type ApiClient = ClienteCable<ContractRouterClient<typeof contrato>>;
