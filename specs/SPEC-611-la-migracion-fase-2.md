# SPEC-611 — La migración: la Fase 2, paso por paso

> Escrita el 2026-10-02 a pedido del dueño, desde
> [`AUDITORIA-2026-10-01`](AUDITORIA-2026-10-01-arquitectura-api-y-web.md) §9, que pedía pasar la
> Fase 2 a spec antes de A0. La decisión que la habilita es **D-102**. El estado de cada paso vive en
> [`specs/README.md`](README.md); acá están el orden, el acople y lo que cierra cada uno.

## Qué es

Rearmar `apps/api` y `apps/web` **módulo por módulo, detrás de los mismos paths**, para llegar a la
forma de la auditoría §2.2 (API) y §3.2 (web). No es un rewrite en paralelo: **en ningún momento hay
dos apps a medias.** Cada commit deja la API y la web andando, con `pnpm verify:all` en verde y el
arnés de la auditoría §7 sin tocar:

- los tests de HTTP sin mocks de `apps/api/test/`;
- las specs de Playwright con los test IDs de M2-D5;
- la `MATRIZ` de `apps/api/test/route-guards.test.ts`, que no cambia ni un carácter;
- `openapi-freshness.test.ts` y `api-docs-freshness.test.ts`, que comparan byte a byte la evidencia
  de `specs/evidencia-m3/2-api/` con lo que genera el código.

## Los pasos y su spec

| Paso | Qué | Spec | Depende de |
|---|---|---|---|
| **A0** | La API en ESM y el entorno parseado en un solo lugar | [`SPEC-612`](SPEC-612-la-api-en-esm-y-el-entorno-en-un-lugar.md) | nada |
| **A1** | Los cimientos de los módulos: `ErrorCode`, IDs con marca, `Result`, `audit(trx)`, `notify(trx)`, anclaje con reclamo, `CHECK` en los enums | [`SPEC-613`](SPEC-613-los-cimientos-de-los-modulos.md) | A0 |
| **A2** | El contrato en `shared`, un solo router oRPC y los guards como `meta` | [`SPEC-607`](SPEC-607-una-sola-capa-de-api.md) | A1 |
| **W2** | El cliente de la web desde el contrato | [`SPEC-609`](SPEC-609-el-cliente-sale-del-contrato.md) | A2 |
| **W2** | La fábrica de queries por entidad, `staleTime` y una sola `claveDeError` (Paso 1); los loaders con `prefetchQuery`, por rol (Paso 2) | [`SPEC-614`](SPEC-614-la-fabrica-de-queries.md) | W1 (cerrado) |
| **A3 + W3** | El piloto `dossier`, de punta a punta | [`SPEC-615`](SPEC-615-el-piloto-dossier.md) | A2, W2 |
| **A4 + W4** | El resto, módulo con su rol | [`SPEC-616`](SPEC-616-el-resto-modulo-por-modulo.md) | el piloto aprobado |
| **A5 + W5** | Se borra la forma vieja y se activan las reglas que la impiden | [`SPEC-617`](SPEC-617-una-sola-forma.md) | A4 + W4 |

W0 y W1 son de la Fase 1 y están cerrados (W1 es
[`SPEC-601`](archive/SPEC-601-el-guard-de-rol-vive-en-el-router.md)).

**Lo que se disuelve en estos pasos:** [`SPEC-602`](archive/SPEC-602-los-datos-arrancan-con-la-ruta.md)
(loaders y `staleTime`) en `614`, y los loaders se convierten a la forma con Suspense en `615`/`616`
(dueño, 2026-10-06: los loaders en dos tiempos, porque W4 reescribe el componente y no el loader); [`SPEC-604`](archive/SPEC-604-la-capa-de-datos-sale-de-los-routers.md)
(las lecturas fuera de los routers) en los `queries.ts` de `615`/`616`; y
[`SPEC-608`](archive/SPEC-608-los-archivos-por-concepto.md) (archivos por concepto) en los módulos de
`615`/`616`. Las tres pasan a `archive/` con esta spec.

## El acople

```
A0 → A1 → A2 ─┬─→ W2 (609) ─┐
              │             ├─→ A3 + W3 (piloto) → A4 ∥ W4 → A5 + W5
     W2 (614) ┴─────────────┘
```

- **`614` no espera a la API**: la fábrica y los loaders de su Paso 2 se hacen sobre el `port.ts` de
  hoy. Por eso es el paso de la web que va primero.
- **A3 y W3 van juntos**, porque el piloto es de punta a punta.
- **A4 y W4 avanzan en paralelo**, un módulo de la API con las pantallas de su rol.
- **Las features de M4 (`501`–`504`) entran después de A2**, ya con la forma nueva, en paralelo con
  A4/W4. Así nacen como módulos y no hay que migrarlas.

## Quién hace qué (dueño, 2026-10-06)

Dos personas: el dueño en la API y una segunda persona en la web, que entra en `609`.

1. **El dueño, solo:** `614` (Paso 1, después Paso 2) → A0.2 → A1 → A2. `614` no espera a la API,
   pero va primero para que la web quede con la fábrica y los loaders puestos antes de delegarla.
2. **Desde A2, en relevo:**
   - la segunda persona toma `609` mientras el dueño hace A3;
   - W3 sigue a A3 (necesita el cliente del dossier de `609`);
   - **el dueño revisa el piloto** (la regla de salida, abajo) antes de que arranque A4;
   - A4 ∥ W4 módulo por módulo, en el orden de [`SPEC-616`](SPEC-616-el-resto-modulo-por-modulo.md):
     el dueño cierra un módulo de la API y la segunda persona migra las pantallas que lo leen
     mientras él sigue con el siguiente;
   - A5 y W5, uno cada uno.

**La entrada para la segunda persona es `609`**: acotada, no toca ninguna pantalla (la fachada de
`port.ts` deja intactos los 324 `spyOn`) y la recibe con la fábrica de `614` ya hecha.

## La regla de salida

**Si el piloto muestra que el arnés no alcanza para migrar sin miedo, o que la forma no simplifica**
(el módulo no queda claramente más chico y más legible que lo que reemplaza), **se frena después del
piloto** y se vuelve a la vía incremental de la serie `6xx`. A0, A1, A2 y W2 sirven igual en los dos
caminos: ninguno se pierde.

## Decisiones que la Fase 2 necesita, y cuándo

| Qué | Antes de | Dónde está planteada |
|---|---|---|
| **La evidencia de M3 se congela o se regenera.** Desde A3 el OpenAPI cambia (errores declarados en el contrato). Regenerar mantiene verde `openapi-freshness`, pero el documento del repo deja de ser el que se entregó | A3 | [`SPEC-613`](SPEC-613-los-cimientos-de-los-modulos.md) §La evidencia de M3 |
| **Una notificación que falla, ¿frena la mutación?** Hoy no: `notify` se traga el error | A1, al escribir `notify(trx)` | [`SPEC-613`](SPEC-613-los-cimientos-de-los-modulos.md) §Decisión que pide |
| **El scope de proyecto del notary**: hoy ve y firma cualquier dossier (auditoría §8 punto 6) | A3 | [`SPEC-615`](SPEC-615-el-piloto-dossier.md) |
| **Cuándo se persiste la compilación del dossier**: la propuesta es que los GET no escriban y el `masterHash` se fije al firmar | A3 | [`SPEC-615`](SPEC-615-el-piloto-dossier.md) |
| **Con qué se activa el chip *Evidence by stage*** del investor: hoy solo con el `txid` de `Completed` | W4 (investor) | [`SPEC-616`](SPEC-616-el-resto-modulo-por-modulo.md) |
| **Si hace falta UI de espera al crear un proyecto** (18,5 s medidos en Preprod) | W4 (developer) | [`SPEC-616`](SPEC-616-el-resto-modulo-por-modulo.md) |

## Lo que no se hace

SSR, un BFF como servicio aparte, Effect-ts, cambiar Express por otro framework, `RPCLink`
(manda a `/rpc/...` y rompe los paths de M2-D5). Las razones, en la auditoría §2.4 y §3.4.

## Lo que queda afuera a propósito

- **`contracts/` y `packages/cardano`**: la migración no los toca. `SPEC-304` y `SPEC-305` siguen
  siendo "antes de mainnet".
- **`SPEC-605`** (outbox + worker) y **`SPEC-606`** (la sesión por pestaña) siguen condicionales. W1
  abarató la 606; la Fase 2 no la decide.
- **El rate limit, helmet, CORS y Multer** no se mueven: son la carcasa (D-102).
