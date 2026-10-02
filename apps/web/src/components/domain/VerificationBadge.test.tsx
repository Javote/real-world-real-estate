import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VerificationBadge } from './VerificationBadge'

describe('VerificationBadge', () => {
  it('sin TXID dice Pendiente, nunca Verificado', () => {
    render(<VerificationBadge txid={null} verifiedLabel="Verificado" pendingLabel="Pendiente" />)

    expect(screen.getByText('Pendiente')).toBeDefined()
    expect(screen.queryByText('Verificado')).toBeNull()
  })

  it('con TXID dice Verificado', () => {
    render(
      <VerificationBadge
        txid={'a'.repeat(64)}
        verifiedLabel="Verificado"
        pendingLabel="Pendiente"
      />
    )

    expect(screen.getByText('Verificado')).toBeDefined()
  })
})
