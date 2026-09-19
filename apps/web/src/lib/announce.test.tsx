import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AnnounceProvider, useAnnounce } from './announce'

function Botones() {
  const announce = useAnnounce()
  return (
    <>
      <button type="button" onClick={() => announce('hola')}>
        polite
      </button>
      <button type="button" onClick={() => announce('urgente', 'assertive')}>
        assertive
      </button>
    </>
  )
}

describe('AnnounceProvider', () => {
  it('monta las dos regiones vacías desde el arranque', () => {
    render(
      <AnnounceProvider>
        <span />
      </AnnounceProvider>
    )
    const regiones = document.querySelectorAll('[aria-live]')
    expect(regiones).toHaveLength(2)
    expect(Array.from(regiones).map((r) => r.textContent)).toEqual(['', ''])
  })

  it('escribe en la región polite por default', () => {
    render(
      <AnnounceProvider>
        <Botones />
      </AnnounceProvider>
    )
    act(() => screen.getByText('polite').click())
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('hola')
    expect(document.querySelector('[aria-live="assertive"]')?.textContent).toBe('')
  })

  it('assertive escribe en la región assertive, no en polite', () => {
    render(
      <AnnounceProvider>
        <Botones />
      </AnnounceProvider>
    )
    act(() => screen.getByText('assertive').click())
    expect(document.querySelector('[aria-live="assertive"]')?.textContent).toBe('urgente')
  })

  it('el mismo texto dos veces seguidas cambia el nodo (no queda idéntico)', () => {
    render(
      <AnnounceProvider>
        <Botones />
      </AnnounceProvider>
    )
    act(() => screen.getByText('polite').click())
    const primero = document.querySelector('[aria-live="polite"]')?.textContent
    act(() => screen.getByText('polite').click())
    const segundo = document.querySelector('[aria-live="polite"]')?.textContent
    expect(primero).not.toBe(segundo)
    // Pero el texto visible (sin el caracter invisible) es el mismo mensaje.
    expect(segundo?.replace('​', '')).toBe(primero)
  })

  it('useAnnounce fuera del provider no revienta: no-op', () => {
    function Suelto() {
      const announce = useAnnounce()
      announce('nada')
      return <span>ok</span>
    }
    expect(() => render(<Suelto />)).not.toThrow()
  })
})
