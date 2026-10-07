# SPEC-614 — W2: la fábrica de queries por entidad, una sola `claveDeError` y los loaders que precargan

> Fase 2, paso W2 ([`SPEC-611`](SPEC-611-la-migracion-fase-2.md)), junto con
> [`SPEC-609`](SPEC-609-el-cliente-sale-del-contrato.md); el estado, en [`specs/README.md`](README.md).
> Nivel 🟢. **No espera a la API**: se hace sobre el `port.ts` de hoy. Absorbe los cuatro puntos de
> [`SPEC-602`](archive/SPEC-602-los-datos-arrancan-con-la-ruta.md): los puntos 2 a 4 en el Paso 1 y,
> desde el 2026-10-06 (dueño), el punto 1 —los loaders— en el Paso 2. W3/W4 ya no escriben loaders:
> los convierten.
>
> **Dos pasos, dos commits como mínimo.** El Paso 1 no cambia ninguna request; el Paso 2 las
> adelanta a propósito. Por eso no van juntos.

## Lo que hay hoy, medido el 2026-10-02

- **89 `queryKey` escritas a mano** fuera de los tests, y **18 `invalidateQueries`** que invalidan
  por rol: `['developer']` (3), `['certifier']` (2), `['notary']`, `['investor']`. Cambiar una etapa
  desde `developer.progress` deja vieja `['developer','project',id]` si las llaves no comparten
  prefijo. Hoy no se nota porque `staleTime` es 0 (salvo `me`, en `auth/requireRole.ts`).
- **Cada pantalla interpreta el `ApiError` sola**: 15 archivos comparan `status === 403` o leen
  `body` como `Record<…>`, y algunos mensajes de error vuelven en inglés (auditoría §3.1).

## Paso 1 — la fábrica, las invalidaciones y `staleTime`

### Alcance

1. **`apps/web/src/api/queries/<entidad>.ts`**: una fábrica por entidad (`proyectoQueries`,
   `etapaQueries`, `unidadQueries`, `dossierQueries`, `evidenciaQueries`, `notificacionQueries`…)
   que devuelve `queryOptions` con la llave y la `queryFn`. La llave sale **de la entidad, no del
   rol**: `['proyecto', id]`, `['proyecto', id, 'etapas']`. Loader, componente e invalidación usan
   la misma.
2. **Una mutación invalida la entidad que tocó**, no el rol: cambiar una etapa invalida
   `['etapa', id]` y `['proyecto', projectId]`. Cada una de las 18 invalidaciones de hoy se
   reescribe y se fija con un test que dice qué llaves invalida.
3. **`staleTime` por defecto ~30 s**, recién cuando el punto 2 está hecho (antes, una invalidación
   por rol que no alcanza deja datos viejos). **Excepción, de `SPEC-602`:** toda query que muestra un
   anclaje (`anchorStatus`, TXID, `Pending`) se reusa solo dentro de la misma navegación
   (`staleTime` de 10 s, `ANCLAJE_MS`), porque depende de la reconciliación por lectura (D-077) y
   regla 17. Era 0 hasta que el Paso 2 lo hizo pedir dos veces por navegación (dueño, 2026-10-06:
   ver §Paso 2, Cómo quedó).
4. **`claveDeError(err) → TranslationKey`**, una sola, en `apps/web/src/api/`. Traduce el `ApiError`
   (y desde `SPEC-609`, el error tipado del cliente) a una clave del diccionario. Las pantallas que
   hoy leen `status`/`body` a mano pasan a usarla cuando se migran en W3/W4; acá se escribe y se
   prueba contra los códigos de hoy (y contra `ErrorCode` cuando exista, `SPEC-613`).
5. **Los hooks optimistas pasan a las llaves de la fábrica**: `useFavoritos` (`lib/favoritos.ts`),
   `useMarcarLeida` (`lib/notificaciones.ts`) y los switches de `ProfileScreen` hoy usan
   `['investor','favorites']`, `['notifications']` y `['profile']`. `lib/optimista.ts` no cambia:
   recibe la llave que le pasen.

### Invariantes

1. **Ninguna request cambia**: misma cantidad, mismo orden, mismos paths. Lo verifica `pnpm e2e`.
2. **Ninguna pantalla cambia lo que muestra**: los tests de pantalla no cambian de expectativa.
3. **Lo que muestra un anclaje se reusa como mucho 10 s.** Lo fija un test sobre las fábricas.
4. **Los 324 `spyOn(api.…)` siguen andando**: la fábrica llama a `port.ts`, no lo reemplaza.

### Verificación

`pnpm verify:all`, `pnpm e2e` completo y, a mano, las DevTools de red: cambiar una etapa como
developer y volver al detalle del proyecto muestra el estado nuevo sin recargar.

### Cómo quedó

- **Las llaves**: `api/queries/<entidad>.ts`, una fábrica por entidad (`proyecto`, `etapa`,
  `unidad`, `contrato`, `dossier`, `evidencia`, `notificacion`, `invitacion`, `kpi`, `capital`,
  `usuario`, `favorito`, `certificado`, `auditoria`). Dos vistas del mismo recurso que pegan a
  endpoints distintos tienen llaves distintas bajo la misma raíz (`['proyecto', id]` y
  `['proyecto', id, 'developer']`), y los binarios viven en `archivo`, que ninguna invalidación toca.
- **Las invalidaciones**: `invalidaciones.ts`, una función por mutación que devuelve las llaves que
  deja viejas. `queries.test.ts` puebla una caché con una query por entrada de cada fábrica y fija,
  por mutación, cuáles quedan invalidadas. Crear un proyecto no invalidaba nada (con `staleTime` 0
  no hacía falta); ahora invalida las listas, unidades, KPIs y capital.
- **Lo que queda con la ventana corta de `ANCLAJE_MS`**: toda respuesta con TXID, `anchorStatus` o
  `signatureTxid`, lo que se reconcilia al leer (`GET /projects/:id`) y los KPIs que cuentan anclados
  (`verifiedDocuments` del developer; `verified` y `signed` del notary). La lista está en el test.
- **El invariante 1 vale para la fábrica, no para `staleTime`**: volver a una pantalla o a un filtro
  dentro de los 30 s ya no pide de nuevo, que es el objetivo del paso. Los dos tests que fijaban ese
  segundo pedido (los filtros "Todas" de las dos pantallas de notificaciones) ahora fijan lo
  contrario.
- **La caché es de una sesión**: con datos frescos 30 s, un 401 seguido de un login con otro usuario
  sin recargar la página mostraba lo del anterior. `requireRole` vacía la caché si encuentra un `me`
  de otro token.
- **`claveDeError(err, { porCodigo, generica })`** en `api/claveDeError.ts`, probada contra los
  status y `code` de hoy; ninguna pantalla la usa todavía (W3/W4). Suma la clave `error.generic`.

## Paso 2 — los loaders que precargan, sin tocar los componentes

**Por qué ahora y no en W3/W4** (dueño, 2026-10-06): W4 está detrás de A1, A2 y el piloto, y lo que
reescribe es el **componente** (`useQuery` → `useSuspenseQuery`), no el loader. Un loader escrito
hoy con `prefetchQuery(fabrica.x(id))` llega a W3/W4 y pasa a `ensureQueryData(fabrica.x(id))`: se
cambia una palabra por ruta. El beneficio —el pedido sale con el hover o el `touchstart`, antes del
click— no depende de nada de la API.

### Alcance

1. **Un `loader` por ruta que dispara sus queries con `prefetchQuery`, sin `await`**, con las
   `queryOptions` de la fábrica del Paso 1. El componente sigue con `useQuery` y con los estados de
   carga de [`SPEC-110`](archive/SPEC-110-estado-de-carga.md).
2. **`defaultPreloadStaleTime` se alinea con el `staleTime` del Paso 1** (hoy es 0 en
   `src/router.tsx`: el router volvería a correr el loader en cada hover).
3. **Por rol, un commit por rol**, empezando por el investor en el orden de su flujo:
   `investor.buy` → `project.$projectId.index` → `investor.unit.$unitId.index` y el resto del rol.
   Después `developer`, `certifier`, `notary`, `admin`.
4. **La única cascada que sale gratis**: `project.$projectId.index` pide los documentos recién cuando
   llegó el proyecto (`enabled: isSuccess`), aunque el `projectId` ya está en la URL. El loader pide
   los dos en paralelo. Las otras cascadas son dependencias reales y quedan en
   [`SPEC-616`](SPEC-616-el-resto-modulo-por-modulo.md) §Las cascadas.

### Invariantes

1. **Ninguna pantalla espera a su loader para montar**: el loader nunca hace `await` de datos.
2. **Una pantalla con loader y la misma sin loader muestran exactamente lo mismo**: los tests de
   pantalla no cambian de expectativa.
3. **Lo que muestra un anclaje se reusa como mucho 10 s**: la excepción del Paso 1 vale igual para
   lo precargado.
4. **Un test por ruta**: el loader llama a `prefetchQuery` con las mismas options que lee el
   componente.

### Medir antes del commit del investor

Un hover sobre un `ProjectCard` dispara `GET /projects/:id`, que **reconcilia al leer**
(`projects.routes.ts:483`, hasta `TOPE_POR_LECTURA` = 5 consultas a Blockfrost, y solo si hay
anclajes `Pending`). Con el `staleTime` del Paso 1, un hover repetido no vuelve a pedir. Contar en
las DevTools cuántos `GET /projects/:id` salen recorriendo el listado con el mouse, y si el número no
es razonable, el preload de esa ruta va con `preload: 'viewport'` o sin preload, no se quita el
loader.

### Verificación

`pnpm verify:all`, `pnpm e2e` completo y, a mano: hover sobre un `ProjectCard` → `GET /projects/:id`
sale **antes** del click; volver a `/investor/buy` dentro del `staleTime` no repite `GET /projects`.

### Cómo quedó

- **Un solo commit para todos los roles**, a pedido del dueño (2026-10-06), en vez de uno por rol.
  `routes/-loaders.test.ts` tiene un caso por ruta: el loader devuelve `undefined` (no hay nada que
  esperar) y precarga exactamente las options de la fábrica que lee el componente, con su
  `staleTime`.
- **Qué precarga cada loader**: lo que la pantalla pide con datos de la URL (params y search). Lo que
  depende de otra respuesta (el proyecto de una unidad, el bundle de una etapa, los blobs, el
  detalle que elige un `<select>` del admin) queda para `SPEC-616`. Los componentes compartidos
  cuentan: las rutas con `useFavoritos`, `ProfileScreen`, `AssignedStagesQueue` o
  `PendingDossiersQueue` precargan su query. `investor.buy` no precarga en la vista de mapa, porque
  la lista va acotada al recuadro visible, que el loader no conoce.
- **`defaultPreloadStaleTime` = 30 s** (`FRESCO_MS`).
- **Medido el 2026-10-06 con Playwright contra la app local:**
  - Hover sobre "Capital" en la navegación del developer: salen los tres `GET /developer/capital/*`
    antes del click. Un segundo hover no pide nada, y el click tampoco.
  - Click en una card de `/investor/buy`: `GET /projects/:id` y `/documents` salen juntos (antes,
    los documentos esperaban al proyecto).
  - **Lo anclado se pedía dos veces**: con `staleTime: 0`, lo que trajo el loader ya estaba viejo
    cuando la pantalla montaba (el chunk de la ruta tarda ~270 ms), y se volvía a pedir. Eran dos
    `GET /projects/:id` por navegación, que reconcilia al leer (hasta 5 consultas a Blockfrost si
    hay anclajes `Pending`), y lo mismo con los KPIs del developer: uno en el hover y otro al
    montar. Con la ventana de 10 s (dueño, 2026-10-06), medido otra vez: **uno** en cada caso. Lo
    reusado viene del servidor y tiene como mucho 10 s: a lo sumo dice `Pending` un rato más, nunca
    afirma una prueba que no tiene. Una pantalla montada tampoco se refrescaba sola con
    `staleTime: 0`; lo que cambia es solo si una pantalla que se abre en esos 10 s vuelve a pedir.
  - Volver a `/investor/buy` dentro de los 30 s: ningún pedido.
- **`AUTH-ME-001` rompía el token mientras la pantalla todavía pedía**: el loader adelanta los
  pedidos, un `unread-count` salía con el token roto, el 401 borraba la sesión y el `goto` iba a
  `/login` sin pasar por `/auth/me`. El test ahora espera `networkidle` antes de romperlo.
- **Las cards precargan con hover** (dueño, 2026-10-06). `ProjectCard` y `UnitCard` navegan con un
  `<button>`, y el preload por *intent* del router solo actúa sobre un `<Link>`. Siguen siendo
  botones (mismo rol, mismos tests) y suman `onIntent`: `useIntencion` (`lib/intencion.ts`) lo
  dispara cuando el puntero se queda 50 ms encima (la demora que usa el router en un `<Link>`), al
  enfocar o al tocar. Las pantallas pasan `{...abrir({ to, params })}`, de `useAbrirConPrecarga`,
  que da `onOpen` y `onIntent` con el mismo destino tipado. Medido: con el puntero encima de una
  card salen `GET /projects/:id` y `/documents` antes del click, y el click no pide nada más;
  pasar de largo no precarga. El seed tiene una sola card de proyecto, así que el barrido de una
  lista larga no está medido; cada card precarga a lo sumo una vez cada 30 s
  (`defaultPreloadStaleTime`).
