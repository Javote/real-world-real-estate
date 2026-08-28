import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GradientHeader } from './GradientHeader'

describe('GradientHeader', () => {
  it('con hideBrand el back reemplaza al logo (patrón A)', () => {
    render(
      <GradientHeader
        title="Mis proyectos"
        hideBrand
        back={{ label: 'Volver al panel', onClick: vi.fn() }}
      />
    )

    expect(screen.getByRole('button', { name: 'Volver al panel' })).toBeDefined()
    expect(screen.queryByText('Prop')).toBeNull()
  })

  it('sin hideBrand el back queda entre el logo y el título (patrón B)', () => {
    render(<GradientHeader title="Audit log" back={{ label: 'Volver', onClick: vi.fn() }} />)

    const header = screen.getByRole('banner')
    const texto = header.textContent ?? ''
    expect(texto.indexOf('Prop')).toBeGreaterThanOrEqual(0)
    expect(texto.indexOf('Volver')).toBeGreaterThan(texto.indexOf('Nexus'))
    expect(texto.indexOf('Audit log')).toBeGreaterThan(texto.indexOf('Volver'))
  })
})
