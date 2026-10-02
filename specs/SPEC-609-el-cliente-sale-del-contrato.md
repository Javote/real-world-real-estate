# SPEC-609 — El cliente de la web sale del contrato (reabre la opción B de `SPEC-111`)

> Serie `6xx`, refactor post-M3 ([`PROPUESTA-2026-09-30-refactor-post-m3.md`](PROPUESTA-2026-09-30-refactor-post-m3.md)).
> **No es mandato hasta entregar M3.** Nivel 🟢: la API no cambia; cambia cómo el front tipa sus
> llamadas. **Depende de [`SPEC-607`](SPEC-607-una-sola-capa-de-api.md)**: sin el contrato en `shared`,
> no hay de dónde derivar el cliente. **Reabre [`SPEC-111`](archive/SPEC-111-callsites-de-apps-web-al-cliente-orpc.md)
> a pedido del dueño (2026-09-30).**

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

## Invariantes

1. **Las requests del navegador son idénticas a las de hoy**: mismo método, path, query y body.
   Lo verifica `pnpm e2e` sin cambios y, a mano, la pestaña de red.
2. **Ningún tipo de respuesta miente sobre el cable**: una fecha es `string` en el tipo.
3. **El front sigue sin cargar Zod en runtime** (D-012 · regla 6 · `types.ts`).
4. **Ninguna pantalla ni test de pantalla cambia**: la fachada conserva nombres y firmas.

## Tamaño

Mediano. Se puede hacer por vertical, en el mismo orden que `SPEC-607`, porque la fachada deja
convivir métodos migrados y sin migrar.
