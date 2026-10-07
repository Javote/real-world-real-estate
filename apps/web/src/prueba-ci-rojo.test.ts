import { expect, it } from 'vitest'

it('prueba de CI 2: falla a propósito para ver que un rojo frena el deploy', () => {
  expect(1).toBe(2)
})
