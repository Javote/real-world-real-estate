import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CERTIFIER_ROLES } from './roles'
import { type Session, setSession } from './session'
import { useRoleGuard } from './useRoleGuard'

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

function GuardedScreen() {
  const { ready } = useRoleGuard(CERTIFIER_ROLES)
  if (!ready) return null
  return <div>CERTIFIER-READY</div>
}

function makeRouter(initial: string) {
  const rootRoute = createRootRoute({ component: Outlet })
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
  const certifierRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/certifier',
    component: GuardedScreen
  })
  return createRouter({
    routeTree: rootRoute.addChildren([loginRoute, developerRoute, certifierRoute]),
    history: createMemoryHistory({ initialEntries: [initial] })
  })
}

describe('useRoleGuard', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('sin sesión: redirige a /login', async () => {
    const router = makeRouter('/certifier')
    render(<RouterProvider router={router} />)

    await screen.findByText('LOGIN-STUB')
  })

  it('invariante 1: rol sin permiso redirige a SU landing, no a /login ni a la ruta pedida', async () => {
    setSession({ token: 't', user: DEVELOPER_USER })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(DEVELOPER_USER), { status: 200 }))
    )

    const router = makeRouter('/certifier')
    render(<RouterProvider router={router} />)

    await screen.findByText('DEVELOPER-STUB')
  })

  it('sesión válida + rol permitido + /auth/me ok: renderiza la pantalla', async () => {
    setSession({ token: 't', user: CERTIFIER_USER })
    const meMock = vi.fn(async () => new Response(JSON.stringify(CERTIFIER_USER), { status: 200 }))
    vi.stubGlobal('fetch', meMock)

    const router = makeRouter('/certifier')
    render(<RouterProvider router={router} />)

    await screen.findByText('CERTIFIER-READY')
    expect(meMock).toHaveBeenCalledWith('/api/v1/auth/me', expect.anything())
  })

  it('invariante 12: token inválido/expirado en /auth/me redirige a /login y limpia la sesión', async () => {
    setSession({ token: 'expirado', user: CERTIFIER_USER })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'Invalid token' }), { status: 401 }))
    )

    const router = makeRouter('/certifier')
    render(<RouterProvider router={router} />)

    await screen.findByText('LOGIN-STUB')
    expect(window.sessionStorage.getItem('proptrust.session')).toBeNull()
  })
})
