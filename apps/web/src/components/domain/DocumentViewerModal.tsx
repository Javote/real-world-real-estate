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

// M2-D3 §Modals · DocumentViewerModal — el visor inline, con el sello VERIFIED
// en diagonal (**patrón P7 de M2-D4**) y la descarga del PDF.
//
// **El watermark solo se dibuja si hay TXID.** Es literalmente la regla 17
// hecha componente: estampar "VERIFICADO" sobre un documento cuya prueba no
// está sería la peor mentira posible de todo el sistema — la más creíble y la
// menos sustanciable. Por eso `txid` manda sobre todo lo demás acá.

interface DocumentViewerModalProps {
  open: boolean
  onClose: () => void
  testId?: string
  /** Título del documento, no el nombre del archivo. */
  title: string
  filename: string
  /** Imagen renderizada de la página. */
  pageUrl: string
  /** Ya formateada con `Intl`. */
  dateLabel: string
  /** "1 de 3" — ya armado por quien lo usa. */
  paginationLabel?: string
  /** **La única fuente del estado.** `null` ⇒ sin sello y sin descarga. */
  txid: string | null
  onDownload?: () => void
  labels: {
    verified: string
    pending: string
    download: string
    /** El texto del sello. Va traducido: "VERIFICADO" / "VERIFIED". */
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
      <DialogContent data-testid={testId} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-h2 font-bold text-text-primary">{title}</DialogTitle>
          <DialogDescription className="text-body-sm text-text-muted">
            {filename}
            {paginationLabel ? ` · ${paginationLabel}` : ''}
          </DialogDescription>
        </DialogHeader>

        {/* `VerifiedWatermark` recibe el TXID, no un booleano: sin anclaje no
            estampa nada, y esa decisión vive en el componente del patrón, no
            acá (regla 17). */}
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
