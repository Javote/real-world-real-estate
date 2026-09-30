# SPEC-601 — El guard de rol vive en el router, no en cada pantalla

> Serie `6xx`, refactor post-M3 ([`PROPUESTA-2026-09-30-refactor-post-m3.md`](PROPUESTA-2026-09-30-refactor-post-m3.md)).
> **No es mandato hasta entregar M3.** Nivel 🟡: toca la capa de auth del front. La autorización
> real sigue en la API (regla 5) y no cambia.

## Lo que hay hoy, medido el 2026-09-30

| Qué | Cuánto |
|---|---|
| Rutas de `apps/web/src/routes` | 44 |
| Rutas que llaman a `useRoleGuard(...)` | **40**: las 40 con `if (!ready) return null` |
| Queries apagadas con `enabled: ready` | **63** |
| Rutas con `loader` o `beforeLoad` | **0** |
| Grupos: `INVESTOR_ROLES` 14 (`investor.*` 10 + `project.*` 4) · `DEV_ROLES` 15 · `NOTARY_ROLES` 5 · `CERTIFIER_ROLES` 5 · `ADMIN_ROLES` 1 | coinciden **exactamente** con el prefijo del path |

`useRoleGuard` (`src/auth/useRoleGuard.ts`) corre en un `useEffect` después del primer render. Llama
a `api.me()` **sin pasar por React Query**, así que:

1. **Cada navegación entre pantallas** protegidas pinta en blanco (`return null`), hace un
   `GET /auth/me` nuevo y recién entonces habilita las queries de la pantalla. Es una cascada
   `chunk → /auth/me → datos` en cada cambio de ruta, no solo después del login.
2. La API paga en cada una ~2 viajes a Turso (`authenticate` + el handler de `/me`), a ~100 ms cada
   uno según lo medido ([`PROPUESTA`](PROPUESTA-2026-09-30-refactor-post-m3.md) §Del login).
3. El mismo bloque (guard + `if (!ready)` + `enabled: ready`) está copiado 40 veces.

## Alcance

1. **`me` pasa a ser una query**, `['auth', 'me']`, con `staleTime` de unos minutos (el número va en
   la implementación, justificado). La lee el guard y la puede leer cualquier pantalla que hoy saca
   el usuario de `getSession()`.
2. **El `QueryClient` entra al contexto del router** (`createRootRouteWithContext<{ queryClient }>()`
   en `__root.tsx`, `context: { queryClient }` en `getRouter`). `main.tsx` deja de crear el
   `QueryClient` por su cuenta y usa el mismo.
3. **Una función de guard, `requireRole(allowed)`, para usar en `beforeLoad`**, en
   `src/auth/requireRole.ts`, con **la misma semántica que `useRoleGuard`**:
   - Sin sesión local → `throw redirect({ to: '/login' })`.
   - `queryClient.ensureQueryData(me)`. Un `ApiError` 401 limpia la sesión y redirige a `/login`.
     **Un error de red deja pasar** con la sesión local, igual que hoy.
   - El admin pasa siempre (D-095). Cualquier otro rol fuera del grupo va a
     `ROLE_LANDING[rol]`, no a `/login`.
   - Devuelve `{ session }` al contexto, para que la pantalla lo lea con `Route.useRouteContext()`.
4. **Seis rutas de layout, una por prefijo**: `investor.tsx`, `project.tsx`, `developer.tsx`,
   `notary.tsx`, `certifier.tsx`, `admin.tsx`. Cada una tiene `beforeLoad: requireRole(GRUPO)` y
   renderiza `<Outlet />`. **No se renombra ninguna ruta.** Los `.index.tsx` ya existen justamente
   para que el archivo sin `.index` quede libre como layout (ver el comentario de
   `developer.index.tsx`).
5. **Las 40 pantallas pierden** `useRoleGuard`, `if (!ready) return null` y los 63 `enabled: ready`.
   `context={session ? … : undefined}` pasa a leer la sesión del contexto de ruta, que ya no puede
   ser `null`. Con eso se van también los `v8 ignore` que existían solo por esa rama.
6. **`useRoleGuard` se borra**, con su test. Los casos del test se mudan a `requireRole.test.ts`,
   uno por uno (ver §Invariantes).

## Invariantes (los mismos de hoy, más uno)

1. **Un rol sin permiso va a SU landing**, nunca a `/login` ni a la ruta pedida (invariante 1 de
   la vieja SPEC-011, hoy en `useRoleGuard.test.tsx`).
2. **Un token rechazado (401 en `/auth/me`) limpia la sesión y va a `/login`** (invariante 12).
3. **Un error de red en `/auth/me` no desloguea.**
4. **El admin entra a cualquier superficie** (D-095).
5. **Nuevo: navegar entre dos pantallas del mismo rol no dispara un `/auth/me`** mientras `me`
   esté fresco. Se prueba contando llamadas a `fetch`.
6. **Nuevo: ninguna pantalla protegida renderiza `null` por esperar autorización.** El router
   resuelve `beforeLoad` antes de montar el componente.
7. `request()` sigue limpiando la sesión ante cualquier 401. Además, **invalida `['auth','me']`**,
   para que la próxima navegación vuelva a pasar por el guard con el estado real.

## Riesgos

- **Los tests de pantalla.** `-test-mount.tsx` monta cada pantalla en un router sintético. Tiene
  que aprender a colgarla de un layout con `beforeLoad` (o de un contexto con `session` ya
  resuelta). Es el grueso del trabajo: 40 archivos de test.
- **El umbral de cobertura de `apps/web` es 100/100/100/100** (SPEC-019). `requireRole` llega con
  su test completo en el mismo commit.
- **`defaultPreload: 'intent'` pasa a ejecutar `beforeLoad` al hacer hover.** Con `me` cacheado no
  cuesta una request. Sin caché, cada hover sería un `/auth/me`: por eso el punto 1 va primero.

## Verificación

- `pnpm verify:all` en verde.
- A mano, con las DevTools de red, en local con la API: login de buyer → `/investor/buy` →
  `/investor/units` → `/investor/favorites`. **Un solo `/auth/me` en todo el recorrido**, y ningún
  frame en blanco entre pantallas.
- `pnpm e2e` completo: el guard es transversal y lo toca todo.

## Qué se toca en el mismo commit

`apps/web/CLAUDE.md` (si describe el patrón del guard) y la fila de esta spec en `specs/README.md`.

## Tamaño

Mediano: una función nueva, 6 layouts de 5 líneas, y un cambio mecánico en 40 pantallas y sus
40 tests. Se puede partir por rol (un commit por layout y sus pantallas): cada rol queda coherente
por separado, y `useRoleGuard` se borra en el último.
