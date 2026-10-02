import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  type AnyRoute,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '#/auth/session'
import { clearSession } from '#/auth/session'
import { NAV_TABS } from '#/components/domain/navTabs'
import { LocaleProvider } from '#/i18n/useTranslation'
import {
  ADMIN_USER,
  autenticarComo,
  CERTIFIER_USER,
  DEVELOPER_USER,
  INVESTOR_USER,
  NOTARY_USER
} from './-test-mount'
import { Route as AdminLayout } from './admin'
import { Route as CertifierLayout } from './certifier'
import { Route as DeveloperLayout } from './developer'
import { Route as InvestorLayout } from './investor'
import { Route as NotaryLayout } from './notary'
import { Route as ProjectLayout } from './project'

type Rol = keyof typeof NAV_TABS

const LAYOUTS: Array<[string, AnyRoute, Rol, Session['user'], Session['user'], string]> = [
  ['/investor', InvestorLayout, 'investor', INVESTOR_USER, DEVELOPER_USER, '/developer'],
  ['/project', ProjectLayout, 'investor', INVESTOR_USER, NOTARY_USER, '/notary'],
  ['/developer', DeveloperLayout, 'developer', DEVELOPER_USER, INVESTOR_USER, '/investor/buy'],
  ['/notary', NotaryLayout, 'notary', NOTARY_USER, CERTIFIER_USER, '/certifier'],
  ['/certifier', CertifierLayout, 'certifier', CERTIFIER_USER, NOTARY_USER, '/notary'],
  ['/admin', AdminLayout, 'admin', ADMIN_USER, DEVELOPER_USER, '/developer']
]

function montarLayout(prefijo: string, layout: AnyRoute, landing: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <Outlet />
        </LocaleProvider>
      </QueryClientProvider>
    )
  })
  const panel = createRoute({
    getParentRoute: () => root,
    path: prefijo,
    beforeLoad: layout.options.beforeLoad,
    component: layout.options.component
  })
  const pantalla = createRoute({
    getParentRoute: () => panel,
    path: '/',
    component: () => <p>PANTALLA</p>
  })
  const aterrizaje = createRoute({
    getParentRoute: () => root,
    path: landing,
    component: () => <p>ATERRIZAJE {landing}</p>
  })
  const router = createRouter({
    routeTree: root.addChildren([panel.addChildren([pantalla]), aterrizaje]),
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [prefijo] })
  })
  render(<RouterProvider router={router} />)
}

describe('los seis layouts de rol (SPEC-601)', () => {
  afterEach(() => {
    clearSession()
    vi.restoreAllMocks()
  })

  it.each(LAYOUTS)(
    '%s: con el rol del grupo monta el armazón con la navegación de su rol',
    async (prefijo, layout, rol, permitido, _otro, landing) => {
      autenticarComo(permitido)
      montarLayout(prefijo, layout, landing)

      await screen.findByText('PANTALLA')
      expect(screen.getByRole('banner')).toBeDefined()
      const destinos = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
      expect(destinos).toContain(NAV_TABS[rol][0].to)
    }
  )

  it.each(LAYOUTS)(
    '%s: un rol fuera del grupo va a su aterrizaje',
    async (prefijo, layout, _rol, _permitido, otro, landing) => {
      autenticarComo(otro)
      montarLayout(prefijo, layout, landing)

      await screen.findByText(`ATERRIZAJE ${landing}`)
      expect(screen.queryByText('PANTALLA')).toBeNull()
    }
  )
})
