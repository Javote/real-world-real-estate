import { ShieldCheck } from 'lucide-react'
import { StatusPill } from './StatusPill'

interface VerificationBadgeProps {
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
