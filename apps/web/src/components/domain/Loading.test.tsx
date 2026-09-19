import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LocaleProvider } from '#/i18n/useTranslation'
import { Loading } from './Loading'

// SPEC-110 (F-18) — el único componente compartido de esta spec, así que es
// el único que lleva test (invariante 4: las 30 rutas no lo tienen).

describe('Loading', () => {
  it('anuncia "cargando" con role=status, no algo que interrumpa', () => {
    render(
      <LocaleProvider>
        <Loading />
      </LocaleProvider>
    )
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('Cargando')
  })
})
