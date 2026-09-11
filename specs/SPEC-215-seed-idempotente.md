# SPEC-215 — `pnpm db:seed` revienta sobre una base ya sembrada

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-frente.md`](AUDITORIA-2026-09-11-calidad-del-frente.md)
> §Anexo (se topó levantando el entorno; el archivo es de `apps/api`). Nivel 🟢. **Independiente.**
> No toca ningún criterio del SOM.

## El problema, en una frase

`sembrarUnidadVendida` (`apps/api/src/db/fixtures.ts`) hace
`.onConflict(...).doNothing().executeTakeFirstOrThrow()`, que **por definición no devuelve fila cuando
la fila ya existe**: tira `NoResultError`. Pasa en los dos inserts de la función —la `Unit`
(`onConflict` sobre `projectId, unitReference`) y el `Contract` (sobre `unitId`)—.

Y deja la base **a medio aplicar**: `sembrarUsuarios` corre antes de la falla, así que los usuarios sí
quedan resembrados y el resto no. **Es la regla 8 (idempotencia) en un lugar donde no estaba
escrita** — y el único lugar donde se nota es el que más se usa: levantar el entorno de vuelta.

## Qué se cambia

`doNothing()` + `executeTakeFirstOrThrow()` es una contradicción: o se tolera el conflicto y se relee,
o no se tolera. La forma correcta es la que el resto del archivo ya insinúa:

- **insertar con `onConflict().doNothing()`**, y
- **releer la fila por su clave natural** si el insert no devolvió nada.

El resultado es el mismo id en la primera corrida y en la décima.

**Se revisa el archivo entero con ese criterio**, no solo esta función: hay al menos cuatro
`onConflict` más en `fixtures.ts` y la pregunta —"¿qué devuelve esto la segunda vez?"— aplica a todos.

## Invariantes

1. **`pnpm db:seed` es idempotente** (regla 8): correrlo N veces deja la base igual que correrlo una.
2. **No deja la base a medio aplicar**: o siembra todo, o falla sin haber escrito nada relevante.
3. **Los ids no cambian entre corridas** para las entidades que ya existían — un id que se mueve
   invalida cualquier link, TXID o captura que alguien haya guardado.
4. El seed **no pre-marca ninguna etapa `Completed`** (ya cerrado en la Tanda 2.5 del plan de entrega)
   y esta spec no lo reintroduce.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| Seed sobre base vacía | igual que hoy |
| Seed sobre base ya sembrada | termina bien, mismos ids, sin `NoResultError` |
| Seed sobre base sembrada **a medias** (el estado que este bug produce) | completa lo que falta |
| Dos seeds en paralelo | no es un caso real; **no se soporta** y se anota |

## Y el otro anexo de la misma auditoría

El warning de `routes/login.test.tsx` en cada `pnpm dev` está en
[`SPEC-108`](SPEC-108-higiene-de-componentes.md), porque es del frente.
