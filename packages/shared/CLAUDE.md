# packages/shared — el contrato API↔web

> Se carga solo al tocar este subárbol.

Zod + los tipos inferidos. Todo lo que cruza la frontera entre `apps/api` y `apps/web` se
declara **una sola vez acá** (D-012, regla 6). Es lo único que vuelve el drift API↔web
*imposible* en vez de meramente prohibido: si una respuesta cambia de forma y el schema no,
falla el typecheck de los dos lados. Verificado.

## Cómo agregar un contrato

1. El schema va acá **antes** que el endpoint.
2. Exportá el schema *y* el tipo inferido; re-exportá desde `src/index.ts`.
3. La API valida con `safeParse` y **tipa la respuesta** con el tipo inferido — ese tipado es lo
   que impide que un campo nuevo del modelo se filtre por un spread distraído.
4. El front importa **solo tipos** (`import type`): no carga Zod en runtime.
5. Un test por cada regla que el schema defiende.

## Resolución: por qué está armado así

Tres consumidores con necesidades distintas, y la respuesta no es la misma para los tres:

| Quién | Resuelve a | Por qué |
|---|---|---|
| typecheck de api y web | `dist/index.d.ts` (`types`) | Un `.d.ts` **nunca se emite**, así que no cae bajo el `rootDir` del consumidor — que es el error que da apuntar al fuente |
| runtime de la API (CJS) | `dist/index.js` (`main`) | La API es CommonJS y lo carga con `require()` |
| tests de la API | **el fuente**, por alias en `vitest.config.mts` | Ni compilar antes de testear, ni riesgo de testear contra un `dist` viejo |
| runtime del front | nada | Importa solo tipos; `verbatimModuleSyntax` los borra |

**`pnpm typecheck` reconstruye este package antes de verificar.** No es ceremonia: verificar
contra un `dist` viejo es un verde falso, que es peor que un rojo. `prepare` lo compila también
en cada `pnpm install`, para que un clone fresco pueda correr `pnpm dev` sin pasos extra.

## Trampas

- **`.strict()` no es decorativo.** Sin él, Zod **descarta** las claves desconocidas en silencio:
  un `passwordHash` filtrado pasaría el schema sin que nadie se entere. Con `.strict()`, falla.
  Todo schema de respuesta va estricto.
- **Las fechas viajan como string ISO en UTC** (`z.string().datetime()`), no como `Date`: JSON no
  tiene tipo fecha, y la regla 1 pide UTC.
- Este package es **CommonJS** (sin `"type": "module"`). Si algún día necesita ESM, hay que mirar
  primero cómo lo consume la API, que es CJS por D-016.
