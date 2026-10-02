import { ChevronDown } from 'lucide-react'
import { cn } from '#/lib/cn'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectDropdownProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly SelectOption[]
  placeholder?: string
  error?: string
  disabled?: boolean
  className?: string
}

export function SelectDropdown({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  disabled,
  className
}: SelectDropdownProps) {
  return (
    <div className={cn('flex flex-col gap-s1', className)}>
      <label htmlFor={id} className="text-body-sm font-medium text-text-secondary">
        {label}
      </label>

      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full appearance-none rounded-md border bg-surface-alt py-s2 pr-s6 pl-s3',
            'text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-primary',
            'disabled:cursor-not-allowed disabled:text-disabled',
            error ? 'border-danger' : 'border-border',
            value === '' && 'text-disabled'
          )}
        >
          {placeholder !== undefined ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>

        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-s3 size-icon-inline -translate-y-1/2 text-text-muted"
        />
      </div>

      {error ? (
        <p id={`${id}-error`} className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
