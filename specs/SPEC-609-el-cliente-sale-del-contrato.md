# SPEC-609 — El cliente de la web sale del contrato (reabre la opción B de `SPEC-111`)

> **Fase 2, paso W2** ([`SPEC-611`](SPEC-611-la-migracion-fase-2.md)), junto con
> [`SPEC-614`](SPEC-614-la-fabrica-de-queries.md); el estado, en [`specs/README.md`](README.md).
> Nivel 🟢: la API no cambia; cambia cómo el front tipa sus llamadas. **Depende de A2
> ([`SPEC-607`](SPEC-607-una-sola-capa-de-api.md))**, y avanza **por vertical**: cada módulo que
> A3/A4 mueve al contrato pasa su cliente al mismo tiempo, y la fachada de `port.ts` deja convivir
> métodos migrados y sin migrar. Reabrir [`SPEC-111`](archive/SPEC-111-callsites-de-apps-web-al-cliente-orpc.md)
> quedó decidido en **D-102**. Escrita en la serie `6xx`
> ([`PROPUESTA-2026-09-30-refactor-post-m3.md`](PROPUESTA-2026-09-30-refactor-post-m3.md)).

## Qué había quedado de `SPEC-111`

`SPEC-111` (cerrada 2026-09-20) tipó los **cuerpos** de `port.ts` con `shared` y agregó
`port.contract.test.ts`, que cruza cada método contra el OpenAPI. Descartó el cliente oRPC (opción B)
por tres razones, y dejó una deuda escrita: **que el tipo de respuesta de un método sea el schema de
su ruta.** `request<ProjectDetail>(…)` es un emparejamiento a mano: si la ruta pasa a devolver otro
schema, ningún test se entera.

Las tres razones, contrastadas el 2026-09-30:

| Objeción de `SPEC-111` | Estado |
|---|---|
| **Reescribir la cabecera de 84 procedimientos** (🟡) | **La paga `SPEC-607`**, que la necesita por su propia razón (guards como dato, una sola capa). Para esta spec es costo cero |
| **Zod al bundle**, salvo `minifyContractRouter` | **Probado:** el contrato minificado no conserva ningún schema y `OpenAPILink` funciona con él. Ojo: minificar **en runtime** importa el contrato completo y trae Zod igual. El contrato minificado se genera **en build** (un JSON) y el front importa ese JSON |
| **El cliente no revive fechas**: `z.coerce.date()` llega como `string` aunque el tipo diga `Date` | **Reproducido**: con `OpenAPILink`, `at` llega como `string`. **La salida está probada:** se tipa el cliente con el mismo `Serialized<T>` que ya usa `types.ts` (`SPEC-109`), aplicado a cada procedimiento. `tsc` acepta `const s: string = r.at` y rechaza `const d: Date = r.at` (verificado con una mutación: sacar el `@ts-expect-error` da `TS2322`). También rechaza un input incompleto y una ruta inexistente |

**Descartado a propósito:** `RPCLink`. Revive fechas de verdad (probado), pero manda las requests a
`/rpc/...` en lugar de los paths REST de M2-D5. D-066 descartó tRPC justamente porque *"M2-D5 define
método + path"* y la tesis del producto es que un tercero pueda verificar con `curl`. **El tráfico
del front tiene que seguir siendo el REST que documenta la evidencia.**

## Alcance

1. **`packages/shared` exporta el tipo del cliente**:
   `type ApiClient = ClienteCable<ContractRouterClient<typeof contract>>`. `ClienteCable` aplica
   `Serialized` al resultado de cada procedimiento. Son unas 6 líneas, probadas el 2026-09-30.
2. **Un script de build genera `contract.min.json`** (`minifyContractRouter`), con un test de
   frescura igual al de `openapi-freshness`. El front lo importa. **Zod no entra al bundle**, y lo
   fija un test sobre el output de `vite build`.
3. **`port.ts` queda como fachada plana, con la misma forma que hoy**:
   `getNotaryKpis: () => cliente.notary.kpis()`. **No es cosmética**: hay **324
   `vi.spyOn(api.…)` en 43 archivos de test** de la web, y todos siguen andando sin tocarse. Los
   tipos de cada método los infiere el cliente, no un `request<T>` escrito a mano.
4. **`request()` se reduce al link**: el `fetch` con `API_BASE`, el `Authorization` y la limpieza de
   sesión ante un 401 pasan al `fetch` que recibe `OpenAPILink`. `ApiError` se conserva: las
   pantallas leen `status` y `body`. Hay que mapear el error de oRPC a esa forma.
5. **Las tres excepciones siguen siendo manuales**: la subida multipart (`FormData`, Multer,
   `SPEC-218`) y los dos binarios (`requestBlob`: dossier en PDF y descarga de evidencia).
6. **`types.ts` se achica** a lo que no sale del contrato. Lo que se derive del cliente
   (`Awaited<ReturnType<ApiClient['notary']['kpis']>>`) se borra de ahí.
7. **`port.contract.test.ts`** conserva solo lo que el tipo no garantiza: el origen `API_BASE` y las
   tres excepciones. Lo demás (verbo, path, filtros y cuerpo) lo garantiza el contrato al compilar.

### Los params de ruta (dueño, 2026-10-07)

Con el cliente saliendo del contrato, las entradas pasan a pedir IDs con marca
([`SPEC-613`](SPEC-613-los-cimientos-de-los-modulos.md)). Un param de ruta se parsea **una sola vez**,
en el `params.parse` de la ruta de TanStack (`unitIdSchema.parse(params.unitId)`), y de ahí en
adelante todo viaja con marca. **Ningún componente hace un cast.**

## Invariantes

1. **Las requests del navegador son idénticas a las de hoy**: mismo método, path, query y body.
   Lo verifica `pnpm e2e` sin cambios y, a mano, la pestaña de red.
2. **Ningún tipo de respuesta miente sobre el cable**: una fecha es `string` en el tipo.
3. **El front sigue sin cargar Zod en runtime** (D-012 · regla 6 · `types.ts`).
4. **Ninguna pantalla ni test de pantalla cambia**: la fachada conserva nombres y firmas.

## Tamaño

Mediano. Se puede hacer por vertical, en el mismo orden que `SPEC-607`, porque la fachada deja
convivir métodos migrados y sin migrar.

## La infraestructura, hecha el 2026-10-07

**El contrato todavía está vacío** (lo llena A3), así que esto es todo lo que no depende de que
tenga rutas. El dueño eligió adelantarlo antes que esperar a A3. **Ningún método de `port.ts` cambió**
y el cliente no está en el bundle de la app: ninguna pantalla lo importa todavía.

| Pieza | Dónde |
|---|---|
| El contrato, vacío, en una entrada propia (`@plataforma/shared/contract`), con `ClienteCable` y `ApiClient` (alcance 1) | `packages/shared/src/contract/index.ts` |
| `contract.min.json`, generado con `minifyContractRouter` (`pnpm --filter @plataforma/shared contract:min`) y con su test de frescura (alcance 2) | `packages/shared/src/contract/` · `scripts/contrato-min.ts` |
| `fetchConSesion`: el `fetch` de `request()` (Bearer, 401 que borra la sesión, `ApiError` con `status` y `body`), ahora compartido con el link (alcance 4) | `apps/web/src/api/transporte.ts` |
| `crearCliente`: `OpenAPILink` sobre el contrato minificado, a `${VITE_API_ORIGIN o el mismo origen}/api/v1` | `apps/web/src/api/cliente.ts` |
| Zod fuera del bundle, sobre el output de Vite (invariante 3) | `apps/web/src/api/cliente.bundle.test.ts` |

**Lo que se probó:** `cliente.test.ts` arma un cliente sobre un contrato minificado de prueba. Con
eso verifica el path REST bajo `/api/v1`, el origen con y sin `VITE_API_ORIGIN`, los params del
input en el path, el Bearer, que un 401 borra la sesión y que un error llega como el mismo `ApiError`
(sale de `fetchConSesion` antes de que oRPC lo decodifique, así que no hay que mapear el `ORPCError`).
También fija con `@ts-expect-error` que una fecha del output es `string`. El test del bundle está
probado en rojo: con un schema de `@plataforma/shared` importado en `cliente.ts`, entran 79 módulos
de Zod.

**`shared` compila con `module: nodenext` y sigue en CommonJS** (D-102 no cambia). `@orpc/contract`
y `@orpc/client` son solo ESM, y `node16` rechaza hasta un `import type` de ellos (TS1541);
`nodenext` lo acepta porque Node 22 hace `require()` de un ESM. El JS emitido de los módulos que ya
existían es idéntico byte a byte (`diff -r` de los dos `dist`). `cardano` no cambia. Pasar
`packages/` a ESM de verdad (`"type": "module"` y `.js` en los imports relativos) queda para después
(dueño, 2026-10-07).

**Lo que hace cada vertical en A3/A4, al mudar su contrato:** `pnpm --filter @plataforma/shared
contract:min`; sus métodos de `port.ts` pasan a `cliente.<módulo>.<proc>(…)` (alcance 3); sus tipos
salen de `types.ts` (alcance 6); sus casos de `port.contract.test.ts` se van (alcance 7, salvo
`API_BASE` y las tres excepciones); y sus params de ruta se parsean con su schema con marca
(§Los params de ruta). El primer método migrado mete el cliente en el bundle de la app: ese commit
mide cuánto suma al JS inicial.
