import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cargarDiccionario } from '#/i18n/dictionary'
import { LocaleProvider } from '#/i18n/useTranslation'
import { LanguageToggle } from './LanguageToggle'

vi.mock('#/i18n/dictionary', async (original) => {
  const real = await original<typeof import('#/i18n/dictionary')>()
  return { ...real, cargarDiccionario: vi.fn(real.cargarDiccionario) }
})

describe('LanguageToggle', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.mocked(cargarDiccionario).mockClear()
  })

  it('muestra ES y EN, con el activo presionado, y cambia al tocar el otro', async () => {
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

    expect(await screen.findByRole('group', { name: 'Language' })).toBeTruthy()
    expect(en.getAttribute('aria-pressed')).toBe('true')
    expect(es.getAttribute('aria-pressed')).toBe('false')
    expect(window.localStorage.getItem('propnexus.lang')).toBe('en-US')
  })

  it('baja el diccionario con el hover o el foco, antes del click, y un fallo no rompe nada', async () => {
    vi.mocked(cargarDiccionario)
      .mockRejectedValueOnce(new Error('sin red'))
      .mockRejectedValueOnce(new Error('sin red'))
    render(
      <LocaleProvider>
        <LanguageToggle />
      </LocaleProvider>
    )
    const en = screen.getByRole('button', { name: 'English' })

    fireEvent.pointerEnter(en)
    fireEvent.focus(en)
    await Promise.resolve()

    expect(vi.mocked(cargarDiccionario).mock.calls).toEqual([['en-US'], ['en-US']])
    expect(screen.getByRole('group', { name: 'Idioma' })).toBeTruthy()
  })
})
