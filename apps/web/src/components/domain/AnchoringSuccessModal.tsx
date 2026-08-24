import { ShieldCheck } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { explorerTxUrl } from '#/lib/explorer'
import { HashChip } from './HashChip'
import { PrimaryButton, SecondaryButton } from './PrimaryButton'

// **M2-D4 Pattern 4 · AnchoringSuccessModal — la superficie de emisión de prueba.**
//
// **Es la única excepción a "ningún modal se abre solo"** (M2-D4 §6.3): este es
// emitido por el sistema después de un anclaje exitoso, no iniciado por el
// usuario. La diferencia con el TxidModal no es cosmética:
//
//   TxidModal   → lo abre el usuario, muestra UN TXID.
//   este        → lo emite el sistema, muestra **los dos artefactos** que la
//                 acción produjo: el Merkle root y el TXID.
//
// Por eso `merkleRoot` no es opcional: si no hay dos artefactos, lo que hubo no
// fue un anclaje de bundle y el patrón que corresponde es otro.

interface AnchoringSuccessModalProps {
  open: boolean
  /**
   * Test ID de M2-D5 (fila 44d).
   *
   * Va en el contenido del diálogo y no en un contenedor de afuera: Radix
   * renderiza el modal en un **portal**, así que un `data-testid` en el div que
   * lo envuelve queda en un nodo vacío y el test no encuentra nada.
   */
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
  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && onDone()}>
      <DialogContent data-testid={testId} className="bg-card">
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
          {/* "Done" devuelve a la pantalla de origen con el formulario reseteado. */}
          <PrimaryButton onClick={onDone}>{labels.done}</PrimaryButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
