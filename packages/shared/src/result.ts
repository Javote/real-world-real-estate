import type { ErrorCode } from "./errors";

/** Lo que devuelve un caso de uso: el valor, o el código de error con el detalle que lo acompaña. */
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E extends ErrorCode, D = undefined> = {
  readonly ok: false;
  readonly code: E;
  readonly details: D;
};
export type Result<T, E extends ErrorCode = ErrorCode, D = undefined> = Ok<T> | Err<E, D>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

export function err<E extends ErrorCode>(code: E): Err<E>;
export function err<E extends ErrorCode, D>(code: E, details: D): Err<E, D>;
export function err<E extends ErrorCode, D>(code: E, details?: D): Err<E, D | undefined> {
  return { ok: false, code, details };
}
