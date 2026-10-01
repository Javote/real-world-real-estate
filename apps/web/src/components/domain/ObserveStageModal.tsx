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
      <DialogContent>
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
