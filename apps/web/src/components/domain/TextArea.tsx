import { useEffect, useRef } from 'react'
import { cn } from '#/lib/cn'

// M2-D3 §Forms & Controls · TextArea — *"Same styling as TextInput, larger.
// Optional character counter."*
//
// Lo usan las dos superficies donde alguien escribe prosa: la observación del
// certifier (`ObserveStageModal`) y la nota de rechazo del notario. En las dos
// **el texto queda off-chain**: puede nombrar personas, y a la cadena solo van
// commitments y refs opacas (regla 2).

interface TextAreaProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  /** Con esto aparece el contador. Además limita la entrada. */
  maxLength?: number
  error?: string
  disabled?: boolean
  /** El modal de observación lo pide enfocado al abrir (M2-D3). */
  autoFocus?: boolean
  className?: string
}

export function TextArea({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength,
  error,
  disabled,
  autoFocus,
  className
}: TextAreaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // **Foco por ref y no por el atributo `autoFocus`.** M2-D3 lo pide para el
  // `ObserveStageModal` —"Observations textarea (focused on open)"—, pero el
  // atributo de React enfoca al MONTAR, y adentro de un diálogo el montaje pasa
  // antes de que el diálogo tome el foco: se lo roba de vuelta y el cursor
  // termina en el contenedor. Con el efecto, el foco se pide después de que el
  // árbol se estabilizó, que es cuando el usuario lo ve.
  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  return (
    <div className={cn('flex flex-col gap-s1', className)}>
      <label htmlFor={id} className="text-body-sm font-medium text-text-secondary">
        {label}
      </label>

      <textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-errormessage={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'resize-y rounded-md border bg-surface-alt px-s3 py-s2 text-body text-text-primary',
          'placeholder:text-disabled focus:outline-none focus:ring-2 focus:ring-primary',
          'disabled:cursor-not-allowed disabled:text-disabled',
          error ? 'border-danger' : 'border-border'
        )}
      />

      <div className="flex items-start justify-between gap-s2">
        {error ? (
          <p id={`${id}-error`} className="text-caption text-danger">
            {error}
          </p>
        ) : (
          <span />
        )}
        {maxLength ? (
          <span className="text-caption text-text-muted tabular-nums">
            {value.length}/{maxLength}
          </span>
        ) : null}
      </div>
    </div>
  )
}
