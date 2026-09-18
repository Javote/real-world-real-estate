import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '#/components/ui/dialog'
import { HashChip } from './HashChip'
import { PrimaryButton, SecondaryButton } from './PrimaryButton'

// M2-D3 §Modals · ShareDossierModal — *"Generates a read-only public dossier URL
// for third parties (notary, bank, regulator) **without granting platform
// access**."*
//
// Esa última parte es la razón de ser del componente y del endpoint que lo
// alimenta: `GET /public/dossier/:shareToken` es, junto con el login, el único
// endpoint sin sesión del backlog (M2-D5 §2.2).
//
// **El token es la credencial.** Quien tenga el link ve el dossier, así que la
// URL se muestra para copiar y compartir a conciencia — no se manda por mail
// desde acá ni se publica en ningún lado.

interface ShareDossierModalProps {
  open: boolean
  onClose: () => void
  /** URL completa y lista para copiar. La compone quien usa, con su origen. */
  shareUrl: string
  testId?: string
  labels: {
    title: string
    /** Explica qué es el link y a quién se le da. */
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
          {/* Se reusa el HashChip: es el componente de "string largo con copia"
              del sistema, y la URL lleva el token de 64 hex — mismo problema de
              presentación que un hash. */}
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
