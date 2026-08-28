import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '#/i18n/useTranslation'
import { PanelLayout } from './PanelLayout'

vi.mock('#/api/port', () => ({
  api: { getUnreadCount: vi.fn(async () => ({ unread: 0 })) }
}))

function renderLayout(back?: { label: string; onClick: () => void }) {
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <LocaleProvider>
          <Outlet />
        </LocaleProvider>
      </QueryClientProvider>
    )
  })

  const page = createRoute({
    getParentRoute: () => rootRoute,
    path: '/developer/',
    component: () => (
      <PanelLayout rol="developer" title="Inversores" {...(back ? { back } : {})}>
        <p>contenido</p>
      </PanelLayout>
    )
  })

  const stubs = [
    '/developer/projects',
    '/developer/capital',
    '/developer/units',
    '/developer/progress',
    '/developer/profile'
  ].map((path) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => <div>{path}</div>
    })
  )

  const router = createRouter({
    routeTree: rootRoute.addChildren([page, ...stubs]),
    history: createMemoryHistory({ initialEntries: ['/developer/'] })
  })

  return render(<RouterProvider router={router} />)
}

describe('PanelLayout (D-074)', () => {
  it('siempre muestra logo, campana, perfil e idioma', async () => {
    renderLayout()

    const header = await screen.findByRole('banner')
    expect(header.textContent).toContain('Prop')
    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Mi perfil' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Idioma' })).toBeDefined()
  })

  it('con back la flecha queda y el logo no se va', async () => {
    renderLayout({ label: 'Volver al panel', onClick: vi.fn() })

    const header = await screen.findByRole('banner')
    const texto = header.textContent ?? ''
    expect(texto.indexOf('Prop')).toBeGreaterThanOrEqual(0)
    expect(texto.indexOf('Volver al panel')).toBeGreaterThan(texto.indexOf('Nexus'))
    expect(texto.indexOf('Inversores')).toBeGreaterThan(texto.indexOf('Volver al panel'))
  })
})
