import { useId } from 'react'
import { cn } from '#/lib/cn'

interface TextInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'password' | 'email' | 'number' | 'date'
  placeholder?: string
  adornment?: React.ReactNode
  error?: string
  autoComplete?: string
  required?: boolean
}

export function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  adornment,
  error,
  autoComplete,
  required
}: TextInputProps) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className="flex flex-col gap-s1">
      <label htmlFor={id} className="text-body-sm font-medium text-text-secondary">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'w-full rounded-md border bg-surface-alt px-s3 py-s3 text-body text-text-primary',
            'placeholder:text-disabled focus:outline-none focus:ring-2 focus:ring-primary',
            error ? 'border-danger' : 'border-border',
            adornment ? 'pr-s12' : ''
          )}
        />
        {adornment ? (
          <span className="absolute inset-y-0 right-s3 flex items-center text-text-muted">
            {adornment}
          </span>
        ) : null}
      </div>

      {error ? (
        <p id={errorId} className="text-body-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
