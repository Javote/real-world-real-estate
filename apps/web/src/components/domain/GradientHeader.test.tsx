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
})
