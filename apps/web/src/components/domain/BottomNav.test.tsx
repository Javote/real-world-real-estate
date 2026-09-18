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
import { BottomNav } from './BottomNav'
import { NAV_TABS } from './navTabs'

function renderNav(initialPath: string) {
  const tabs = NAV_TABS.developer.map((tab) => ({
    ...tab,
    label: tab.to === '/developer' ? 'Panel' : tab.to.slice('/developer/'.length)
  }))

  const rootRoute = createRootRoute({
    component: () => (
      <>
        <BottomNav tabs={tabs} ariaLabel="Navegación" />
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

describe('BottomNav · tab activo', () => {
  it('en una subruta solo pinta el tab propio, no el panel', async () => {
    renderNav('/developer/capital')

    const capital = await screen.findByRole('link', { name: 'capital' })
    const panel = screen.getByRole('link', { name: 'Panel' })

    expect(capital.getAttribute('data-status')).toBe('active')
    expect(panel.getAttribute('data-status')).not.toBe('active')
  })

  it('en el panel pinta solo Panel', async () => {
    renderNav('/developer/')

    const panel = await screen.findByRole('link', { name: 'Panel' })
    const capital = screen.getByRole('link', { name: 'capital' })

    expect(panel.getAttribute('data-status')).toBe('active')
    expect(capital.getAttribute('data-status')).not.toBe('active')
  })

  // SPEC-103 (F-06): el tab activo se distinguía solo por color y peso — sin
  // aria-current, la navegación no anuncia dónde está quien usa un lector de
  // pantalla.
  it('exactamente un aria-current="page", y coincide con el tab resaltado', async () => {
    renderNav('/developer/capital')

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
