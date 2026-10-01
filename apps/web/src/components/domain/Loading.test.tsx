import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LocaleProvider } from '#/i18n/useTranslation'
import { Loading } from './Loading'

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
