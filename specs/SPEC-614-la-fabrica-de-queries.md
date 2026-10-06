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
   anclaje (`anchorStatus`, TXID, `Pending`) mantiene `staleTime: 0`, porque depende de la
   reconciliación por lectura (D-077) y regla 17.
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
3. **Nada que muestre un anclaje se sirve de caché fresca.** Lo fija un test sobre las fábricas.
4. **Los 324 `spyOn(api.…)` siguen andando**: la fábrica llama a `port.ts`, no lo reemplaza.

### Verificación

`pnpm verify:all`, `pnpm e2e` completo y, a mano, las DevTools de red: cambiar una etapa como
developer y volver al detalle del proyecto muestra el estado nuevo sin recargar.

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
3. **Nada que muestre un anclaje se sirve de caché fresca**: la excepción del Paso 1 vale igual para
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
