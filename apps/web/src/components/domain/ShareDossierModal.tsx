import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '#/components/ui/dialog'
import { HashChip } from './HashChip'
import { PrimaryButton, SecondaryButton } from './PrimaryButton'

interface ShareDossierModalProps {
  open: boolean
  onClose: () => void
  shareUrl: string
  testId?: string
  labels: {
    title: string
    helper: string
    urlLabel: string
    copy: string
    copied: string
    close: string
    openView: string
  }
}

export function ShareDossierModal({
  open,
  onClose,
  shareUrl,
  labels,
  testId
}: ShareDossierModalProps) {
  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent data-testid={testId}>
        <DialogHeader>
          <DialogTitle className="text-h2 font-bold text-text-primary">{labels.title}</DialogTitle>
          <DialogDescription className="text-body text-text-secondary">
            {labels.helper}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-s1">
          <span className="text-caption text-text-muted">{labels.urlLabel}</span>
          <HashChip hash={shareUrl} copyLabel={labels.copy} copiedLabel={labels.copied} />
        </div>

        <div className="flex justify-end gap-s2">
          <SecondaryButton onClick={onClose}>{labels.close}</SecondaryButton>
          <PrimaryButton onClick={() => window.open(shareUrl, '_blank', 'noopener,noreferrer')}>
            {labels.openView}
          </PrimaryButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
