import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { LocaleProvider } from '#/i18n/useTranslation'
import { AssignedStagesQueue } from './AssignedStagesQueue'
import { PendingDossiersQueue } from './PendingDossiersQueue'

// SPEC-105 (F-08) — las dos colas envolvían un SecondaryButton dentro de un
// <Link>: HTML inválido (<a> no admite contenido interactivo) y violación
// nested-interactive de axe. El fix es que el botón navegue — un solo
// elemento interactivo, verificado acá por AUSENCIA de <a> en el árbol y
// porque el click sí navega.

function montar(Componente: () => React.ReactElement, rutaActual: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const rootRoute = createRootRoute()
  const listaRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: rutaActual,
    component: Componente
  })
  const destinoRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/notary/dossier/$dossierId',
    component: () => <div>DOSSIER-STUB</div>
  })
  const destinoStageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/certifier/stage/$stageId',
    component: () => <div>STAGE-STUB</div>
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([listaRoute, destinoRoute, destinoStageRoute]),
    history: createMemoryHistory({ initialEntries: [rutaActual] })
  })
  render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <RouterProvider router={router} />
      </LocaleProvider>
    </QueryClientProvider>
  )
  return router
}

describe('PendingDossiersQueue', () => {
  afterEach(() => vi.restoreAllMocks())

  it('el botón "Revisar" no está anidado dentro de un <a>, y navega al click', async () => {
    vi.spyOn(api, 'getNotaryPendingDossiers').mockResolvedValue([
      { dossierId: 'd1', unitLabel: 'Torre A · 4B', investorName: 'Ana Torres', completeness: 60 }
    ])

    montar(() => <PendingDossiersQueue />, '/notary')

    const boton = await screen.findByText('Revisar')
    expect(boton.closest('a')).toBeNull()

    await userEvent.click(boton)
    await screen.findByText('DOSSIER-STUB')
  })

  it('SPEC-106 (F-11): la fila usa bg-card, no bg-surface-alt', async () => {
    vi.spyOn(api, 'getNotaryPendingDossiers').mockResolvedValue([
      { dossierId: 'd1', unitLabel: 'Torre A · 4B', investorName: 'Ana Torres', completeness: 60 }
    ])

    montar(() => <PendingDossiersQueue />, '/notary')

    const fila = (await screen.findByText('Ana Torres')).closest('li')
    expect(fila?.className).toContain('bg-card')
    expect(fila?.className).not.toContain('bg-surface-alt')
  })
})

describe('AssignedStagesQueue', () => {
  afterEach(() => vi.restoreAllMocks())

  it('el botón "Certify" no está anidado dentro de un <a>, y navega al click', async () => {
    vi.spyOn(api, 'getCertifierAssignments').mockResolvedValue([
      { stageId: 's1', projectName: 'Torre A', stageName: 'Cimentación', sequenceOrder: 1 }
    ])

    montar(() => <AssignedStagesQueue />, '/certifier')

    const boton = await screen.findByText('Certificar')
    expect(boton.closest('a')).toBeNull()

    await userEvent.click(boton)
    await screen.findByText('STAGE-STUB')
  })

  it('SPEC-106 (F-11): la fila usa bg-card, no bg-surface-alt', async () => {
    vi.spyOn(api, 'getCertifierAssignments').mockResolvedValue([
      { stageId: 's1', projectName: 'Torre A', stageName: 'Cimentación', sequenceOrder: 1 }
    ])

    montar(() => <AssignedStagesQueue />, '/certifier')

    const fila = (await screen.findByText('Torre A')).closest('li')
    expect(fila?.className).toContain('bg-card')
    expect(fila?.className).not.toContain('bg-surface-alt')
  })
})
