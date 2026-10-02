import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DangerButton, PrimaryButton, SecondaryButton } from './PrimaryButton'

describe('loading en las tres variantes de botón', () => {
  it('PrimaryButton: muestra el spinner y se deshabilita', () => {
    render(<PrimaryButton loading>Guardar</PrimaryButton>)
    expect(screen.getByRole('button')).toHaveProperty('disabled', true)
    expect(document.querySelector('.animate-spin')).not.toBeNull()
  })

  it('SecondaryButton: muestra el spinner y se deshabilita', () => {
    render(<SecondaryButton loading>Guardar</SecondaryButton>)
    expect(screen.getByRole('button')).toHaveProperty('disabled', true)
    expect(document.querySelector('.animate-spin')).not.toBeNull()
  })

  it('DangerButton: muestra el spinner y se deshabilita', () => {
    render(<DangerButton loading>Borrar</DangerButton>)
    expect(screen.getByRole('button')).toHaveProperty('disabled', true)
    expect(document.querySelector('.animate-spin')).not.toBeNull()
  })

  it('sin loading, ninguno muestra el spinner', () => {
    render(
      <>
        <PrimaryButton>A</PrimaryButton>
        <SecondaryButton>B</SecondaryButton>
        <DangerButton>C</DangerButton>
      </>
    )
    expect(document.querySelector('.animate-spin')).toBeNull()
  })
})
