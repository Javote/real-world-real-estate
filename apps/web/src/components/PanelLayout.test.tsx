import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { clearSession, setSession } from '#/auth/session'
import { LocaleProvider } from '#/i18n/useTranslation'
import { PanelLayout } from './PanelLayout'

vi.mock('#/api/port', () => ({
  api: { getUnreadCount: vi.fn(async () => ({ unread: 0 })) }
}))

type Rol = 'investor' | 'developer' | 'notary' | 'certifier' | 'admin'

// Las pantallas a las que la campana y el perfil pueden llevar: el test lee
// dónde terminó el router, no un mock de `navigate`.
const DESTINOS = [
  '/admin',
  '/investor/profile',
  '/investor/notifications',
  '/developer',
  '/developer/profile',
  '/notary',
  '/notary/profile',
  '/certifier',
  '/certifier/profile'
]

function renderLayout(
  back?: { label: string; onClick: () => void },
  opciones: { rol?: Rol; headerAction?: ReactNode; context?: string } = {}
) {
  const { rol = 'developer', headerAction, context } = opciones
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
      <PanelLayout
        rol={rol}
        title="Inversores"
        {...(back ? { back } : {})}
        {...(headerAction ? { headerAction } : {})}
        {...(context ? { context } : {})}
      >
        <p>contenido</p>
      </PanelLayout>
    )
  })

  const stubs = [
    '/developer/projects',
    '/developer/capital',
    '/developer/units',
    '/developer/progress',
    ...DESTINOS.filter((d) => d !== '/developer')
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

  render(<RouterProvider router={router} />)
  return router
}

afterEach(() => clearSession())

describe('PanelLayout (D-074)', () => {
  it('siempre muestra logo, campana, perfil e idioma', async () => {
    renderLayout()

    const header = await screen.findByRole('banner')
    expect(header.textContent).toContain('Prop')
    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Mi perfil' })).toBeDefined()
    expect(screen.getByRole('group', { name: 'Idioma' })).toBeDefined()
  })

  it('con back la flecha queda y el logo no se va', async () => {
    renderLayout({ label: 'Volver al panel', onClick: vi.fn() })

    const header = await screen.findByRole('banner')
    const texto = header.textContent ?? ''
    expect(texto.indexOf('Prop')).toBeGreaterThanOrEqual(0)
    expect(texto.indexOf('Volver al panel')).toBeGreaterThan(texto.indexOf('Nexus'))
    expect(texto.indexOf('Inversores')).toBeGreaterThan(texto.indexOf('Volver al panel'))
  })

  // SPEC-103 (F-07): el aria-label de la campana decía solo "Notificaciones",
  // sin el dato que el prop `unread` ya tenía.
  describe('campana: el aria-label interpola el conteo real (SPEC-103)', () => {
    it('unread === 0 usa la clave sin contador', async () => {
      vi.mocked(api.getUnreadCount).mockResolvedValueOnce({ unread: 0 })
      renderLayout()

      expect(await screen.findByRole('button', { name: 'Notificaciones' })).toBeDefined()
    })

    it('unread > 9 dibuja "9+" pero el label dice el número real', async () => {
      vi.mocked(api.getUnreadCount).mockResolvedValueOnce({ unread: 42 })
      renderLayout()

      const campana = await screen.findByRole('button', { name: 'Notificaciones, 42 sin leer' })
      expect(campana.textContent).toContain('9+')
    })
  })
})

describe('PanelLayout · campana y perfil, por rol', () => {
  const casos: Array<[Exclude<Rol, 'admin'>, string, string]> = [
    ['investor', '/investor/notifications', '/investor/profile'],
    ['developer', '/developer', '/developer/profile'],
    ['notary', '/notary', '/notary/profile'],
    ['certifier', '/certifier', '/certifier/profile']
  ]

  it.each(casos)('%s: la campana va a %s y el perfil a %s', async (rol, campana, perfil) => {
    const router = renderLayout(undefined, { rol })

    await userEvent.click(await screen.findByRole('button', { name: 'Notificaciones' }))
    await waitFor(() => expect(router.state.location.pathname.replace(/\/$/, '')).toBe(campana))

    router.history.push('/developer/')
    await userEvent.click(await screen.findByRole('button', { name: 'Mi perfil' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(perfil))
  })

  it('el panel del admin (rol admin, sin sesión de admin) manda las dos cosas a /admin', async () => {
    const router = renderLayout(undefined, { rol: 'admin' })

    await userEvent.click(await screen.findByRole('button', { name: 'Notificaciones' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin'))

    router.history.push('/developer/')
    await userEvent.click(await screen.findByRole('button', { name: 'Mi perfil' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin'))
  })

  it('un admin dentro del panel de otro rol vuelve a SU pantalla (D-095)', async () => {
    setSession({
      token: 't',
      user: { id: 'u-adm', email: 'a@example.com', role: 'admin', fullName: 'Admin' }
    })
    const router = renderLayout(undefined, { rol: 'investor' })

    await userEvent.click(await screen.findByRole('button', { name: 'Notificaciones' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin'))

    router.history.push('/developer/')
    await userEvent.click(await screen.findByRole('button', { name: 'Mi perfil' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin'))
  })
})

describe('PanelLayout · slots opcionales', () => {
  it('con headerAction y context los pinta; sin ellos no', async () => {
    renderLayout(undefined, {
      headerAction: <button type="button">Nuevo</button>,
      context: 'Bienvenido, Ana'
    })

    expect(await screen.findByRole('button', { name: 'Nuevo' })).toBeDefined()
    expect(screen.getByText('Bienvenido, Ana')).toBeDefined()
  })

  it('sin headerAction no hay botón de acción', async () => {
    renderLayout()
    await screen.findByRole('banner')
    expect(screen.queryByRole('button', { name: 'Nuevo' })).toBeNull()
  })
})
