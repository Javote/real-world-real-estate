# SPEC-615 — A3 + W3: el piloto `dossier`, de punta a punta

> Fase 2, pasos A3 y W3 ([`SPEC-611`](SPEC-611-la-migracion-fase-2.md)); el estado, en
> [`specs/README.md`](README.md). Nivel 🟡: toca la firma, que ancla. El análisis completo del módulo
> está en [`AUDITORIA-2026-10-01`](AUDITORIA-2026-10-01-arquitectura-api-y-web.md) §8; acá va lo que
> se hace y cuándo está terminado. **Depende de A2 y de W2.**

## Por qué este

Es chico (9 endpoints, 6 pantallas), cruza tres roles (notary, investor, público), toca la cadena y
ya tuvo el bug de reclamar antes de anclar. Si la forma de la auditoría §2 y §3 funciona acá,
funciona en el resto. **Si no, acá se frena** (§La regla de salida).

## La superficie

| Lado | Qué |
|---|---|
| API | `notary.routes.ts`: `GET /kpis`, `GET /dossiers/pending`, `GET /dossiers/{id}`, `POST /dossiers/{id}/sign`, `POST /dossiers/{id}/reject`, `GET /signatures` · `investor.routes.ts`: `GET /units/{id}/dossier`, `GET …/dossier/export.pdf`, `POST …/dossier/share` · `public.routes.ts`: `GET /dossier/{shareToken}` · `domain/dossier.ts` |
| Web | `notary.index`, `notary.dossiers`, `notary.signed`, `notary.dossier.$dossierId`, `investor.unit.$unitId.dossier`, `public.dossier.$shareToken` · `PendingDossiersQueue`, `ShareDossierModal` |
| Arnés | `dossier.test.ts`, `dossier-unico-por-unidad`, `spec-211-limite-dossier-publico`, `orpc-client-notary`, `orpc-client-public`, `notary-coverage`, `dossier-recompile-coverage` · e2e `notary-certifier.spec.ts`, `investor-surface.spec.ts`, `walkthrough.spec.ts` |

## Decisiones que pide, antes de empezar

**Decididas por el dueño el 2026-10-07:**

1. **El notary sigue viendo y firmando cualquier dossier** (`soloRol`): el piloto no toca la
   `MATRIZ`. El scope se decide antes de los pilotos de M4, en un commit propio.
2. **La propuesta**: la fila `Dossier` nace al aceptar la invitación, los GET calculan en memoria y
   el `masterHash` se fija al firmar. Las unidades que ya tienen investor y no tienen fila se
   completan con una migración de datos nueva (Turso está vivo, D-063).
3. **La evidencia de M3 se congela** antes del primer commit que mueva el OpenAPI: una copia fechada
   en `specs/evidencia-m3/` queda como lo entregado, y `openapi-freshness` pasa a comparar contra un
   archivo vivo aparte. Ese commit suma la decisión a `DECISIONS.md`.

Lo que se planteó:

1. **El scope de proyecto del notary.** Hoy ve y firma cualquier dossier (`acceso: "soloRol"`). Con
   un escribano da igual; con los pilotos de M4 (dos developers, datos reales) hay que decidirlo. Si
   cambia, cambia la `MATRIZ`, y eso se hace en un commit propio, antes o después del piloto, nunca
   adentro.
2. **Cuándo se persiste la compilación.** Hoy los tres GET escriben `Dossier` (`masterHash`,
   `compiledAt`) y reconcilian contra Blockfrost. **La propuesta:** la fila nace cuando la unidad
   tiene investor (al aceptar la invitación), los GET calculan en memoria y no escriben, y el
   `masterHash` se fija al firmar.
3. **La evidencia de M3** (`SPEC-613` §La evidencia de M3): el piloto es el primer paso que cambia
   el OpenAPI.

## Alcance

**API (A3)**

- **`shared`**: `DOSSIER_TRANSITIONS` (`compiled → signed`, `compiled → rejected`,
  `rejected → compiled` cuando cambia el `masterHash`; `signed` terminal), el contrato de los 9
  endpoints con `meta` y errores (`DOSSIER_NOT_FOUND`, `DOSSIER_NOT_SIGNABLE`, `DOSSIER_CHANGED`,
  `DOSSIER_SIGNED`) y `DossierId` con marca.
- **`apps/api/src/modules/dossier/`**:
  - `rules.ts`, puro: `artefactosDe`, `completitud`, `masterHashDe`, `commitmentDeFirma`,
    `puedeFirmar`. Hoy está mezclado con las queries en `compileDossier`.
  - `queries.ts`: los insumos del dossier en una pasada, **y en lote para la cola** (se va el N+1 de
    `GET /dossiers/pending`, que llama a `compileDossier` por fila). Los KPIs con un `count` en SQL,
    no leyendo la tabla entera.
  - Casos de uso `firmar`, `rechazar`, `compartir`, `exportar`, con `anclarConReclamo` y `audit(trx)`
    (`SPEC-613`).
  - `router.ts`: una línea por procedimiento, de `Result` a error tipado. No importa `db`.
- **Se borran sus rutas de Express** y `domain/dossier.ts` se vacía en el módulo.
- **El endpoint de pantalla del investor**: la pantalla hace hoy tres requests en cascada
  (unidad → proyecto, más el dossier) cuando el dossier ya trae proyecto y unidad. Si hace falta un
  path nuevo, sale de M2-D5 o es una decisión (regla: ningún endpoint fuera de `docs/`); si no,
  se amplía la respuesta del que existe.

**Web (W3)**

- El layout `notary` ya tiene armazón (W1).
- `dossierQueries` en la fábrica (`SPEC-614`); cliente desde el contrato (`SPEC-609`).
- Las 6 pantallas con `loader` (`ensureQueryData`; si [`SPEC-614`](archive/SPEC-614-la-fabrica-de-queries.md)
  Paso 2 ya les puso uno con `prefetchQuery`, se cambia el verbo) y `useSuspenseQuery`: sin `enabled`, sin `data?.`,
  sin `return null`. `pendingComponent` adentro del armazón, `errorComponent` y `notFoundComponent`
  (el loader hace `throw notFound()`). `validateSearch` con Zod donde hay estado en la URL.
- **La vista del dossier, un componente compartido** entre investor y notary (hoy es el clon más
  grande del repo, 57 líneas).

### IDs con marca (dueño, 2026-10-07)

Los IDs con marca de [`SPEC-613`](SPEC-613-los-cimientos-de-los-modulos.md) se adoptan **con cada
módulo**, y el piloto es el primero:

- **Las respuestas primero.** Cuando el contrato de `dossier` se muda a `shared/contract/`, sus
  schemas de salida se marcan, **incluidos los `id` primarios**: marcar los `*Id` sin los `id` hace que
  un `Set<UserId>` no acepte un `u.id` (pasó en `admin.index.tsx` al medirlo).
- **Los fixtures de la web, con una fábrica tipada por entidad** (`fabrica.dossier({ … })`): recibe
  strings y devuelve el tipo con marca. Se toca cada fixture una vez, no cada campo, y en el mismo
  cambio que migra las pantallas del módulo.
- **Las entradas, con `609`** (`SPEC-609` §Los params de ruta).

## Cuándo está terminado

1. **Los tests de HTTP del arnés pasan sin cambios.** La única excepción es la que cambie a propósito
   la decisión 2, y cada test que cambia se nombra en el commit.
2. `test/reclamar-antes-de-anclar.test.ts` pasa.
3. `modules/dossier/router.ts` no importa `db`, y **los GET no escriben** (un test lo fija contando
   escrituras).
4. Las 6 pantallas no tienen `enabled`, `return null` ni lectura a mano de `ApiError`, y **ninguna
   dibuja un error como su estado vacío** (`notary.index`, `notary.signed`, `notary.dossier.$dossierId`,
   `investor.unit.$unitId.dossier` y `public.dossier.$shareToken` lo hacen hoy).
5. La `MATRIZ` de `route-guards.test.ts` no cambia (salvo la decisión 1, en su propio commit).
6. Cero comentarios con fecha en lo migrado.
7. `pnpm verify:all` y `pnpm e2e` completo en verde.

## A3, hecho el 2026-10-07

Tres commits: `6e0f559` (el dossier nace con la venta, en producción), `24c7f98` (la migración
0013, que le da su dossier a cada venta que no lo tenía) y el del módulo. Los dos últimos salen
juntos, con backup de Turso antes: la migración corre en el deploy.

| Pieza | Dónde |
|---|---|
| El contrato de los 10 procedimientos, con `meta.guard` y errores; el tipo del guard | `packages/shared/src/contract/dossier.ts`, `guard.ts` |
| `DOSSIER_TRANSITIONS` | `packages/shared/src/dossier.ts` |
| El módulo: reglas puras, consultas con ejecutor (la cola en tres consultas, sin N+1), casos de uso con `Result`, router de una línea por procedimiento | `apps/api/src/modules/dossier/` |
| `auditSiGano` y `notifySiGano` | `apps/api/src/platform/` |

**Verificado:** la `MATRIZ` sin un carácter de diferencia; la API en 100/100/100/100 (921 tests);
los e2e del notary, el investor y el walkthrough (52); la colección Postman idéntica, y en el OpenAPI
vivo solo cambian las 10 rutas del dossier (su `operationId` y los errores que declaran). La carrera
de la firma y la garantía de que las lecturas no escriben, probadas en rojo con una mutación cada una.

**Tests del arnés que cambiaron**, cada uno por una razón: `dossier.test.ts` (dos ventas plantadas a
mano pasan a `sembrarUnidadVendida`: decisión 2), `reclamar-antes-de-anclar.test.ts` (la demora va en
`insumosDe`, no en `compileDossier`, que ya no existe), `orpc-client-notary` y `orpc-client-public`
(reemplazados por `orpc-client-dossier`, contra el contrato), `dossier-unico-por-unidad`,
`dossier-recompile-coverage` y `notary-coverage` (sin `compileDossier`), y `error-codes` (lee también
los errores que declara el contrato).

**Tamaño, el lado API:** 733 líneas en `modules/dossier/` más 131 del contrato, contra 767 de lo que
reemplaza (`notary.routes.ts`, `domain/dossier.ts` y las rutas de investor y public). No es más chico:
suma la cola en lote, el estado derivado y los reclamos con su audit en el mismo lote. La regla de
salida se mide con W3.

## W3, hecho el 2026-10-22

Un commit. Las seis pantallas y la cola leen con `useSuspenseQuery`: el `loader` espera con
`ensureQueryData` (ya no precarga con `prefetchQuery`) y la ruta declara sus tres estados.

| Pieza | Dónde |
|---|---|
| Los tres estados de una ruta con Suspense, dentro de su marco: `RutaCargando` (con el test ID de la sección), `RutaConError` (por `claveDeError`) y `RutaNoEncontrada` (con su clave) | `apps/web/src/components/EstadosDeRuta.tsx` |
| `oNoEncontrado`, que en el loader convierte un 404 de la API en `notFound()`, y `PENDING_MS` (150): lo que el archivo de la ruta usa fuera de sus componentes | `apps/web/src/lib/cargaDeRuta.ts` |
| La vista de artefactos, la misma para investor y notary (el clon de 57 líneas); el texto del vacío pasa a `dossier.noArtifacts` | `apps/web/src/components/DossierArtifacts.tsx` |
| Los 9 métodos del dossier por `cliente.dossier.*` (SPEC-609); `exportUnitDossier` sigue manual, es binario | `apps/web/src/api/port.ts` |
| Los fixtures del módulo con la forma del cable | `apps/web/src/test/fabrica.ts` |
| `montarRuta` monta la ruta entera (loader y estados) cuando declara `pendingComponent` | `apps/web/src/routes/-test-mount.tsx` |

**El investor espera en el loader, no en la pantalla:** el dossier y la unidad en paralelo, y el
proyecto con el `projectId` del dossier. La cascada sigue (dos olas), pero arranca con el hover y la
pantalla no dibuja nada a medias.

**Lo que cambió para quien mira:** mientras carga, cada pantalla muestra su título y la carga dentro de
su sección, sin acciones; antes, el investor veía compartir y exportar sobre un dossier que no había
llegado. Un error dice *"Algo salió mal"* (o el 403/404) en lugar del estado vacío: antes, una caída
de la API en `/notary/signed` decía *"Todavía no firmaste ningún dossier."*. Los tipos dejaron de
mentir: con `request<Dossier>`, `compiledAt` era `Date` y llegaba `string`.

**Las requests son las mismas** (invariante 1 de SPEC-609), fijado en `api/port.dossier.test.ts`,
salvo un detalle: `share` y `sign` mandaban `{}` como cuerpo JSON y el link los manda sin cuerpo. El
e2e lo prueba contra la API real.

**Verificado:** la web en 100/100/100/100 (1843 tests); el e2e del notary, del investor y del login
(26, en las dos resoluciones). Tests de pantalla reescritos para montar la ruta entera:
`-notary.dossier.detail`, `-notary.index`, `-notary.dossiers`, `-notary.signed`,
`-investor.unit.dossier` y `-public.dossier`, más `-loaders` (las seis salen de los que precargan y
pasan a los que esperan). Los que fijaban un error dibujado como vacío ahora fijan el error.
`port.contract.test.ts` deja afuera los métodos que salen del contrato (`DEL_CONTRATO`, SPEC-609 §7).

**El JS inicial queda en 130,1 kB gz (130,6 antes de W3)**, medido con `vite build` sobre los scripts
y `modulepreload` del `index.html`. Hubo que cuidar dos cosas (dueño, 2026-10-22):

- **El cliente de oRPC baja con `import()`** la primera vez que `port.ts` lo usa (9,3 kB gz en su
  chunk). Importado de arriba entraba con el primer método migrado: 142,9 kB gz.
- **El code-splitting del router no separa una llamada ni un spread en las opciones de la ruta**:
  con `...estadosDeRuta(Marco)` el marco de cada pantalla (`PanelLayout` incluido) quedaba en el
  archivo de la ruta, que es JS inicial. Por eso los estados se declaran en línea, la pantalla y sus
  estados van en un mismo grupo (`codeSplittingOptions` en `vite.config.ts`: si no, el `Marco` que
  comparten se queda en el archivo de la ruta) y lo que usa el loader vive en `lib/cargaDeRuta.ts`,
  que no importa componentes.

**Los IDs con marca en las salidas, después de W3 (2026-10-22, commit propio):** `dossierSchema`
(`id`, `unitId`, `projectId`), `pendingDossierSchema`, `notarySignatureSchema` y los resultados de
firmar y rechazar llevan `DossierId`/`UnitId`/`ProjectId`. En la API, la marca entra en el borde con
la base: el `$narrowType` de las consultas de `modules/dossier/queries.ts`, el mismo que ya fijaba
el `status`; `db/types.ts` no cambia, así que la forma vieja no se entera. En la web, solo
`test/fabrica.ts` convierte: los fixtures escriben sus ids como `string`. El JSON Schema y el
OpenAPI no cambian. `apps/api/test/cimientos-tipos.test.ts` fija la marca de cada salida.

**Lo que W3 no hizo:**

- **Los params de ruta con marca** (SPEC-609 §Los params de ruta): el front no carga Zod, así que el
  `params.parse` tendría que marcar con un helper sin schema, y el input del contrato sigue siendo
  `string` (la marca de Zod es de salida). Ninguna llamada del dossier lo necesita hoy.
- **El endpoint de pantalla del investor: queda como está** (dueño, 2026-10-22). La segunda ola
  existe solo por `estimatedDelivery`, que `GET /investor/units/:id` no trae; el loader la encadena y
  arranca con el hover. M2-D5 (fila 26-29) solo nombra los del dossier, así que un path nuevo queda
  descartado; sumar `estimatedDelivery` a la respuesta de la unidad se decide en `SPEC-616`, junto con
  la cascada de `investor.unit.$unitId.index`, que pide la misma unidad.

## La regla de salida

Al terminar, se mide: líneas del módulo nuevo contra las que reemplaza (rutas + `domain/dossier.ts`
+ las 6 pantallas), y el dueño lo lee. **Si el módulo no queda claramente más chico y más legible, o
si migrar obligó a cambiar tests del arnés que no estaban previstos, se frena** y se vuelve a la vía
incremental de la serie `6xx`. Lo hecho en A0–A2 y W2 se queda.

**Medido el 2026-10-22, para que el dueño lo lea:**

| | Antes | Después |
|---|---|---|
| API (A3) | 767 (`notary.routes.ts`, `domain/dossier.ts`, rutas de investor y public) | 864 (`modules/dossier/` 733 + contrato 131) |
| Las 6 pantallas y la cola | 732 | 662 |
| La vista de artefactos compartida | — | 52 |
| **Total** | **1.499** | **1.578** |

`EstadosDeRuta.tsx` (56) queda afuera: es de toda ruta con Suspense, no del dossier. **No queda
más chico**: las pantallas bajan 70 líneas, y la API sube 97 por la cola en lote, el estado derivado y
los reclamos con su audit en el mismo lote. Lo que suma en la web son estados que antes no existían
(carga, error y 404 por pantalla). Los tests del arnés que cambiaron están nombrados en §A3; W3 no
tocó ninguno de HTTP.
