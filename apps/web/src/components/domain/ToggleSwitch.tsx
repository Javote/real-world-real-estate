import { cn } from '#/lib/cn'

interface ToggleSwitchProps {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  description?: string
  disabled?: boolean
  className?: string
}

export function ToggleSwitch({
  id,
  label,
  checked,
  onChange,
  description,
  disabled,
  className
}: ToggleSwitchProps) {
  return (
    <div className={cn('flex items-center justify-between gap-s4', className)}>
      <span className="flex flex-col">
        <label htmlFor={id} className="text-body text-text-primary">
          {label}
        </label>
        {description ? <span className="text-caption text-text-muted">{description}</span> : null}
      </span>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          checked ? 'bg-primary' : 'bg-disabled',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute left-0.5 top-0.5 size-5 rounded-full bg-card shadow-e1 transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  )
}
