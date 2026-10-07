# packages/shared — el contrato API↔web

> Se carga solo al tocar este subárbol.

Zod + los tipos inferidos. Todo lo que cruza la frontera entre `apps/api` y `apps/web` se
declara **una sola vez acá** (D-012, regla 6): si una respuesta cambia de forma y el schema no,
falla el typecheck de los dos lados.

## Cómo agregar un contrato

1. El schema va acá **antes** que el endpoint.
2. Exportá el schema *y* el tipo inferido; re-exportá desde `src/index.ts`.
3. La API valida con `safeParse` y **tipa la respuesta** con el tipo inferido.
4. El front importa **solo tipos** (`import type`).
5. Un test por cada regla que el schema defiende.

## Resolución

| Quién | Resuelve a |
|---|---|
| typecheck de api y web | `dist/index.d.ts` (`types`) |
| runtime de la API (CJS) | `dist/index.js` (`main`) |
| tests de la API | el fuente, por alias en `vitest.config.mts` |
| runtime del front | nada (solo tipos), salvo las entradas sin dependencias como `@plataforma/shared/evidence-rules` y `@plataforma/shared/errors`, que apuntan al `.ts`, y `@plataforma/shared/contract.min.json` |
| el contrato de oRPC | `@plataforma/shared/contract` (`dist/contract/`), una entrada aparte del índice: `cardano` no lo carga nunca |

`pnpm typecheck` reconstruye este package antes de verificar, y `prepare` lo compila en cada
`pnpm install`.

## Trampas

- **Todo schema de respuesta va `.strict()`**: sin él, Zod descarta claves desconocidas y un
  `passwordHash` filtrado pasa en silencio.
- **Las fechas viajan como string ISO en UTC** (`z.string().datetime()`), no como `Date`.
- **Un schema con marca se anota con `IdConMarca<"…">`** (`ids.ts`): con el tipo inferido, el `.d.ts`
  despliega el `string` en un objeto y del lado de la web deja de ser asignable a `string`.
- **Los tests de este package no se typechequean** (`tsconfig.json` los excluye): una aserción de
  tipos (`expectTypeOf`, `@ts-expect-error`) va en `apps/api/test/cimientos-tipos.test.ts`.
- **El package es CommonJS** (D-102; la API es ESM y lo importa igual): el front no puede importar
  valores por el índice. Un valor que el front necesite va en un módulo sin dependencias con su propia entrada en
  `exports`.
- **Compila con `module: nodenext`, sin dejar de ser CommonJS**: `@orpc/contract` y `@orpc/client`
  son solo ESM, y `node16` rechaza hasta un `import type` de ellos (TS1541). `nodenext` lo acepta
  porque Node 22 hace `require()` de un ESM; el JS que emite es el mismo. Pasar el package a ESM de
  verdad (`"type": "module"` y `.js` en los imports relativos, también en `cardano`) queda para
  después.
- **`contract.min.json` se commitea**: después de tocar el contrato,
  `pnpm --filter @plataforma/shared contract:min`. `contract.test.ts` lo compara con lo que generaría.
