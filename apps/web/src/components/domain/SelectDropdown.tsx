import { ChevronDown } from 'lucide-react'
import { cn } from '#/lib/cn'

// M2-D3 §Forms & Controls · SelectDropdown — *"Same body as TextInput with
// chevron-down adornment."* Lo usan la asignación de unidad, la plantilla de
// stages y el orden del listado.
//
// **Es un `<select>` nativo, no un popover propio.** M2-D3 describe un popover,
// pero el nativo da gratis lo que un popover propio hay que construir y
// mantener: navegación por teclado, tipeo para saltar a una opción, y el
// selector de rueda del sistema en mobile — que es la superficie primaria
// (M2-D3 §Principio 4). El chevron se dibuja encima para que la anatomía sea
// la que el entregable pide.
//
// Si algún día hace falta una opción con ícono o dos líneas, ahí sí es un
// popover y es una decisión, no un archivo nuevo.

export interface SelectOption {
  value: string
  /** Ya traducida por quien lo usa. */
  label: string
  disabled?: boolean
}

interface SelectDropdownProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly SelectOption[]
  /** Opción vacía inicial: "Elegí una unidad…". Sin esto no hay estado vacío. */
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
          aria-errormessage={error ? `${id}-error` : undefined}
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
