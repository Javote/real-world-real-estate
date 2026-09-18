import { Download, Eye, FileText } from 'lucide-react'
import { cn } from '#/lib/cn'
import { HashChip } from './HashChip'
import { StatusPill } from './StatusPill'

// M2-D3 §Cards · DocumentCard — la representación inline de un documento
// anclado o pendiente. Es el componente que más superficies toca: detalle de
// stage, documentación de respaldo, índice del dossier y documentación del
// developer.
//
// **El estado se DERIVA del TXID, no se declara.** Por eso `txid` es
// `string | null` y no hay prop `verified`: sin TXID el documento está
// "Pendiente", aunque tenga hash (regla 17 y M2-D4 §6.2). La misma decisión que
// el `VerificationBadge`, que recibe el TXID en vez de un booleano — la regla
// deja de ser algo que hay que acordarse y pasa a ser la firma del componente.
//
// El hash llega COMPLETO (regla 16): `HashChip` trunca para mostrar.

interface DocumentCardProps {
  filename: string
  /** Ya formateada con `Intl` (regla 14). */
  uploadedAtLabel: string
  /** "PDF", "JPEG". */
  format: string
  /** SHA-256 completo. `null` si el archivo todavía no se hasheó. */
  sha256?: string | null
  /** **La única fuente del estado.** `null` ⇒ Pendiente. */
  txid: string | null
  labels: {
    verified: string
    pending: string
    view: string
    download: string
    copy: string
    copied: string
    /** Etiqueta del chip: "hash". */
    hashLabel?: string
  }
  onView?: () => void
  onDownload?: () => void
  /** Abre el TxidModal (P3). Nunca se abre solo (M2-D4 §6.3). */
  onOpenProof?: () => void
  /** La documentación del developer muestra el hash inline (M2-D3). */
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
    <article className={cn('flex flex-col gap-s2 rounded-lg bg-card p-s3 shadow-e1', className)}>
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
              // *"Pending — view enabled, download may be disabled"* (M2-D3):
              // no se ofrece bajar el PDF de algo cuya prueba no está.
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
