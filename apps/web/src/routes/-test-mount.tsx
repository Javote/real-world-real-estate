// Helper compartido para montar una pantalla de ruta protegida por
// `useRoleGuard`, con QueryClient + i18n + router de memoria — el mismo
// armado que `-login.test.tsx` y `queues.test.tsx` repetían archivo por
// archivo. Nace en la tanda notary de SPEC-017 §paso 5.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  type AnyValidator,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  type RouteComponent,
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

export const DEVELOPER_USER: Session['user'] = {
  id: 'u-dev',
  email: 'developer@example.com',
  role: 'developer',
  fullName: 'Developer Demo'
}

export const INVESTOR_USER: Session['user'] = {
  id: 'u-inv',
  email: 'investor@example.com',
  role: 'buyer',
  fullName: 'Investor Demo'
}

/** Entra a cualquier pantalla por el bypass de `useRoleGuard` (D-095). */
export const ADMIN_USER: Session['user'] = {
  id: 'u-adm',
  email: 'admin@example.com',
  role: 'admin',
  fullName: 'Admin Demo'
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

/** Lo mínimo que `montarRuta` necesita de una `Route` real de TanStack Router. */
interface RutaMontable {
  options: {
    component?: RouteComponent
    validateSearch?: AnyValidator
  }
}

/**
 * Monta una pantalla en `path`, con las rutas extra que necesite para navegar.
 *
 * Acepta el componente pelado (forma vieja, la que usan los tests de notary y
 * certifier) o la `Route` real (`Route.options.component` **y**
 * `validateSearch`, para pantallas como `investor.buy`/`investor.notifications`
 * cuyo parseo de query solo corre si `validateSearch` está declarado — sin
 * esto esas ~30 ramas no se ejecutan nunca).
 */
export function montarRuta(
  componente: RouteComponent | RutaMontable,
  path: string,
  rutasExtra: string[] = [],
  entrada?: string
) {
  const esRuta = typeof componente !== 'function'
  const Componente = esRuta ? componente.options.component : componente
  const validateSearch = esRuta ? componente.options.validateSearch : undefined
  if (!Componente) throw new Error(`montarRuta: la ruta de "${path}" no declara un component`)

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
    component: Componente,
    validateSearch
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
