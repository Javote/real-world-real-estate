import { BadgeCheck, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '#/components/ui/dialog'
import { PrimaryButton, SecondaryButton } from './PrimaryButton'

// M2-D3 §Modals · InvitationAcceptModal — la superficie con la que el investor
// acepta o rechaza una invitación del developer.
//
// **La línea "anclada on-chain" es NO OPCIONAL**, textual del entregable:
// *"Anchored-on-chain badge is non-optional — invitations are always
// anchored."* Por eso no hay prop para ocultarla. Es la afirmación que el
// producto sí puede sostener: aceptar produce un commitment (M3-SC-01).
//
// Lo que la línea **no** dice es que la operación esté verificada ni que el
// desarrollo sea confiable (D-026). Dice que este hecho quedó registrado.

interface InvitationAcceptModalProps {
  open: boolean
  onClose: () => void
  onAccept: () => void
  onDecline: () => void
  submitting?: boolean
  /** Los cuatro bloques etiquetados de la ficha, ya formateados con `Intl`. */
  details: {
    developerLine: string
    project: string
    unit: string
    /** Monto total, ya formateado (reglas 1 y 14). */
    amount: string
    handover: string
  }
  /** Resumen del cronograma de pagos. Es dato declarado, no plata (D-021). */
  termsLines?: readonly string[]
  labels: {
    title: string
    projectLabel: string
    unitLabel: string
    amountLabel: string
    handoverLabel: string
    termsTitle: string
    anchoredNotice: string
    decline: string
    accept: string
    submitting: string
  }
}

export function InvitationAcceptModal({
  open,
  onClose,
  onAccept,
  onDecline,
  submitting,
  details,
  termsLines,
  labels
}: InvitationAcceptModalProps) {
  const bloques = [
    { label: labels.projectLabel, value: details.project },
    { label: labels.unitLabel, value: details.unit },
    { label: labels.amountLabel, value: details.amount },
    { label: labels.handoverLabel, value: details.handover }
  ]

  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <span className="flex size-10 items-center justify-center rounded-full bg-verified-light">
            <BadgeCheck className="size-icon-md text-verified" aria-hidden="true" />
          </span>
          <DialogTitle className="text-h2 font-bold text-text-primary">{labels.title}</DialogTitle>
          <DialogDescription className="text-body text-text-secondary">
            {details.developerLine}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-s3">
          {bloques.map((b) => (
            <div key={b.label} className="flex flex-col gap-s1">
              <dt className="text-caption text-text-muted">{b.label}</dt>
              <dd className="text-body font-medium text-text-primary">{b.value}</dd>
            </div>
          ))}
        </dl>

        {termsLines && termsLines.length > 0 ? (
          <section className="flex flex-col gap-s1 rounded-lg bg-surface-alt p-s3">
            <h3 className="text-body-sm font-medium text-text-secondary">{labels.termsTitle}</h3>
            <ul className="flex flex-col gap-s1">
              {termsLines.map((linea) => (
                <li key={linea} className="text-body-sm text-text-secondary">
                  {linea}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* No opcional — ver el comentario de arriba. */}
        <p className="flex items-center gap-s2 text-body-sm text-primary">
          <Check className="size-icon-sm shrink-0" aria-hidden="true" />
          {labels.anchoredNotice}
        </p>

        <div className="flex justify-end gap-s2">
          <SecondaryButton onClick={onDecline} disabled={submitting}>
            {labels.decline}
          </SecondaryButton>
          <PrimaryButton onClick={onAccept} disabled={submitting}>
            {submitting ? labels.submitting : labels.accept}
          </PrimaryButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
