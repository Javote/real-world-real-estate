import { describe, expect, it } from 'vitest'
import { axe } from './a11y'

describe('axe-core smoke test (SPEC-112)', () => {
  it('detecta un <img> sin alt', async () => {
    const container = document.createElement('div')
    container.innerHTML = '<img src="foo.png" />'
    document.body.appendChild(container)
    const results = await axe(container)
    expect(results.violations.some((v) => v.id === 'image-alt')).toBe(true)
  })

  it('un control con aria-label correcto pasa limpio', async () => {
    const container = document.createElement('div')
    container.innerHTML = '<button aria-label="Cerrar">X</button>'
    document.body.appendChild(container)
    expect(await axe(container)).toHaveNoViolations()
  })
})
