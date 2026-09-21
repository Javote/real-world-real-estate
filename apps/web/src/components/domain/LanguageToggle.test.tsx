import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { LocaleProvider } from '#/i18n/useTranslation'
import { LanguageToggle } from './LanguageToggle'

// D-096: los dos idiomas a la vista, el activo marcado con `aria-pressed`.

describe('LanguageToggle', () => {
  beforeEach(() => window.localStorage.clear())

  it('muestra ES y EN, con el activo presionado, y cambia al tocar el otro', () => {
    render(
      <LocaleProvider>
        <LanguageToggle />
      </LocaleProvider>
    )
    expect(screen.getByRole('group', { name: 'Idioma' })).toBeTruthy()
    const es = screen.getByRole('button', { name: 'Español' })
    const en = screen.getByRole('button', { name: 'English' })
    expect(es.getAttribute('aria-pressed')).toBe('true')
    expect(en.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(en)

    expect(screen.getByRole('group', { name: 'Language' })).toBeTruthy()
    expect(en.getAttribute('aria-pressed')).toBe('true')
    expect(es.getAttribute('aria-pressed')).toBe('false')
    expect(window.localStorage.getItem('propnexus.lang')).toBe('en-US')
  })
})
