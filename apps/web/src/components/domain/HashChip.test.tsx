import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HashChip, truncateHash } from './HashChip'

// M2-D4 Pattern 2 · la regla de truncado es normativa: "First 6 characters
// after the '0x' prefix, ellipsis, last 4 characters."

const HASH = '0xdcd5da16f89f6a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f43fa9aa7994'

describe('truncateHash', () => {
  it('trunca a 6+4 contando el prefijo, como el ejemplo del entregable', () => {
    // "0xdcd5...7994" — el ejemplo literal de M2-D4. Ver D-069: el texto de la
    // regla dice "6 después del prefijo" y su propio ejemplo muestra 6
    // contándolo. Gana el ejemplo.
    expect(truncateHash(HASH)).toBe('0xdcd5...7994')
  })

  it('trunca igual sin prefijo', () => {
    expect(truncateHash('a'.repeat(64))).toBe('aaaaaa...aaaa')
  })

  it('deja pasar entero lo que es más corto que la truncación', () => {
    // Truncar "abc123" a 6+4 lo haría más largo. La regla existe para que no
    // desborde, no para ocultar por ocultar.
    expect(truncateHash('abc123')).toBe('abc123')
  })
})

describe('HashChip', () => {
  it('muestra truncado pero copia el hash COMPLETO', async () => {
    const escribir = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText: escribir } })

    render(<HashChip hash={HASH} copyLabel="Copiar" copiedLabel="Copiado" />)

    expect(screen.getByText('0xdcd5...7994')).toBeDefined()
    await userEvent.click(screen.getByLabelText('Copiar'))

    // La truncación es de presentación: el valor que viaja es el entero
    // (regla 16). Copiar el truncado haría inverificable el anclaje.
    expect(escribir).toHaveBeenCalledWith(HASH)
  })

  it('sin onOpenDetail no es cliqueable — no lleva a ningún lado', () => {
    render(<HashChip hash={HASH} copyLabel="Copiar" copiedLabel="Copiado" />)
    // Solo el botón de copia.
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('con onOpenDetail el chip abre el modal, y copiar NO lo abre', async () => {
    const abrir = vi.fn()
    const escribir = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText: escribir } })

    render(<HashChip hash={HASH} onOpenDetail={abrir} copyLabel="Copiar" copiedLabel="Copiado" />)

    await userEvent.click(screen.getByLabelText('Copiar'))
    expect(abrir).not.toHaveBeenCalled()

    await userEvent.click(screen.getByText('0xdcd5...7994'))
    expect(abrir).toHaveBeenCalledOnce()
  })
})
