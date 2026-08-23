// Componente de dominio (M2-D3 §Forms & Controls): la acción de mayor
// jerarquía de cada pantalla. Disabled = mismo purple, opacidad reducida (no
// un hex nuevo) — "lighter purple, reduced opacity" es una regla de opacidad,
// no un token de color distinto.
import { Loader2 } from 'lucide-react'

interface PrimaryButtonProps {
  children: React.ReactNode
  type?: 'button' | 'submit'
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
}

export function PrimaryButton({
  children,
  type = 'button',
  disabled,
  loading,
  onClick
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-medium text-white disabled:opacity-60"
      style={{ backgroundColor: '#6D4AFF' }}
    >
      {loading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}
