import { Download, Eye, FileText } from 'lucide-react'
import { CARD_SHELL_DENSE } from '#/lib/cardShell'
import { cn } from '#/lib/cn'
import { HashChip } from './HashChip'
import { StatusPill } from './StatusPill'

interface DocumentCardProps {
  filename: string
  uploadedAtLabel: string
  format: string
  sha256?: string | null
  txid: string | null
  labels: {
    verified: string
    pending: string
    view: string
    download: string
    copy: string
    copied: string
    hashLabel?: string
  }
  onView?: () => void
  onDownload?: () => void
  onOpenProof?: () => void
  showHash?: boolean
  className?: string
}

export function DocumentCard({
  filename,
  uploadedAtLabel,
  format,
  sha256,
  txid,
  labels,
  onView,
  onDownload,
  onOpenProof,
  showHash,
  className
}: DocumentCardProps) {
  const anclado = txid !== null

  return (
    <article className={cn('flex flex-col gap-s2', CARD_SHELL_DENSE, className)}>
      <div className="flex items-start gap-s3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-alt">
          <FileText className="size-icon-inline text-text-muted" aria-hidden="true" />
        </span>

        <div className="flex min-w-0 flex-1 flex-col">
          {onView ? (
            <button
              type="button"
              onClick={onView}
              className="truncate text-left text-body font-medium text-text-primary hover:text-primary"
            >
              {filename}
            </button>
          ) : (
            <span className="truncate text-body font-medium text-text-primary">{filename}</span>
          )}
          <span className="text-caption text-text-muted">
            {uploadedAtLabel} · {format}
          </span>
        </div>

        <StatusPill tone={anclado ? 'verified' : 'pending'}>
          {anclado ? labels.verified : labels.pending}
        </StatusPill>
      </div>

      {showHash && sha256 ? (
        <HashChip
          hash={sha256}
          label={labels.hashLabel}
          onOpenDetail={anclado ? onOpenProof : undefined}
          copyLabel={labels.copy}
          copiedLabel={labels.copied}
        />
      ) : null}

      {onView || onDownload ? (
        <div className="flex items-center justify-end gap-s2">
          {onView ? (
            <button
              type="button"
              aria-label={labels.view}
              onClick={onView}
              className="rounded-md p-s1 text-text-muted hover:bg-surface-alt hover:text-primary"
            >
              <Eye className="size-icon-inline" aria-hidden="true" />
            </button>
          ) : null}
          {onDownload ? (
            <button
              type="button"
              aria-label={labels.download}
              onClick={onDownload}
              disabled={!anclado}
              className="rounded-md p-s1 text-text-muted hover:bg-surface-alt hover:text-primary disabled:cursor-not-allowed disabled:text-disabled disabled:hover:bg-transparent"
            >
              <Download className="size-icon-inline" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
