import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '#/components/ui/dialog'
import { DangerButton, SecondaryButton } from './PrimaryButton'
import { TextArea } from './TextArea'

// M2-D3 §Modals · ObserveStageModal — la superficie con la que el certifier
// devuelve un stage al developer en vez de certificarlo.
//
// **Dos reglas del entregable que el componente hace cumplir por construcción:**
//
// 1. *"Send button uses the orange 'danger-corrective' treatment, not red —
//    observation is not destructive."* Observar devuelve trabajo, no borra
//    nada: el rojo diría otra cosa.
// 2. *"Empty textarea disables Send."* Una observación vacía no le dice nada al
//    developer y deja el stage trabado sin motivo registrado.
//
// **El texto queda off-chain** (regla 2): va al `AuditLog`, nunca al datum —
// una observación puede nombrar personas.

interface ObserveStageModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (note: string) => void
  submitting?: boolean
  labels: {
    title: string
    helper: string
    noteLabel: string
    notePlaceholder: string
    cancel: string
    send: string
    sending: string
  }
  maxLength?: number
}

export function ObserveStageModal({
  open,
  onClose,
  onSubmit,
  submitting,
  labels,
  maxLength = 2000
}: ObserveStageModalProps) {
  const [nota, setNota] = useState('')
  const vacia = nota.trim().length === 0

  const cerrar = () => {
    setNota('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle className="text-h2 font-bold text-text-primary">{labels.title}</DialogTitle>
          <DialogDescription className="text-body text-text-secondary">
            {labels.helper}
          </DialogDescription>
        </DialogHeader>

        <TextArea
          id="observe-stage-note"
          label={labels.noteLabel}
          placeholder={labels.notePlaceholder}
          value={nota}
          onChange={setNota}
          maxLength={maxLength}
          rows={5}
          autoFocus
          disabled={submitting}
        />

        <div className="flex justify-end gap-s2">
          <SecondaryButton onClick={cerrar} disabled={submitting}>
            {labels.cancel}
          </SecondaryButton>
          <DangerButton
            variant="corrective"
            onClick={() => onSubmit(nota.trim())}
            disabled={vacia || submitting}
          >
            {submitting ? labels.sending : labels.send}
          </DangerButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
