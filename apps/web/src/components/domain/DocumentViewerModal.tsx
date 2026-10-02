import { Download } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '#/components/ui/dialog'
import { PrimaryButton } from './PrimaryButton'
import { StatusPill } from './StatusPill'
import { VerifiedWatermark } from './VerifiedWatermark'

interface DocumentViewerModalProps {
  open: boolean
  onClose: () => void
  testId?: string
  title: string
  filename: string
  pageUrl: string
  dateLabel: string
  paginationLabel?: string
  txid: string | null
  onDownload?: () => void
  labels: {
    verified: string
    pending: string
    download: string
    watermark: string
  }
}

export function DocumentViewerModal({
  open,
  onClose,
  testId,
  title,
  filename,
  pageUrl,
  dateLabel,
  paginationLabel,
  txid,
  onDownload,
  labels
}: DocumentViewerModalProps) {
  const anclado = txid !== null

  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent data-testid={testId} className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-h2 font-bold text-text-primary">{title}</DialogTitle>
          <DialogDescription className="text-body-sm text-text-muted">
            {filename}
            {paginationLabel ? ` · ${paginationLabel}` : ''}
          </DialogDescription>
        </DialogHeader>

        {pageUrl ? (
          <VerifiedWatermark txid={txid} label={labels.watermark}>
            <div className="overflow-hidden rounded-lg border border-border">
              <img src={pageUrl} alt={title} className="w-full object-contain" />
            </div>
          </VerifiedWatermark>
        ) : null}

        <div className="flex items-center justify-between gap-s2">
          <span className="flex items-center gap-s2">
            <span className="text-caption text-text-muted">{dateLabel}</span>
            <StatusPill tone={anclado ? 'verified' : 'pending'}>
              {anclado ? labels.verified : labels.pending}
            </StatusPill>
          </span>

          {onDownload ? (
            <PrimaryButton onClick={onDownload} disabled={!anclado}>
              <Download className="size-icon-inline" aria-hidden="true" />
              {labels.download}
            </PrimaryButton>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
