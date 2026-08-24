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

// **M2-D4 Pattern 3 · TxidModal — "the canonical 'show me the proof' surface".**
//
// Es la profundidad 3 de la jerarquía de divulgación: el `VerificationBadge`
// contesta *¿está anclado?*, el `HashChip` *¿cuál hash?*, y este modal *el hash
// completo, con link al explorador*.
//
// **Nunca se abre solo** (M2-D4 §6.3): siempre lo inicia el usuario. Por eso el
// componente es controlado —recibe `open`— y no tiene ningún efecto que lo
// dispare. "Auto-popping it would interrupt flow without consent."

interface TxidModalProps {
  open: boolean
  /** Test ID de M2-D5 (filas 25v, 50). Va en el contenido: Radix portalea. */
  testId?: string
  onClose: () => void
  /** Qué ancla este TXID: nombre del documento, acción, título del evento. */
  label: string
  /** ISO. Se formatea con el locale activo. */
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
      <DialogContent data-testid={testId} className="bg-card">
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
            {/* Acá SÍ va el hash completo: es el único lugar donde el
                entregable lo permite (M2-D4 Pattern 2). */}
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
