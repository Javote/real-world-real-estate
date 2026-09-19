// SPEC-109 (F-13) — `api/types.ts` en `apps/web` es 414 líneas de espejo
// manual, y 20 de sus 31 tipos ya tienen schema Zod acá. La razón por la que
// no se reusaba el tipo inferido tal cual (`z.infer<typeof schema>`) es real,
// no desidia: los schemas usan `z.coerce.date()`, así que el tipo inferido
// dice `Date` mientras el cable manda JSON — un `string`. Reusar el tipo
// crudo tipa `createdAt` como `Date` en el front cuando en runtime es un
// `string`, y `.toISOString()` explota.
//
// `Serialized<T>` es la salida: recorre el tipo y cambia `Date` por
// `string`, dejando todo lo demás igual — arrays y objetos se recorren,
// `null`/`undefined` sobreviven porque las uniones se distribuyen solas. Un
// tipo derivado no puede divergir del schema: si el schema gana un campo, el
// tipo lo gana; si lo pierde, el front no compila. Es la misma economía que
// el package entero (D-012): volver el drift imposible, no prohibido.
export type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;
