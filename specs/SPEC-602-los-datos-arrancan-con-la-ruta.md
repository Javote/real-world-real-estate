# SPEC-602 — Los datos arrancan con la ruta, no después del primer render

> Serie `6xx`, refactor post-M3 ([`PROPUESTA-2026-09-30-refactor-post-m3.md`](PROPUESTA-2026-09-30-refactor-post-m3.md)).
> **No es mandato hasta entregar M3.** Nivel 🟢. **Depende de [`SPEC-601`](SPEC-601-el-guard-de-rol-vive-en-el-router.md)**:
> sin el `QueryClient` en el contexto del router, un loader no tiene contra qué precargar.

## Lo que hay hoy, medido el 2026-09-30

- **Ninguna ruta tiene `loader`.** Las queries viven en los componentes (`useQuery` en 39 archivos).
  Arrancan cuando el componente monta, y hoy además después de que `useRoleGuard` resuelve.
- `getRouter()` declara `defaultPreload: 'intent'` y `defaultPreloadStaleTime: 0`. **Sin loaders,
  el preload por intent solo baja el chunk JS**: el hover sobre un link no adelanta ningún dato.
- El `QueryClient` de `main.tsx` usa `staleTime` 0, el default. Volver a una pantalla ya visitada
  **siempre** refetchea. Lo mismo pasa con `GET /notifications/unread-count` de `PanelLayout`, que
  se re-pide en cada navegación porque el layout se vuelve a montar.

## Alcance

1. **Un `loader` por ruta que precarga sus queries con `prefetchQuery`, sin `await`.** El loader
   dispara las requests y devuelve enseguida; el componente sigue leyendo con `useQuery`, **con la
   misma `queryKey` y la misma `queryFn`**. Se elige `prefetchQuery` en lugar de
   `await ensureQueryData` a propósito:
   - **No bloquea la navegación** detrás de la red. La pantalla aparece enseguida con su estado de
     carga.
   - **Los estados de carga de [`SPEC-110`](archive/SPEC-110-estado-de-carga.md) se quedan como están**:
     `isPending` sigue significando lo mismo.
2. **Las `queryOptions` se definen una vez**, en `src/api/queries.ts` (por ejemplo
   `queries.projects(params)`, `queries.favorites()`), y las usan tanto el loader como el
   componente. Sin esto, una `queryKey` escrita dos veces diverge, y el prefetch llena una entrada
   de caché que nadie lee.
3. **`staleTime` por defecto de ~30 s** en el `QueryClient` (el número va en la implementación,
   justificado), para que el preload por intent no se tire antes del click y volver a una pantalla
   no pida todo de nuevo. Las mutaciones siguen invalidando lo que corresponde (hoy hay 18
   `invalidateQueries`), así que un dato viejo no sobrevive a un cambio propio.
   **Excepción:** lo que muestra un anclaje `Pending` depende de la reconciliación por lectura
   (D-077). Esas queries mantienen `staleTime: 0`: si no, un anclaje que ya confirmó se seguiría
   viendo `Pending` desde la caché.
4. `defaultPreloadStaleTime` se alinea con lo anterior. Con `0`, el router vuelve a correr el
   loader en cada hover.

## Invariantes

1. **Ninguna pantalla espera a su loader para montar.** El loader nunca hace `await` de datos.
2. **Una pantalla con loader y la misma sin loader muestran exactamente lo mismo**; el loader
   solo adelanta. Los tests de pantalla existentes no cambian de expectativa.
3. **Nada que muestre un anclaje se sirve de caché fresca** (punto 3, excepción). Lo fija un test.
4. **Regla 17 intacta:** un dato precargado es el mismo dato; no se muestra ninguna señal de
   prueba que no haya venido del servidor.

## Verificación

- `pnpm verify:all` en verde.
- A mano, con las DevTools de red: hover sobre un `ProjectCard` → la request de
  `GET /projects/:id` sale **antes** del click. Volver a `/investor/buy` dentro de los 30 s no
  repite `GET /projects`.
- Un test por ruta que el loader llama a `prefetchQuery` con las mismas options que el componente.

## Tamaño

Mediano y mecánico: un `queries.ts` nuevo más un loader corto por ruta. Se puede hacer por rol,
igual que `SPEC-601`.
