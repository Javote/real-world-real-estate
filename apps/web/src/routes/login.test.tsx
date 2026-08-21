// Tests del flujo de login.
// Monta LoginScreen en un router de memoria con un /dashboard stub: se prueba
// el flujo real del navegador (form → ApiPort → sesión → redirect), con el
// fetch mockeado — el test no depende de la API levantada.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { LoginScreen, ROLE_PRESETS } from './login'

const DEMO_USER = {
  id: 'u1',
  email: 'developer@example.com',
  role: 'developer',
  fullName: 'Developer Demo',
}

function makeRouter() {
  const rootRoute = createRootRoute({ component: Outlet })
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: LoginScreen,
  })
  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/dashboard',
    component: () => <div>DASHBOARD-STUB</div>,
  })
  const verifyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/verify',
    component: () => <div>VERIFY-STUB</div>,
  })
  return createRouter({
    routeTree: rootRoute.addChildren([loginRoute, dashboardRoute, verifyRoute]),
    history: createMemoryHistory({ initialEntries: ['/login'] }),
  })
}

async function renderLogin() {
  const router = makeRouter()
  render(<RouterProvider router={router} />)
  await screen.findByText('Ingresar')
  return router
}

describe('LoginScreen', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('login exitoso: llama a la API con las credenciales, guarda la sesión y redirige a /dashboard', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ token: 'jwt-de-prueba', user: DEMO_USER }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await renderLogin()
    fireEvent.click(screen.getByText('Ingresar'))

    await screen.findByText('DASHBOARD-STUB')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/login',
      expect.objectContaining({ method: 'POST' }),
    )
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body).toEqual({
      email: ROLE_PRESETS[0].email,
      password: ROLE_PRESETS[0].password,
    })

    const stored = JSON.parse(window.sessionStorage.getItem('proptrust.session') ?? 'null')
    expect(stored?.token).toBe('jwt-de-prueba')
    expect(stored?.user.email).toBe(DEMO_USER.email)
  })

  it('elegir otro rol precarga las credenciales de ese perfil del seed', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ token: 't', user: DEMO_USER }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await renderLogin()
    fireEvent.click(screen.getByText('Certifier'))
    fireEvent.click(screen.getByText('Ingresar'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.email).toBe('verifier@example.com')
    expect(body.password).toBe('verifier123')
  })

  it('credenciales inválidas (401): muestra el error, no redirige y no guarda sesión', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ message: 'Invalid credentials' }), { status: 401 }),
      ),
    )

    const router = await renderLogin()
    fireEvent.click(screen.getByText('Ingresar'))

    await screen.findByText('Credenciales inválidas')
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.queryByText('DASHBOARD-STUB')).toBeNull()
    expect(window.sessionStorage.getItem('proptrust.session')).toBeNull()
  })

  it('demasiados intentos (429): lo dice, en vez de culpar a la API caída', async () => {
    // Antes de D-045 cualquier status que no fuera 401 caía en el mensaje de
    // "¿está levantada?", que con un 429 es falso: la API está perfectamente
    // levantada y es justamente ella la que decidió cortar.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ message: 'Too many login attempts' }), { status: 429 }),
      ),
    )

    const router = await renderLogin()
    fireEvent.click(screen.getByText('Ingresar'))

    await screen.findByText(/Demasiados intentos/)
    expect(screen.queryByText(/No se pudo conectar/)).toBeNull()
    expect(router.state.location.pathname).toBe('/login')
    expect(window.sessionStorage.getItem('proptrust.session')).toBeNull()
  })

  it('API caída: muestra un mensaje accionable en lugar de romperse', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed')
    }))

    await renderLogin()
    fireEvent.click(screen.getByText('Ingresar'))

    await screen.findByText(/No se pudo conectar con la API/)
  })
})
