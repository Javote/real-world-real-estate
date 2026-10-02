import { CARD_SHELL_DENSE } from '#/lib/cardShell'
import { cn } from '#/lib/cn'
import { HashChip } from './HashChip'

export interface ReleaseRecord {
  stageNumber: number
  amountMinorUnits: number
  currency: string
  releasedAt: string
  txid: string | null
}

interface ReleaseProofListProps {
  releases: readonly ReleaseRecord[]
  onOpenTxid?: (release: ReleaseRecord) => void
  formatCurrency: (minorUnits: number, currency: string) => string
  formatDate: (iso: string) => string
  labels: { stage: string; pending: string; copy: string; copied: string }
}

export function ReleaseProofList({
  releases,
  onOpenTxid,
  formatCurrency,
  formatDate,
  labels
}: ReleaseProofListProps) {
  return (
    <ul className="flex flex-col gap-s3">
      {releases.map((release) => (
        <li
          key={release.stageNumber}
          className={cn('flex items-center justify-between gap-s3', CARD_SHELL_DENSE)}
        >
          <div className="flex flex-col">
            <span className="text-body font-bold text-text-primary">
              {labels.stage} {release.stageNumber}
            </span>
            <span className="text-body-sm text-text-muted">{formatDate(release.releasedAt)}</span>
          </div>

          <div className="flex flex-col items-end gap-s1">
            <span className="text-body font-bold text-text-primary">
              {formatCurrency(release.amountMinorUnits, release.currency)}
            </span>
            {release.txid ? (
              <HashChip
                hash={release.txid}
                {...(onOpenTxid ? { onOpenDetail: () => onOpenTxid(release) } : {})}
                copyLabel={labels.copy}
                copiedLabel={labels.copied}
              />
            ) : (
              <span className="text-body-sm text-pending">{labels.pending}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
