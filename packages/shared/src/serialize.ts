// Un primitivo sale tal cual, también con marca (`ids.ts`): `string & $brand` extiende `object`.
export type Serialized<T> = T extends Date
  ? string
  : T extends string | number | boolean | bigint | null | undefined
    ? T
    : T extends (infer U)[]
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;
