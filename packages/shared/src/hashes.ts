import { z } from "zod";

export const sha256HexSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "No es un SHA-256 en hex minúscula de 64 caracteres");

export const txidSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, "No es un TXID: hex de 64 caracteres");

export const outputRefSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{64}#\d+$/, "No es un outputRef: <txid>#<índice>");
