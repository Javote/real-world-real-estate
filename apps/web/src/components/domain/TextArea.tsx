import { useEffect, useRef } from 'react'
import { cn } from '#/lib/cn'

interface TextAreaProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  maxLength?: number
  error?: string
  disabled?: boolean
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
        aria-describedby={error ? `${id}-error` : undefined}
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
