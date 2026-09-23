import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider
} from '@tanstack/react-router'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { LocaleProvider } from '#/i18n/useTranslation'
import { BottomNav, tabNeedsExactMatch } from './BottomNav'
import { BuildingSchematic, type SchematicUnit } from './BuildingSchematic'
import { GradientHeader } from './GradientHeader'
import { LanguageToggle } from './LanguageToggle'
import { NAV_TABS } from './navTabs'
import { ProgressBar } from './ProgressBar'

// SPEC-019 W8 · R11: las variantes de props de los componentes de estructura.

describe('GradientHeader · slots', () => {
  it('sin badge muestra el logo; con badge, el badge ocupa su lugar', () => {
    const { rerender } = render(<GradientHeader title="Panel" />)
    expect(screen.getByRole('banner').textContent).toContain('Prop')

    rerender(<GradientHeader title="Panel" badge={<span>TA</span>} />)
    expect(screen.getByText('TA')).toBeDefined()
    expect(screen.getByRole('banner').textContent).not.toContain('Prop')
  })

  it('subtítulo, contexto, acción del título y utilidades solo se dibujan si vienen', () => {
    const { rerender } = render(<GradientHeader title="Panel" />)
    expect(screen.queryByText('Torre A')).toBeNull()
    expect(screen.queryByText('Bienvenido')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()

    rerender(
      <GradientHeader
        title="Panel"
        subtitle="Torre A"
        context="Bienvenido"
        titleAction={<button type="button">Nuevo</button>}
        right={<button type="button">Utilidad</button>}
        className="extra"
      />
    )
    expect(screen.getByText('Torre A')).toBeDefined()
    expect(screen.getByText('Bienvenido')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Nuevo' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Utilidad' })).toBeDefined()
  })
})

describe('LanguageToggle · el idioma activo', () => {
  beforeEach(() => window.localStorage.clear())

  it('tocar el idioma que ya está activo no cambia nada', () => {
    render(
      <LocaleProvider>
        <LanguageToggle />
      </LocaleProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Español' }))

    expect(screen.getByRole('button', { name: 'Español' }).getAttribute('aria-pressed')).toBe(
      'true'
    )
    expect(window.localStorage.getItem('propnexus.lang')).not.toBe('en-US')
  })
})

describe('ProgressBar', () => {
  it('sin showValue no escribe el número; con showValue lo escribe redondeado', () => {
    const { rerender } = render(<ProgressBar percent={42.4} />)
    expect(screen.queryByText('42%')).toBeNull()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('42')

    rerender(<ProgressBar percent={42.4} showValue className="extra" />)
    expect(screen.getByText('42%')).toBeDefined()
  })

  it('acota a 0-100: ni negativos ni pasados de rosca', () => {
    const { rerender } = render(<ProgressBar percent={-20} />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')

    rerender(<ProgressBar percent={250} />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100')
  })
})

describe('BottomNav · tab central', () => {
  function montar(tabs: Parameters<typeof BottomNav>[0]['tabs']) {
    const root = createRootRoute({
      component: () => (
        <>
          <BottomNav tabs={tabs} ariaLabel="Navegación" />
          <Outlet />
        </>
      )
    })
    const inicio = createRoute({ getParentRoute: () => root, path: '/', component: () => null })
    const router = createRouter({
      routeTree: root.addChildren([inicio]),
      history: createMemoryHistory({ initialEntries: ['/'] })
    })
    return render(<RouterProvider router={router} />)
  }

  it('el tab del FAB es el elevado y lleva su badge; los demás son planos', async () => {
    const tabs = NAV_TABS.investor.map((t) => ({ ...t, label: t.to }))
    montar(tabs)

    const compra = await screen.findByRole('link', { name: '/investor/buy' })
    expect(compra.className).toContain('-mt-s6')
    expect(compra.querySelector('span.rounded-full')).not.toBeNull()

    const menu = screen.getByRole('link', { name: '/investor/menu' })
    expect(menu.className).not.toContain('-mt-s6')
    expect(menu.querySelector('span.rounded-full')).toBeNull()
  })

  it('un tab que es prefijo de otro pide coincidencia exacta; uno hoja, no', () => {
    const tabs = NAV_TABS.developer
    expect(tabNeedsExactMatch('/developer', tabs)).toBe(true)
    expect(tabNeedsExactMatch('/developer/capital', tabs)).toBe(false)
  })
})

describe('BuildingSchematic · variantes', () => {
  const labels = {
    title: 'Esquema',
    available: 'Disponible',
    occupied: 'Ocupada',
    mine: 'Tu unidad',
    access: 'ACCESO',
    floorPrefix: 'P'
  }
  const units: SchematicUnit[] = [
    { id: 'a', unitReference: '2B', floor: 2, state: 'available' },
    { id: 'b', unitReference: '2A', floor: 2, state: 'occupied' },
    { id: 'c', unitReference: '1A', floor: 1, state: 'mine' }
  ]

  it('dibuja los pisos de mayor a menor, ordena las unidades y marca la propia', () => {
    render(<BuildingSchematic projectName="Torre A" units={units} labels={labels} />)

    expect(screen.getAllByText(/^P\d$/).map((n) => n.textContent)).toEqual(['P2', 'P1'])
    expect(screen.getAllByText(/^[12][AB]$/).map((n) => n.textContent)).toEqual(['2A', '2B', '1A'])
    expect(screen.getByText('1A').getAttribute('aria-current')).toBe('true')
    expect(screen.getByText('2A').getAttribute('aria-current')).toBeNull()
    // El piso de la unidad propia se resalta.
    expect(screen.getByText('P1').className).toContain('text-primary')
    expect(screen.getByText('P2').className).toContain('text-text-muted')
  })

  it('sin callout ni aviso no dibuja esos párrafos; con ellos sí', () => {
    const { rerender } = render(
      <BuildingSchematic projectName="Torre A" units={units} labels={labels} />
    )
    expect(screen.queryByText('Estás en el piso 1')).toBeNull()
    expect(screen.queryByText('Vista de referencia')).toBeNull()

    rerender(
      <BuildingSchematic
        projectName="Torre A"
        units={units}
        className="extra"
        labels={{ ...labels, callout: 'Estás en el piso 1', disclaimer: 'Vista de referencia' }}
      />
    )
    expect(screen.getByText('Estás en el piso 1')).toBeDefined()
    expect(screen.getByText('Vista de referencia')).toBeDefined()
  })

  it('si ninguna unidad es propia, ningún piso se resalta', () => {
    render(
      <BuildingSchematic
        projectName="Torre A"
        units={units.filter((u) => u.state !== 'mine')}
        labels={labels}
      />
    )
    expect(screen.getByText('P2').className).not.toContain('text-primary')
  })
})
