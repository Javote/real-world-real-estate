import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NotificationBell } from './NotificationBell'

// M2-D3: "Badge displays '9+' when count exceeds 9".

describe('NotificationBell', () => {
  it('sin no leídos no muestra badge', () => {
    render(<NotificationBell unread={0} onClick={vi.fn()} ariaLabel="Notificaciones" />)
    expect(screen.queryByText('0')).toBeNull()
  })

  it('muestra el número hasta 9', () => {
    render(<NotificationBell unread={9} onClick={vi.fn()} ariaLabel="Notificaciones" />)
    expect(screen.getByText('9')).toBeDefined()
  })

  it('muestra 9+ cuando se pasa', () => {
    render(<NotificationBell unread={42} onClick={vi.fn()} ariaLabel="Notificaciones" />)
    expect(screen.getByText('9+')).toBeDefined()
  })
})
