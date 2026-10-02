# SPEC-614 — W2: la fábrica de queries por entidad y una sola `claveDeError`

> Fase 2, paso W2 ([`SPEC-611`](SPEC-611-la-migracion-fase-2.md)), junto con
> [`SPEC-609`](SPEC-609-el-cliente-sale-del-contrato.md); el estado, en [`specs/README.md`](README.md).
> Nivel 🟢. **No espera a la API**: se hace sobre el `port.ts` de hoy. Absorbe los puntos 2 a 4 de
> [`SPEC-602`](archive/SPEC-602-los-datos-arrancan-con-la-ruta.md); los loaders de esa spec van con
> cada pantalla, en W3/W4.

## Lo que hay hoy, medido el 2026-10-02

- **89 `queryKey` escritas a mano** fuera de los tests, y **18 `invalidateQueries`** que invalidan
  por rol: `['developer']` (3), `['certifier']` (2), `['notary']`, `['investor']`. Cambiar una etapa
  desde `developer.progress` deja vieja `['developer','project',id]` si las llaves no comparten
  prefijo. Hoy no se nota porque `staleTime` es 0 (salvo `me`, en `auth/requireRole.ts`).
- **Cada pantalla interpreta el `ApiError` sola**: 15 archivos comparan `status === 403` o leen
  `body` como `Record<…>`, y algunos mensajes de error vuelven en inglés (auditoría §3.1).

## Alcance

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

## Invariantes

1. **Ninguna request cambia**: misma cantidad, mismo orden, mismos paths. Lo verifica `pnpm e2e`.
2. **Ninguna pantalla cambia lo que muestra**: los tests de pantalla no cambian de expectativa.
3. **Nada que muestre un anclaje se sirve de caché fresca.** Lo fija un test sobre las fábricas.
4. **Los 324 `spyOn(api.…)` siguen andando**: la fábrica llama a `port.ts`, no lo reemplaza.

## Verificación

`pnpm verify:all`, `pnpm e2e` completo y, a mano, las DevTools de red: cambiar una etapa como
developer y volver al detalle del proyecto muestra el estado nuevo sin recargar.
