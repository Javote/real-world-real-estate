// Componente de dominio (M2-D3 §Forms & Controls): input de una línea, label
// arriba, foco con anillo purple. Usado en /login (SPEC-011 §Interfaz).
import { useId } from 'react'

interface TextInputProps {
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  error?: string
}

export function TextInput({ label, type = 'text', value, onChange, autoComplete, error }: TextInputProps) {
  const id = useId()
  return (
    <div className="mb-4">
      <label className="mb-1 block text-sm font-medium" htmlFor={id} style={{ color: '#374151' }}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2"
        style={{ borderColor: error ? '#EF4444' : '#E5E7EB', ['--tw-ring-color' as string]: '#6D4AFF' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
      />
      {error ? (
        <p className="mt-1 text-xs" style={{ color: '#EF4444' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
