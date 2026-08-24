import { useId } from 'react'
import { cn } from '#/lib/cn'

// M2-D3 §Forms & Controls · TextInput.
//
// El label va **arriba del campo y asociado por `htmlFor`**: sin eso,
// `getByLabel` de los tests falla — que es exactamente para lo que sirve, y así
// se descubrió que los labels del login viejo no lo tenían.
//
// El adorno derecho es del entregable: ojo para passwords, calendario para
// fechas.

interface TextInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'password' | 'email' | 'number'
  placeholder?: string
  /** Ojo, calendario, etc. Va dentro del campo, a la derecha. */
  adornment?: React.ReactNode
  /** Mensaje de error: pinta el borde y se muestra debajo. */
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
