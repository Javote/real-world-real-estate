// Tests del flujo de login.
// Monta LoginScreen en un router de memoria con un /dashboard stub: se prueba
// el flujo real del navegador (form → ApiPort → sesión → redirect), con el
// fetch mockeado — el test no depende de la API levantada.

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider
} from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../i18n/useTranslation'
import { AnnounceProvider } from '../lib/announce'
import { LoginScreen, ROLE_PRESETS } from './login'

const DEMO_USER = {
  id: 'u1',
  email: 'developer@example.com',
  role: 'developer',
  fullName: 'Developer Demo'
}

function makeRouter() {
  const rootRoute = createRootRoute({ component: Outlet })
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: LoginScreen
  })
  const verifyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/verify',
    component: () => <div>VERIFY-STUB</div>
  })
  const investorRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/investor/buy',
    component: () => <div>INVESTOR-STUB</div>
  })
  const developerRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/developer',
    component: () => <div>DEVELOPER-STUB</div>
  })
  const notaryRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/notary',
    component: () => <div>NOTARY-STUB</div>
  })
  const certifierRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/certifier',
    component: () => <div>CERTIFIER-STUB</div>
  })
  return createRouter({
    routeTree: rootRoute.addChildren([
      loginRoute,
      verifyRoute,
      investorRoute,
      developerRoute,
      notaryRoute,
      certifierRoute
    ]),
    history: createMemoryHistory({ initialEntries: ['/login'] })
  })
}

async function renderLogin() {
  const router = makeRouter()
  render(
    <LocaleProvider>
      <AnnounceProvider>
        <RouterProvider router={router} />
      </AnnounceProvider>
    </LocaleProvider>
  )
  await screen.findByText('Ingresar')
  return router
}

describe('LoginScreen', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('login exitoso: llama a la API con las credenciales, guarda la sesión y redirige al panel del rol devuelto', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ token: 'jwt-de-prueba', user: DEMO_USER }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)

    await renderLogin()
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'la-del-seed' } })
    fireEvent.click(screen.getByText('Ingresar'))

    // DEMO_USER.role === 'developer' → /developer (invariante 2: el ruteo
    // usa el rol de la respuesta, no la solapa tocada).
    await screen.findByText('DEVELOPER-STUB')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/login',
      expect.objectContaining({ method: 'POST' })
    )
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body).toEqual({
      email: ROLE_PRESETS[0].email,
      password: 'la-del-seed'
    })

    const stored = JSON.parse(window.sessionStorage.getItem('proptrust.session') ?? 'null')
    expect(stored?.token).toBe('jwt-de-prueba')
    expect(stored?.user.email).toBe(DEMO_USER.email)
  })

  it('elegir otro rol precarga solo el usuario: la contraseña queda vacía', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ token: 't', user: DEMO_USER }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)

    await renderLogin()
    expect((screen.getByLabelText('Contraseña') as HTMLInputElement).value).toBe('')

    // Lo tipeado bajo una solapa no se arrastra a otra.
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'otra' } })
    fireEvent.click(screen.getByText('Certifier'))
    expect((screen.getByLabelText('Usuario') as HTMLInputElement).value).toBe(
      'verifier@example.com'
    )
    expect((screen.getByLabelText('Contraseña') as HTMLInputElement).value).toBe('')

    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'la-del-seed' } })
    fireEvent.click(screen.getByText('Ingresar'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.email).toBe('verifier@example.com')
    expect(body.password).toBe('la-del-seed')
  })

  it('invariante 2: rutea por el rol que devuelve la API, no por la solapa tocada', async () => {
    // Se toca la solapa Certifier pero la API responde con un usuario
    // developer (podría pasar con cualquier credencial válida bajo la solapa
    // equivocada) — el ruteo tiene que ir a /developer, no a /certifier.
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ token: 't', user: DEMO_USER }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)

    await renderLogin()
    fireEvent.click(screen.getByText('Certifier'))
    fireEvent.click(screen.getByText('Ingresar'))

    await screen.findByText('DEVELOPER-STUB')
    expect(screen.queryByText('CERTIFIER-STUB')).toBeNull()
  })

  it('login exitoso como rol notary aterriza en /notary', async () => {
    const notaryUser = {
      id: 'u2',
      email: 'notary@example.com',
      role: 'notary',
      fullName: 'Notary Demo'
    }
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ token: 't', user: notaryUser }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)

    await renderLogin()
    fireEvent.click(screen.getByText('Notary'))
    fireEvent.click(screen.getByText('Ingresar'))

    await screen.findByText('NOTARY-STUB')
  })

  it('credenciales inválidas (401): muestra el error, no redirige y no guarda sesión', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: 'Invalid credentials' }), { status: 401 })
      )
    )

    const router = await renderLogin()
    fireEvent.click(screen.getByText('Ingresar'))

    // El mismo texto ahora también vive en la live region assertive (SPEC-104):
    // se scopea al párrafo visible para no matchear las dos.
    await screen.findByText('Credenciales inválidas', { selector: 'p' })
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.queryByText('DEVELOPER-STUB')).toBeNull()
    expect(window.sessionStorage.getItem('proptrust.session')).toBeNull()
    // SPEC-104 (F-03): el mismo texto que se ve se anuncia, assertive porque
    // invalida el submit en curso.
    expect(document.querySelector('[aria-live="assertive"]')?.textContent).toBe(
      'Credenciales inválidas'
    )
  })

  it('demasiados intentos (429): lo dice, en vez de culpar a la API caída', async () => {
    // Antes de D-045 cualquier status que no fuera 401 caía en el mensaje de
    // "¿está levantada?", que con un 429 es falso: la API está perfectamente
    // levantada y es justamente ella la que decidió cortar.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: 'Too many login attempts' }), { status: 429 })
      )
    )

    const router = await renderLogin()
    fireEvent.click(screen.getByText('Ingresar'))

    await screen.findByText(/Demasiados intentos/, { selector: 'p' })
    expect(screen.queryByText(/No se pudo conectar/)).toBeNull()
    expect(router.state.location.pathname).toBe('/login')
    expect(window.sessionStorage.getItem('proptrust.session')).toBeNull()
  })

  it('cambio de idioma antes de autenticarse: no pierde lo tipeado en los inputs', async () => {
    vi.stubGlobal('fetch', vi.fn())

    await renderLogin()
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'alguien@example.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'un-secreto' } })

    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    await screen.findByLabelText('Username')

    expect((screen.getByLabelText('Username') as HTMLInputElement).value).toBe(
      'alguien@example.com'
    )
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('un-secreto')
  })

  it('API caída: muestra un mensaje accionable en lugar de romperse', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      })
    )

    await renderLogin()
    fireEvent.click(screen.getByText('Ingresar'))

    await screen.findByText(/No se pudo conectar con la API/, { selector: 'p' })
  })
})
