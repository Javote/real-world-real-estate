import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearSession } from '#/auth/session'
import { LocaleProvider } from '#/i18n/useTranslation'
import { getRouter } from './router'

// El router real, con el árbol de rutas generado: cubre `router.tsx` y la raíz
// (`__root.tsx`, un `<Outlet />`). Los providers viven en `main.tsx` (D-065), así
// que el test los pone por fuera del router, como hace el bootstrap.
describe('getRouter (el router real)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    clearSession()
    window.history.replaceState(null, '', '/')
  })

  it('arma el router con el árbol de rutas generado', () => {
    const router = getRouter()

    expect(router.routesByPath['/login']).toBeDefined()
    expect(router.routesByPath['/public/dossier/$shareToken']).toBeDefined()
    expect(router.options.defaultPreload).toBe('intent')
    expect(router.options.scrollRestoration).toBe(true)
  })

  it('la raíz renderiza la ruta hija: sin sesión, "/" termina en el login', async () => {
    clearSession()
    window.history.replaceState(null, '', '/')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <RouterProvider router={getRouter()} />
        </LocaleProvider>
      </QueryClientProvider>
    )

    await screen.findByRole('button', { name: /ingresar|entrar|iniciar/i })
    expect(window.location.pathname).toBe('/login')
  })
})
