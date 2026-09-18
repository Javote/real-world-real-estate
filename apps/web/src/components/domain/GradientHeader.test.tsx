import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GradientHeader } from './GradientHeader'

describe('GradientHeader', () => {
  it('con back el logo sigue y la flecha queda entre la marca y el título (D-074)', () => {
    render(
      <GradientHeader title="Inversores" back={{ label: 'Volver al panel', onClick: vi.fn() }} />
    )

    const header = screen.getByRole('banner')
    const texto = header.textContent ?? ''
    expect(texto.indexOf('Prop')).toBeGreaterThanOrEqual(0)
    expect(texto.indexOf('Volver al panel')).toBeGreaterThan(texto.indexOf('Nexus'))
    expect(texto.indexOf('Inversores')).toBeGreaterThan(texto.indexOf('Volver al panel'))
  })

  it('sin back no hay flecha y el logo queda', () => {
    render(<GradientHeader title="Panel" />)

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('banner').textContent).toContain('Prop')
  })

  // SPEC-103 (F-05): `document.title` era "PropNexus" en las 42 rutas.
  // GradientHeader es el único lugar que pinta el `h1` real de una pantalla
  // —directo o vía PanelLayout— así que es el único lugar que hace falta
  // tocar.
  describe('document.title (SPEC-103, F-05)', () => {
    it('publica el título con el sufijo de marca', () => {
      render(<GradientHeader title="Inversores" />)
      expect(document.title).toBe('Inversores · PropNexus')
    })

    it('la marca sola no se duplica (login: title={t("app.name")})', () => {
      render(<GradientHeader title="PropNexus" />)
      expect(document.title).toBe('PropNexus')
    })

    it('cambia en el mismo tick que el título — toggle de idioma sin recargar', () => {
      const { rerender } = render(<GradientHeader title="Inversores" />)
      expect(document.title).toBe('Inversores · PropNexus')

      rerender(<GradientHeader title="Investors" />)
      expect(document.title).toBe('Investors · PropNexus')
    })
  })
})
