import { Minus, Plus } from 'lucide-react'
import { cn } from '#/lib/cn'

// M2-D3 §Forms & Controls · NumberInput — *"Same body as TextInput. Up/down
// stepper buttons on the right."*
//
// **El valor es `number | null`, no `number`.** Un input numérico vacío no es
// cero: cero es una afirmación ("el precio es 0") y vacío es "todavía no se
// cargó". Colapsar los dos hace que un formulario a medio llenar mande ceros
// como si fueran datos.
//
// **Dinero jamás pasa por acá en unidades mayores** (regla 1): quien lo use
// para un precio recibe y emite unidades mínimas enteras. El componente no
// sabe de moneda — formatear es de `Intl`, no suyo.

interface NumberInputProps {
  id: string
  label: string
  value: number | null
  onChange: (value: number | null) => void
  min?: number
  max?: number
  step?: number
  placeholder?: string
  /** Texto de error. Su presencia es lo que activa el estado de error. */
  error?: string
  /** Accesibles: los steppers son botones y necesitan nombre. */
  stepUpLabel: string
  stepDownLabel: string
  disabled?: boolean
  className?: string
}

export function NumberInput({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  error,
  stepUpLabel,
  stepDownLabel,
  disabled,
  className
}: NumberInputProps) {
  const acotar = (n: number) => {
    if (min !== undefined && n < min) return min
    if (max !== undefined && n > max) return max
    return n
  }

  // Desde vacío, el primer paso arranca en `min` si está definido y no en 0:
  // un stepper que empieza fuera del rango válido produce un valor inválido en
  // el primer click.
  const paso = (delta: number) => onChange(acotar((value ?? min ?? 0) + delta * step))

  return (
    <div className={cn('flex flex-col gap-s1', className)}>
      <label htmlFor={id} className="text-body-sm font-medium text-text-secondary">
        {label}
      </label>

      <div className="flex items-stretch gap-s2">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={value ?? ''}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-errormessage={error ? `${id}-error` : undefined}
          onChange={(e) => {
            const crudo = e.target.value
            onChange(crudo === '' ? null : acotar(Number(crudo)))
          }}
          className={cn(
            'min-w-0 flex-1 rounded-md border bg-surface-alt px-s3 py-s2 text-body text-text-primary',
            'placeholder:text-disabled focus:outline-none focus:ring-2 focus:ring-primary',
            'disabled:cursor-not-allowed disabled:text-disabled',
            error ? 'border-danger' : 'border-border'
          )}
        />

        <div className="flex flex-col overflow-hidden rounded-md border border-border">
          <button
            type="button"
            aria-label={stepUpLabel}
            disabled={disabled || (max !== undefined && (value ?? min ?? 0) >= max)}
            onClick={() => paso(1)}
            className="flex flex-1 items-center justify-center px-s2 text-text-secondary hover:bg-surface-alt disabled:text-disabled"
          >
            <Plus className="size-icon-inline" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={stepDownLabel}
            disabled={disabled || (min !== undefined && (value ?? min ?? 0) <= min)}
            onClick={() => paso(-1)}
            className="flex flex-1 items-center justify-center border-border border-t px-s2 text-text-secondary hover:bg-surface-alt disabled:text-disabled"
          >
            <Minus className="size-icon-inline" aria-hidden="true" />
          </button>
        </div>
      </div>

      {error ? (
        <p id={`${id}-error`} className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
