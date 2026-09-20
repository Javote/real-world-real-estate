# SPEC-208 — Que los tipos de `apps/api` digan la verdad

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-backend.md`](AUDITORIA-2026-09-11-calidad-del-backend.md)
> §B-12 y §B-10. Nivel 🟢. **Independiente.** No toca ningún criterio del SOM.
>
> Van juntos porque son la misma deuda en dos capas —**el compilador afirma algo que el runtime no
> cumple**— y porque los dos son **cero cambio de comportamiento**: ni un byte del JSON de la API se
> mueve. Es la spec que más rinde por hora de la serie.

## B-12 · El paquete con la config de tipos más floja de los tres

`packages/shared` y `packages/cardano` tienen `noUncheckedIndexedAccess: true` y
`exactOptionalPropertyTypes: true`. **`apps/api` —el paquete más grande, y el que tiene la
autorización— tiene solo `strict: true`.**

**Medido, no estimado.** Prender `noUncheckedIndexedAccess` sobre `src` da **21 errores en 10
archivos**, revisados uno por uno:

| Archivo | Errores | Qué son |
|---|---:|---|
| `routes/projects.routes.ts` | 7 | 4 del destructuring de `bbox` (el regex de Zod ya garantiza los 4 números), 3 de `req.params.id` |
| `routes/audit.routes.ts` | 3 | indexación del array de la mediana |
| `middlewares/errorHandler.ts` | 3 | `CONSTRAINT_ERRORS[restriccion]`, ya protegido por el `in` de `codigoDeRestriccion` |
| resto (7 archivos) | 8 | `req.params.x` tipado `string \| string[] \| undefined` en Express 5 |

**Ninguno es un bug latente.** La mayoría es el `string | string[]` de los params de Express 5 — el
mismo problema que `auth.ts` trata con cuidado quirúrgico en `leerParam`, con un comentario de ocho
líneas sobre por qué elegir el primero en silencio sería el peor bug posible en la capa de
autorización. **Esa disciplina está en el guard y no llegó a los handlers**, que hacen
`req.params.id` directo o se lo declaran con `Request<{ id: string }>` a mano, ruta por ruta.

**El arreglo:** subir las dos flags y arreglar los 21. Trabajo mecánico, y deja a los tres paquetes
TypeScript bajo la misma vara — que es lo que uno esperaría que ya fuera cierto leyendo el resto del
repo.

## B-10 · Cinco columnas dicen `Date` y devuelven `number`

`compiledAt`, `readAt`, `releasedAt`, `respondedAt` y `signedAt` están declaradas `SqliteTimestamp` en
`db/types.ts` —o sea `Date` al leer— y **no están** en `TIMESTAMP_COLUMNS` del plugin de coerción.

Está declarado, con un `⚠` y un motivo razonable (`db/sqlite-type-plugin.ts:30`): agregarlas cambia la
forma del JSON de la API —`Date` serializa a string ISO, `number` a número— y **las cinco ya tienen
consumidores en el front**.

Lo que cuesta no es la deuda, es lo que enseñó. Los call sites aprendieron a desconfiar del tipo:

```ts
compiledAt: new Date(fila.compiledAt),                        // domain/dossier.ts:207
function mesUtc(fecha: Date | number): string                 // capital.routes.ts:84
const ms = (fecha: Date | null) => new Date(fecha).getTime(); // developer-comercial.routes.ts:308
```

Cada uno funciona. **Juntos instalan la costumbre de envolver toda fecha en `new Date()` por las
dudas, que es exactamente lo que un tipo existe para evitar.**

**El arreglo, mientras la rebanada de verdad no llegue: que el tipo diga la verdad.**
`ColumnType<number, Date | number, Date | number>` para esas cinco. **No cambia un byte del runtime ni
del JSON**, y el compilador pasa a pedir la conversión *donde hace falta* en vez de dejar que cada
call site la haga por las dudas. Cuando la rebanada llegue, se suman al plugin y el tipo vuelve a
`Date` en el mismo commit.

## Invariantes

1. **Los tres paquetes TypeScript comparten la misma vara de tipos.**
2. **Ningún tipo de columna afirma una forma que el runtime no entrega.**
3. **Cero cambio en la API**: mismos cuerpos, mismos tipos JSON, mismos tests verdes sin tocarlos.
4. **Ningún `as` nuevo para callar el compilador.** Si un caso de los 21 pide un cast, se resuelve con
   la forma de `leerParam` o se anota por qué no se pudo.

## Casos borde

| Caso | Esperado |
|---|---|
| `req.params.id` en un handler | se lee con la forma segura, no con `!` ni con un cast |
| `bbox` destructurado | el regex de Zod sigue siendo la garantía; el tipo la refleja en vez de asumirla |
| `CONSTRAINT_ERRORS[restriccion]` | el `in` ya lo protege; el tipo lo dice |
| Un `new Date(fila.compiledAt)` que sobra | se puede borrar **solo si el tipo ya lo garantiza**; si no, se deja y se anota |
| Las 356 pruebas | verdes **sin modificar ninguna** — si una necesita cambiar, algo del comportamiento se movió y hay que mirarlo |

## Cerrada — 2026-09-19

**B-12.** `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` ya están en
`apps/api/tsconfig.json`. El recuento real fue mayor al estimado (~40 sitios, no 21 — la auditoría
solo había medido `noUncheckedIndexedAccess` sobre `src/`, y las dos flags juntas más `scripts/` y
`test/` suman más superficie), pero la naturaleza de cada arreglo es la que la spec preveía. Dos
helpers nuevos, reusados en vez de un cast por sitio: `lib/params.ts` (`paramSeguro`, la forma que
`leerParam` ya usaba en `auth.ts`, ahora general) y `lib/arrays.ts` (`en`, para índice fijo
garantizado por construcción — regex ya validado, posición conocida de un split). Cero `as` nuevo.

**B-10.** Las cinco columnas (`Invitation.respondedAt`, `Contract.signedAt`,
`PaymentAttestation.releasedAt`, `Dossier.compiledAt`, `Dossier.signedAt`, `Notification.readAt` —
seis sitios, cinco nombres) pasaron a `SqliteTimestampSinCoercion`. Cero cambio en el plugin de
coerción, cero cambio en el JSON servido.

**Los tres ejemplos de "aprendió a desconfiar del tipo", revisados uno por uno:**

- `developer-comercial.routes.ts:308` (`ms`) — **borrado.** `contrato.signedAt`/`c.respondedAt` ya
  son `number | null` con el tipo corregido; la función envolvía algo que ya no hacía falta envolver.
- `capital.routes.ts:87` (`mesUtc`) — **sin cambios, y no hace falta ninguno.** Su firma ya era
  `Date | number`: aceptaba las dos formas desde antes de esta spec, así que no es un caso de
  "desconfiar del tipo" — ya estaba escrita para el tipo correcto.
- `domain/dossier.ts:207-215` (`new Date(fila.compiledAt)`, `new Date(fila.signedAt)`) — **sin
  cambios, y es el caso correcto de no tocar.** `CompiledDossier extends Dossier`
  (`@plataforma/shared`), y `Dossier.compiledAt`/`signedAt` son `Date`, no `number`. El wrapping no
  es desconfianza: es la conversión real que el tipo de salida exige. Es exactamente el caso que la
  fila de arriba de esta tabla anticipaba — "se puede borrar solo si el tipo ya lo garantiza", y acá
  no lo garantiza.

**Efecto colateral encontrado y cerrado en el mismo commit, no en la spec original:**
`notary.routes.ts` comparaba `Dossier.signedAt` (ahora correctamente `number`) contra
`new Date(parsed.data.cursor)` en la paginación por cursor — un bug latente de producción
(comparación de tipos SQLite distintos que dependía de que el tipo mintiera para "funcionar" por
coincidencia de representación). Fix: `.getTime()` en el bind parameter.

**Verificación:** `pnpm --filter @plataforma/api typecheck` limpio, 424 tests verdes (3 skip,
preexistentes) sin tocar ninguno, `pnpm verify` completo (lint + typecheck + testids + test + build,
los 4 paquetes) verde.
