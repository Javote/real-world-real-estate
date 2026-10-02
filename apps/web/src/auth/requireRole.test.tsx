import { QueryClient } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider
} from '@tanstack/react-router'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/port'
import { requireRole } from './requireRole'
import { CERTIFIER_ROLES } from './roles'
import { getSession, type Session, setSession } from './session'

const CERTIFIER_USER: Session['user'] = {
  id: 'u-cer',
  email: 'verifier@example.com',
  role: 'verifier',
  fullName: 'Certifier Demo'
}
const DEVELOPER_USER: Session['user'] = {
  id: 'u-dev',
  email: 'developer@example.com',
  role: 'developer',
  fullName: 'Developer Demo'
}
const ADMIN_USER: Session['user'] = {
  id: 'u-adm',
  email: 'admin@example.com',
  role: 'admin',
  fullName: 'Admin Demo'
}

const sesionesVistas: Array<Session | undefined> = []

function makeRouter(initial: string) {
  const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    component: Outlet
  })
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: () => <div>LOGIN-STUB</div>
  })
  const developerRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/developer',
    component: () => <div>DEVELOPER-STUB</div>
  })
  const certifierLayout = createRoute({
    getParentRoute: () => rootRoute,
    path: '/certifier',
    beforeLoad: requireRole(CERTIFIER_ROLES),
    component: Outlet
  })
  const panel = createRoute({
    getParentRoute: () => certifierLayout,
    path: '/',
    component: function Panel() {
      const { session } = panel.useRouteContext()
      sesionesVistas.push(session)
      return <div>CERTIFIER-READY {session.user.fullName}</div>
    }
  })
  const otra = createRoute({
    getParentRoute: () => certifierLayout,
    path: 'otra',
    component: () => <div>CERTIFIER-OTRA</div>
  })
  return createRouter({
    routeTree: rootRoute.addChildren([
      loginRoute,
      developerRoute,
      certifierLayout.addChildren([panel, otra])
    ]),
    context: { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
    history: createMemoryHistory({ initialEntries: [initial] })
  })
}

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status })

describe('requireRole', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    sesionesVistas.length = 0
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('sin sesión: redirige a /login', async () => {
    render(<RouterProvider router={makeRouter('/certifier')} />)

    await screen.findByText('LOGIN-STUB')
  })

  it('invariante 1: rol sin permiso redirige a SU landing, no a /login ni a la ruta pedida', async () => {
    setSession({ token: 't', user: DEVELOPER_USER })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuesta(DEVELOPER_USER))
    )

    render(<RouterProvider router={makeRouter('/certifier')} />)

    await screen.findByText('DEVELOPER-STUB')
  })

  it('sesión válida + rol permitido + /auth/me ok: renderiza la pantalla con la sesión en el contexto', async () => {
    setSession({ token: 't', user: CERTIFIER_USER })
    const meMock = vi.fn(async () => respuesta(CERTIFIER_USER))
    vi.stubGlobal('fetch', meMock)

    render(<RouterProvider router={makeRouter('/certifier')} />)

    await screen.findByText('CERTIFIER-READY Certifier Demo')
    expect(meMock).toHaveBeenCalledWith('/api/v1/auth/me', expect.anything())
  })

  it('invariante 12: token inválido/expirado en /auth/me redirige a /login y limpia la sesión', async () => {
    setSession({ token: 'expirado', user: CERTIFIER_USER })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuesta({ message: 'Invalid token' }, 401))
    )

    render(<RouterProvider router={makeRouter('/certifier')} />)

    await screen.findByText('LOGIN-STUB')
    expect(getSession()).toBeNull()
  })

  it('un error de red en /auth/me no desloguea: deja pasar con la sesión local', async () => {
    setSession({ token: 't', user: CERTIFIER_USER })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      })
    )

    render(<RouterProvider router={makeRouter('/certifier')} />)

    await screen.findByText('CERTIFIER-READY Certifier Demo')
  })

  it('el admin entra a cualquier superficie (D-095)', async () => {
    setSession({ token: 't', user: ADMIN_USER })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuesta(ADMIN_USER))
    )

    render(<RouterProvider router={makeRouter('/certifier')} />)

    await screen.findByText('CERTIFIER-READY Admin Demo')
  })

  it('invariante 5: navegar entre dos pantallas del mismo rol no repite /auth/me mientras `me` está fresco', async () => {
    setSession({ token: 't', user: CERTIFIER_USER })
    const meMock = vi.fn(async () => respuesta(CERTIFIER_USER))
    vi.stubGlobal('fetch', meMock)
    const router = makeRouter('/certifier')

    render(<RouterProvider router={router} />)
    await screen.findByText('CERTIFIER-READY Certifier Demo')

    router.history.push('/certifier/otra')
    await screen.findByText('CERTIFIER-OTRA')
    router.history.push('/certifier')
    await screen.findByText('CERTIFIER-READY Certifier Demo')

    expect(meMock).toHaveBeenCalledTimes(1)
  })

  it('invariante 6: la pantalla no se monta hasta que el guard resolvió, y nunca sin sesión', async () => {
    setSession({ token: 't', user: CERTIFIER_USER })
    let resolver: (r: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((r) => {
            resolver = r
          })
      )
    )

    render(<RouterProvider router={makeRouter('/certifier')} />)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(sesionesVistas).toEqual([])

    resolver(respuesta(CERTIFIER_USER))
    await screen.findByText('CERTIFIER-READY Certifier Demo')
    expect(sesionesVistas.length).toBeGreaterThan(0)
    expect(sesionesVistas.every((s) => s?.user.id === CERTIFIER_USER.id)).toBe(true)
  })

  it('invariante 7: después de un 401 la próxima navegación vuelve a pasar por el guard', async () => {
    setSession({ token: 't', user: CERTIFIER_USER })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuesta(CERTIFIER_USER))
    )
    const router = makeRouter('/certifier')

    render(<RouterProvider router={router} />)
    await screen.findByText('CERTIFIER-READY Certifier Demo')

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuesta({ message: 'Invalid token' }, 401))
    )
    await expect(api.getUnreadCount()).rejects.toMatchObject({ status: 401 })
    expect(getSession()).toBeNull()

    router.history.push('/certifier/otra')
    await screen.findByText('LOGIN-STUB')
  })

  it('un login nuevo no reusa el `me` del anterior: el token es parte de la llave', async () => {
    setSession({ token: 't1', user: CERTIFIER_USER })
    const meMock = vi.fn(async () => respuesta(CERTIFIER_USER))
    vi.stubGlobal('fetch', meMock)
    const router = makeRouter('/certifier')

    render(<RouterProvider router={router} />)
    await screen.findByText('CERTIFIER-READY Certifier Demo')

    setSession({ token: 't2', user: CERTIFIER_USER })
    router.history.push('/certifier/otra')
    await screen.findByText('CERTIFIER-OTRA')

    expect(meMock).toHaveBeenCalledTimes(2)
  })
})
