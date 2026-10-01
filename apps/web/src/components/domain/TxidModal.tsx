import { ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '#/components/ui/dialog'
import { explorerTxUrl } from '#/lib/explorer'
import { HashChip } from './HashChip'
import { SecondaryButton } from './PrimaryButton'

interface TxidModalProps {
  open: boolean
  testId?: string
  onClose: () => void
  label: string
  anchoredAt: string
  txid: string
  labels: {
    title: string
    anchoredAtLabel: string
    txidLabel: string
    openExplorer: string
    copy: string
    copied: string
  }
  formatDateTime: (iso: string) => string
}

export function TxidModal({
  open,
  testId,
  onClose,
  label,
  anchoredAt,
  txid,
  labels,
  formatDateTime
}: TxidModalProps) {
  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent data-testid={testId}>
        <DialogHeader>
          <DialogTitle className="text-h2 font-bold text-text-primary">{labels.title}</DialogTitle>
          <DialogDescription className="text-body text-text-secondary">{label}</DialogDescription>
        </DialogHeader>

        <dl className="flex flex-col gap-s4">
          <div className="flex flex-col gap-s1">
            <dt className="text-label font-bold uppercase text-text-muted">
              {labels.anchoredAtLabel}
            </dt>
            <dd className="text-body text-text-secondary">{formatDateTime(anchoredAt)}</dd>
          </div>

          <div className="flex flex-col gap-s1">
            <dt className="text-label font-bold uppercase text-text-muted">{labels.txidLabel}</dt>
            <dd className="break-all rounded-md bg-surface-alt p-s3 font-mono text-mono-body text-text-primary">
              {txid}
            </dd>
          </div>
        </dl>

        <div className="mt-s4 flex flex-col gap-s2">
          <HashChip hash={txid} label="txid" copyLabel={labels.copy} copiedLabel={labels.copied} />
          <SecondaryButton
            onClick={() => window.open(explorerTxUrl(txid), '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink size={16} aria-hidden="true" />
            {labels.openExplorer}
          </SecondaryButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
