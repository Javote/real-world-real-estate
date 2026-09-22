// Helper compartido para montar una pantalla de ruta protegida por
// `useRoleGuard`, con QueryClient + i18n + router de memoria — el mismo
// armado que `-login.test.tsx` y `queues.test.tsx` repetían archivo por
// archivo. Nace en la tanda notary de SPEC-017 §paso 5.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider
} from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { vi } from 'vitest'
import { api } from '#/api/port'
import { type Session, setSession } from '#/auth/session'
import { LocaleProvider } from '#/i18n/useTranslation'

export const NOTARY_USER: Session['user'] = {
  id: 'u-not',
  email: 'notary@example.com',
  role: 'notary',
  fullName: 'Notary Demo'
}

export const CERTIFIER_USER: Session['user'] = {
  id: 'u-cer',
  email: 'verifier@example.com',
  role: 'verifier',
  fullName: 'Certifier Demo'
}

/**
 * Deja la sesión puesta y `api.me()`/`api.getUnreadCount()` resueltos: lo que
 * `useRoleGuard` y `PanelLayout`/`NotificationBell` piden en cada pantalla
 * protegida, sin repetirlo en cada test.
 */
export function autenticarComo(user: Session['user']) {
  setSession({ token: 't', user })
  vi.spyOn(api, 'me').mockResolvedValue({
    ...user,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  })
  vi.spyOn(api, 'getUnreadCount').mockResolvedValue({ unread: 0 })
}

/** Monta `Componente` en `path`, con las rutas extra que la pantalla necesite para navegar. */
export function montarRuta(
  Componente: () => React.ReactElement,
  path: string,
  rutasExtra: string[] = [],
  entrada?: string
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <Outlet />
        </LocaleProvider>
      </QueryClientProvider>
    )
  })
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: () => <div>LOGIN-STUB</div>
  })
  const pantalla = createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: Componente
  })
  const stubs = rutasExtra.map((ruta) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: ruta,
      component: () => <div>{ruta}</div>
    })
  )
  const router = createRouter({
    routeTree: rootRoute.addChildren([loginRoute, pantalla, ...stubs]),
    history: createMemoryHistory({ initialEntries: [entrada ?? path] })
  })
  render(<RouterProvider router={router} />)
  return router
}
