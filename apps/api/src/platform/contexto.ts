import type { AnchorPort } from "@plataforma/cardano";
import type { Request } from "express";
import type { Database } from "../db/types.js";
import { anchorPortListo } from "../lib/anchor.js";
import { db } from "../lib/db.js";
import type { Kysely } from "../lib/kysely.js";
import { type StoragePort, storage } from "../lib/storage.js";
import { type Entorno, entorno } from "./config.js";

/**
 * Lo que recibe un procedimiento oRPC en vez de importarlo: un test lo llama con
 * `call(proc, input, { context })` y le pasa lo suyo, sin supertest ni `vi.mock`.
 */
export type Contexto = {
  db: Kysely<Database>;
  anchor: () => Promise<AnchorPort>;
  storage: StoragePort;
  clock: () => Date;
  readonly config: Entorno;
  authorization: string | undefined;
};

export function contextoDeRequest(req: Request): Contexto {
  return {
    db,
    anchor: anchorPortListo,
    storage,
    clock: () => new Date(),
    // Por llamada, como cada archivo leía el entorno antes de A0.2: no se parsea si nadie lo pide.
    get config() {
      return entorno();
    },
    authorization: req.headers.authorization
  };
}
