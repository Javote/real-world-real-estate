import { Minus, Plus } from 'lucide-react'
import { cn } from '#/lib/cn'

interface NumberInputProps {
  id: string
  label: string
  value: number | null
  onChange: (value: number | null) => void
  min?: number
  max?: number
  step?: number
  placeholder?: string
  error?: string
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
          aria-describedby={error ? `${id}-error` : undefined}
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
