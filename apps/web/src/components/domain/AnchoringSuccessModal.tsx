import { ShieldCheck } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { useAnnounce } from '#/lib/announce'
import { explorerTxUrl } from '#/lib/explorer'
import { HashChip, truncateHash } from './HashChip'
import { PrimaryButton, SecondaryButton } from './PrimaryButton'

interface AnchoringSuccessModalProps {
  open: boolean
  testId?: string
  onDone: () => void
  merkleRoot: string
  txid: string
  labels: {
    title: string
    body: string
    merkleLabel: string
    txidLabel: string
    openExplorer: string
    done: string
    copy: string
    copied: string
  }
}

export function AnchoringSuccessModal({
  open,
  testId,
  onDone,
  merkleRoot,
  txid,
  labels
}: AnchoringSuccessModalProps) {
  const announce = useAnnounce()
  const yaAnunciado = useRef(false)
  useEffect(() => {
    if (open && !yaAnunciado.current) {
      yaAnunciado.current = true
      announce(`${labels.title}: ${truncateHash(txid)}`)
    }
    if (!open) yaAnunciado.current = false
  }, [open, labels.title, txid, announce])

  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && onDone()}>
      <DialogContent data-testid={testId}>
        <DialogHeader>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-verified-light text-verified">
            <ShieldCheck size={24} aria-hidden="true" />
          </span>
          <DialogTitle className="text-h2 font-bold text-text-primary">{labels.title}</DialogTitle>
        </DialogHeader>

        <p className="text-body text-text-secondary">{labels.body}</p>

        <div className="flex flex-col gap-s3">
          <div className="flex flex-col gap-s1">
            <span className="text-label font-bold uppercase text-text-muted">
              {labels.merkleLabel}
            </span>
            <HashChip hash={merkleRoot} copyLabel={labels.copy} copiedLabel={labels.copied} />
          </div>
          <div className="flex flex-col gap-s1">
            <span className="text-label font-bold uppercase text-text-muted">
              {labels.txidLabel}
            </span>
            <HashChip hash={txid} copyLabel={labels.copy} copiedLabel={labels.copied} />
          </div>
        </div>

        <div className="mt-s4 flex flex-col gap-s2">
          <SecondaryButton
            onClick={() => window.open(explorerTxUrl(txid), '_blank', 'noopener,noreferrer')}
          >
            {labels.openExplorer}
          </SecondaryButton>
          <PrimaryButton onClick={onDone}>{labels.done}</PrimaryButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
