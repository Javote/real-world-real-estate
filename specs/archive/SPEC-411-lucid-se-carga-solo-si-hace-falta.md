# SPEC-411 — Lucid se carga solo si hace falta: 2 s y 121 MB por proceso

> **Origen:** [`AUDITORIA-2026-09-11-calidad-de-packages.md`](AUDITORIA-2026-09-11-calidad-de-packages.md)
> §T-01. Nivel 🟢. **Independiente.** No toca ningún criterio del SOM. **Medido, no estimado.**

## El problema, en una frase

`@lucid-evolution/lucid` se carga en **todo** proceso que toque `@plataforma/cardano`, ancle o no —
incluidos los 335 tests de `apps/api`, `pnpm dev` y el camino `disabled`.

## Medido

`require()` en un proceso Node limpio, contra el `dist` compilado:

| Qué se carga | Tiempo | Heap | Módulos |
|---|---:|---:|---:|
| `@plataforma/cardano` entero (hoy) | **2015 ms** | **121,0 MB** | 1758 (453 de Lucid/harmoniclabs) |
| solo `simulated` + `disabled` + `ledger` | 160 ms | 14,3 MB | 103 |

## La cadena, y por qué no hay salida hoy

```
apps/api/src/lib/anchor.ts
  → import { createAnchorPort } from "@plataforma/cardano"   (estático)
    → index.ts → factory.ts
      → import { LucidAnchorAdapter } from "./real"          (estático, al tope)
        → import { ... } from "@lucid-evolution/lucid"
```

`createAnchorPort` ramifica bien en runtime —`if (mode === "simulated") return new
SimulatedAnchorAdapter(...)`— pero el `import` es de módulo, no de rama: para cuando la función
corre, Lucid ya está adentro.

`index.ts` **no exporta** `real`, `codec` ni `blueprint` (verificado: nadie fuera del package los
importa), así que la superficie pública ya está donde tiene que estar. Lo que arrastra la librería es
`factory.ts`.

## Lo que se ahorra, y lo que no

**En producción no se ahorra nada, y hay que decirlo:** `ANCHOR_MODE=real`, Lucid hace falta, y el
costo se paga una vez al arrancar. Lo que hoy lo paga de gusto:

- **Los 335 tests de `apps/api`** — cada worker de vitest, en cada corrida, local y en CI.
- **`pnpm dev`**, donde el modo es `simulated`.
- **El camino `disabled`**, que es justamente el que corre cuando la configuración de anclaje está
  rota. Hoy una API sin `BLOCKFROST_API_KEY` arranca cargando 121 MB de una librería que decidió no
  usar.

En Render, plan free (512 MB), esos 107 MB no son decorativos aunque en `real` se sigan pagando: son
la diferencia entre el pico de arranque y el techo.

## Qué se cambia

`factory.ts` carga `real.ts` **perezosamente**, dentro de `crearAdaptadorReal`, con un `import()`
dinámico. Es la única rama que lo necesita.

Ojo con el detalle de módulos: el package es **CommonJS** (`module: node16`), así que un `import()`
dinámico en TS compila a `require()` y **no hace falta cambiar el formato de nada**. Hay que
verificarlo mirando el `dist` generado, no asumirlo — es la clase de cosa que "funciona" hasta que el
bundler cambia.

`publicarReferenceScript` toma el mismo camino: ya llama a `crearAdaptadorReal`.

## Alcance / NO-alcance

- **Cubre:** `packages/cardano/src/factory.ts`, y el chequeo de que el `dist` resultante siga siendo
  cargable con `require()` desde `apps/api` y desde `scripts/publish-reference-script.mjs`.
- **NO cubre:** cambiar `index.ts` ni la superficie pública del package. Está bien como está.
- **NO cubre:** sacar Lucid de las dependencias, ni reemplazarlo. D-014 lo pone acá a propósito.
- **NO cubre:** el arranque de producción, que sigue pagando lo mismo. Esta spec no es una
  optimización de producción y no debe venderse como tal.

## Invariantes

1. **Nada que no sea `mode === "real"` carga Lucid.** Ni `simulated`, ni `disabled`, ni un
   `ANCHOR_MODE` inválido (que tira antes de ramificar).
2. `createAnchorPort` sigue siendo `async` y su contrato no cambia.
3. **Los errores de configuración siguen saliendo en el mismo momento**: `ANCHOR_MODE` inválido,
   mainnet, secreto ausente — todos antes de tocar la red, como hoy (D-042).
4. El `dist` sigue siendo consumible con `require()` desde CJS.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| `createAnchorPort({})` | `SimulatedAnchorAdapter`, **y Lucid no está en `require.cache`** |
| `mode: "inventado"` | tira el mismo error que hoy, sin cargar Lucid |
| `network: "Mainnet"` | rechaza (D-013) — **verificar si tira antes o después del `import()`**; tiene que ser antes |
| Falta `BLOCKFROST_API_KEY` | mismo error, mismo texto |
| `mode: "real"` bien configurado | funciona igual; los tests del `Emulator` y de yaci sin tocar |
| El script `ref:publish` | sigue andando contra el `dist` |

El primero es el test que da sentido a la spec, y se escribe mirando `require.cache` — que es como se
midió el problema.

## Preguntas abiertas

`validarRed()` corre hoy adentro de `crearAdaptadorReal`, o sea que con el `import()` perezoso el
rechazo de mainnet quedaría **después** de cargar Lucid. Es inofensivo (igual rechaza) pero es al
revés de lo que conviene: la validación de configuración no debería depender de que una librería
cargue. Conviene subir `validarRed` y `requerida` antes del `import()` dinámico, dentro de la misma
spec.

## Cerrada — 2026-09-20

`factory.ts` importa `Lucid`/`Blockfrost` y `LucidAnchorAdapter`/`ReferenceScriptPublication` con
`import type` (se borran en la compilación, cero costo de runtime) y los carga de verdad con un
`import()` dinámico **dentro** de `crearAdaptadorReal`, después de las cuatro validaciones de
configuración (`validarRed`, `requerida` × 2, `urlDeBlockfrost`) — la pregunta abierta se resolvió en
el mismo commit: mainnet y los secretos ausentes rechazan sin haber tocado la librería.

**Medido de nuevo, contra el `dist` compilado** (mismo método que midió el problema):

| Qué | Antes | Después |
|---|---:|---:|
| `createAnchorPort({})` (`simulated`) | 2015 ms / 121,0 MB / Lucid en `require.cache` | **104 ms / 15,8 MB / Lucid ausente** |
| `mode: "inventado"` | igual, con Lucid ya cargado | rechaza, Lucid ausente |
| `network: "Mainnet"` | igual, con Lucid ya cargado | rechaza (D-013), Lucid ausente |
| Sin `BLOCKFROST_API_KEY` | igual, con Lucid ya cargado | rechaza, Lucid ausente |

**El detalle de módulos, verificado y no el que anticipaba la spec:** un `import()` dinámico bajo
`module: node16` **no** se compila a `require()` — TypeScript lo deja como `import()` nativo, que
Node soporta desde cualquier módulo CommonJS desde la 12.17. No hace falta que se convierta: el
`require()` de `apps/api` sobre `@plataforma/cardano` entero sigue funcionando igual (invariante 4),
y adentro, el `import()` es justamente el mecanismo recomendado para que un CJS cargue un paquete ESM
perezoso — mismo criterio que ya usan `@libsql/client`/`kysely` en `apps/api`, con `require()` en vez
de `import()` porque esos SÍ hace falta tenerlos al toque.

**Efecto colateral medido, no buscado:** el `import` de la suite completa de `apps/api` (428 tests)
bajó de ~296s a ~119s — son los 335+ tests que antes pagaban el costo de gusto, ahora no.

**Verificado en rojo antes del fix:** `factory-lazy-load.test.ts` (nuevo, separado de
`simulated.test.ts` a propósito — vitest aísla `require.cache` por archivo, y `real.test.ts` importa
`./real` estático) — 4 tests, los 4 fallan contra el código viejo (Lucid en `require.cache` incluso
en los tres rechazos de configuración), los 4 en verde después.

`pnpm --filter @plataforma/cardano test` (92, 4 nuevos), `pnpm --filter @plataforma/api test` (428,
sin cambios) y `pnpm verify` completo, verdes. No se tocó `index.ts` ni la superficie pública — ya
estaba bien.
