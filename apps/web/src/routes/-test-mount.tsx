import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  type AnyRoute,
  type AnyValidator,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  type RouteComponent,
  RouterProvider
} from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { vi } from 'vitest'
import { api } from '#/api/port'
import type { UserRole } from '#/api/types'
import { requireRole } from '#/auth/requireRole'
import { ADMIN_ROLES, CERTIFIER_ROLES, DEV_ROLES, INVESTOR_ROLES, NOTARY_ROLES } from '#/auth/roles'
import { type Session, setSession } from '#/auth/session'
import type { NAV_TABS } from '#/components/domain/navTabs'
import { PanelShell } from '#/components/PanelLayout'
import { LocaleProvider } from '#/i18n/useTranslation'

// Los mismos seis layouts de `src/routes/<prefijo>.tsx`: la pantalla se monta debajo del suyo.
const PANELES: Record<string, { rol: keyof typeof NAV_TABS; roles: readonly UserRole[] }> = {
  investor: { rol: 'investor', roles: INVESTOR_ROLES },
  project: { rol: 'investor', roles: INVESTOR_ROLES },
  developer: { rol: 'developer', roles: DEV_ROLES },
  notary: { rol: 'notary', roles: NOTARY_ROLES },
  certifier: { rol: 'certifier', roles: CERTIFIER_ROLES },
  admin: { rol: 'admin', roles: ADMIN_ROLES }
}

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

export const ADMIN_USER: Session['user'] = {
  id: 'u-adm',
  email: 'admin@example.com',
  role: 'admin',
  fullName: 'Admin Demo'
}

export function autenticarComo(user: Session['user']) {
  setSession({ token: 't', user })
  vi.spyOn(api, 'me').mockResolvedValue({
    ...user,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  })
  vi.spyOn(api, 'getUnreadCount').mockResolvedValue({ unread: 0 })
}

interface RutaMontable {
  options: {
    component?: RouteComponent
    validateSearch?: AnyValidator
  }
}

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
  const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
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

  const prefijo = path.split('/')[1] ?? ''
  const panel = PANELES[prefijo]
  const layout = panel
    ? createRoute({
        getParentRoute: () => rootRoute,
        path: `/${prefijo}`,
        beforeLoad: requireRole(panel.roles),
        component: () => <PanelShell rol={panel.rol} />
      })
    : undefined
  const debajoDelLayout = (ruta: string) =>
    ruta === `/${prefijo}` || ruta.startsWith(`/${prefijo}/`)
  const relativa = (ruta: string) => ruta.slice(prefijo.length + 1) || '/'

  const hijosDelLayout: AnyRoute[] = []
  const sueltas: AnyRoute[] = []
  const crear = (ruta: string, component: RouteComponent, extra = {}) => {
    if (layout && debajoDelLayout(ruta)) {
      hijosDelLayout.push(
        createRoute({ getParentRoute: () => layout, path: relativa(ruta), component, ...extra })
      )
    } else {
      sueltas.push(
        createRoute({ getParentRoute: () => rootRoute, path: ruta, component, ...extra })
      )
    }
  }

  crear(path, Componente, { validateSearch })
  for (const ruta of rutasExtra) crear(ruta, () => <div>{ruta}</div>)

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      loginRoute,
      ...(layout ? [layout.addChildren(hijosDelLayout)] : []),
      ...sueltas
    ]),
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [entrada ?? path] })
  })
  render(<RouterProvider router={router} />)
  return router
}
