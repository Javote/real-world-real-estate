import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '#/i18n/useTranslation'
import { OfflineBanner } from './OfflineBanner'

function conRed(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)
}

function montar() {
  return render(
    <LocaleProvider>
      <OfflineBanner />
    </LocaleProvider>
  )
}

describe('OfflineBanner (D-101)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('con red no dibuja nada', () => {
    conRed(true)
    montar()
    expect(screen.queryByTestId('PWA-OFFLINE-BANNER-001')).toBeNull()
  })

  it('sin red avisa, con role=status, que lo de abajo puede no estar al día', () => {
    conRed(false)
    montar()
    const aviso = screen.getByRole('status')
    expect(aviso.getAttribute('data-testid')).toBe('PWA-OFFLINE-BANNER-001')
    expect(aviso.textContent).toContain('Sin conexión')
  })

  it('aparece al perder la red y se va al recuperarla, sin recargar', () => {
    conRed(true)
    const { unmount } = montar()
    conRed(false)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.queryByTestId('PWA-OFFLINE-BANNER-001')).not.toBeNull()
    conRed(true)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByTestId('PWA-OFFLINE-BANNER-001')).toBeNull()
    unmount()
  })
})
