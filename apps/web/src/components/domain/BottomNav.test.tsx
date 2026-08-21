import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { Heart, ShoppingBag } from 'lucide-react'
import { BottomNav, type BottomNavItem } from './BottomNav'
import { LocaleProvider } from '../../i18n/useTranslation'

const items: BottomNavItem[] = [
  { key: 'favorites', label: 'Favoritos', icon: Heart },
  { key: 'buy', label: 'Comprar', icon: ShoppingBag, to: '/investor/buy' },
]

function renderNav() {
  const rootRoute = createRootRoute({ component: Outlet })
  const buyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/investor/buy',
    component: () => (
      <>
        <div>BUY-SCREEN</div>
        <BottomNav items={items} />
      </>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([buyRoute]),
    history: createMemoryHistory({ initialEntries: ['/investor/buy'] }),
  })
  render(
    <LocaleProvider>
      <RouterProvider router={router} />
    </LocaleProvider>,
  )
  return router
}

describe('BottomNav', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => cleanup())

  it('invariante 9: un tab sin pantalla implementada todavía no navega y no rompe la app', async () => {
    const router = renderNav()
    await screen.findByText('BUY-SCREEN')

    // "Favoritos" no tiene `to`: se muestra pero tocarlo no hace nada.
    const [favoritesButton] = screen.getAllByText('Favoritos')
    fireEvent.click(favoritesButton)

    expect(router.state.location.pathname).toBe('/investor/buy')
    expect(screen.getAllByText('BUY-SCREEN').length).toBeGreaterThan(0)
  })
})
