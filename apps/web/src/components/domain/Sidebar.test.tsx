import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NAV_TABS } from './navTabs'
import { Sidebar } from './Sidebar'

function renderSidebar(initialPath: string) {
  const tabs = NAV_TABS.developer.map((tab) => ({
    ...tab,
    label: tab.to === '/developer' ? 'Panel' : tab.to.slice('/developer/'.length)
  }))

  const rootRoute = createRootRoute({
    component: () => (
      <>
        <Sidebar tabs={tabs} ariaLabel="Navegación" />
        <Outlet />
      </>
    )
  })

  const children = [
    '/developer/',
    '/developer/projects',
    '/developer/capital',
    '/developer/units',
    '/developer/progress'
  ].map((path) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => <div>{path}</div>
    })
  )

  const router = createRouter({
    routeTree: rootRoute.addChildren(children),
    history: createMemoryHistory({ initialEntries: [initialPath] })
  })

  return render(<RouterProvider router={router} />)
}

describe('Sidebar (M2-D3 §Principle 4) · tab activo', () => {
  it('en una subruta solo pinta el tab propio, no el panel', async () => {
    renderSidebar('/developer/capital')

    const capital = await screen.findByRole('link', { name: 'capital' })
    const panel = screen.getByRole('link', { name: 'Panel' })

    expect(capital.getAttribute('data-status')).toBe('active')
    expect(panel.getAttribute('data-status')).not.toBe('active')
  })

  it('trae la marca PropNexus', async () => {
    renderSidebar('/developer/')

    const nav = await screen.findByRole('navigation', { name: 'Navegación' })
    expect(nav.textContent).toContain('Prop')
    expect(nav.textContent).toContain('Nexus')
  })

  // SPEC-103 (F-06): mismo criterio que BottomNav — el sidebar de desktop
  // pintaba el tab activo solo con una píldora de color, sin anunciarlo.
  it('exactamente un aria-current="page", y coincide con el tab resaltado', async () => {
    renderSidebar('/developer/capital')

    const capital = await screen.findByRole('link', { name: 'capital' })
    expect(capital.getAttribute('aria-current')).toBe('page')

    const otros = ['Panel', 'projects', 'units', 'progress'].map((nombre) =>
      screen.getByRole('link', { name: nombre })
    )
    for (const link of otros) {
      expect(link.getAttribute('aria-current')).toBeNull()
    }
  })
})
