import { ShieldCheck } from 'lucide-react'
import { StatusPill } from './StatusPill'

// M2-D3 §Foundation · VerificationBadge — y **patrón P1 de M2-D4**.
//
// **La regla 17 vive acá:** *"Never use 'Verified' pill without a real
// underlying hash"*. Por eso el componente **no acepta un booleano**: recibe el
// TXID. Sin TXID no hay forma de pedirle que diga "Verificado" — el estado es
// "Pendiente", y eso no es una convención que haya que recordar, es la firma
// del componente.

interface VerificationBadgeProps {
  /** El TXID del anclaje. `null` mientras no confirmó: eso ES el estado pendiente. */
  txid: string | null
  verifiedLabel: string
  pendingLabel: string
}

export function VerificationBadge({ txid, verifiedLabel, pendingLabel }: VerificationBadgeProps) {
  if (!txid) {
    return <StatusPill tone="pending">{pendingLabel}</StatusPill>
  }

  return (
    <StatusPill tone="verified" className="gap-s1">
      <ShieldCheck size={14} aria-hidden="true" />
      {verifiedLabel}
    </StatusPill>
  )
}
