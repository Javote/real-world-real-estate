import { describe, expect, it } from 'vitest'
import { NAV_TABS } from './navTabs'

// M2-D3 §Foundation · BottomNav §Usage rules define las cuatro composiciones,
// con su orden. Este test las fija: si alguien agrega un tab "porque hace
// falta", se pone rojo — y agregar un tab es cambiar el entregable, no el
// código.

describe('composiciones del BottomNav', () => {
  it('INV: Menu · Favorites · Buy (FAB) · Units · User', () => {
    expect(NAV_TABS.investor.map((t) => t.labelKey)).toEqual([
      'nav.investor.menu',
      'nav.investor.favorites',
      'nav.investor.buy',
      'nav.investor.units',
      'nav.investor.user'
    ])
  })

  it('solo el investor tiene FAB, y es el tab del medio', () => {
    const fabs = NAV_TABS.investor.filter((t) => t.fab)
    expect(fabs).toHaveLength(1)
    expect(NAV_TABS.investor.indexOf(fabs[0]!)).toBe(2)

    for (const rol of ['developer', 'notary', 'certifier'] as const) {
      expect(NAV_TABS[rol].some((t) => t.fab)).toBe(false)
    }
  })

  it('DEV: Panel · Projects · Capital · Units · Progress', () => {
    expect(NAV_TABS.developer.map((t) => t.labelKey)).toEqual([
      'nav.developer.panel',
      'nav.developer.projects',
      'nav.developer.capital',
      'nav.developer.units',
      'nav.developer.progress'
    ])
  })

  it('NOT y CER tienen 4 tabs; INV y DEV, 5', () => {
    expect(NAV_TABS.investor).toHaveLength(5)
    expect(NAV_TABS.developer).toHaveLength(5)
    expect(NAV_TABS.notary).toHaveLength(4)
    expect(NAV_TABS.certifier).toHaveLength(4)
  })

  it('ningún tab apunta dos veces al mismo path', () => {
    for (const [rol, tabs] of Object.entries(NAV_TABS)) {
      const paths = tabs.map((t) => t.to)
      expect(new Set(paths).size, rol).toBe(paths.length)
    }
  })
})
