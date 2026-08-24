import { Loader2 } from 'lucide-react'
import { cn } from '#/lib/cn'

// M2-D3 §Forms & Controls · PrimaryButton — la acción de mayor jerarquía.
//
// "Disabled — lighter purple, reduced opacity": es **opacidad sobre el mismo
// morado**, no un hex nuevo. Inventar un token para eso sería agregar un color
// que el entregable no tiene.
//
// El label es verbo primero ("Anclar evidencia", "Verificar y firmar"), y va
// como máximo uno por pantalla — dos solo en una barra de CTA pareada.

interface ButtonProps {
  children: React.ReactNode
  type?: 'button' | 'submit'
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  className?: string
}

const BASE =
  'flex items-center justify-center gap-s2 rounded-md px-s4 py-s3 font-medium transition-colors disabled:opacity-60'

export function PrimaryButton({
  children,
  type = 'button',
  disabled,
  loading,
  onClick,
  className
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(BASE, 'bg-primary text-white active:bg-primary-dark', className)}
    >
      {loading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

// SecondaryButton — misma forma y padding que el primario, menor énfasis.
// "Cancel", "Back to <parent>", "View dossier".
export function SecondaryButton({
  children,
  type = 'button',
  disabled,
  onClick,
  className
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        BASE,
        'border border-border bg-card text-text-primary active:bg-surface-alt',
        className
      )}
    >
      {children}
    </button>
  )
}

// DangerButton — destructivo o correctivo, y se usa poco.
//
// Las dos variantes están en el entregable y significan cosas distintas:
// `danger` es destructivo (rojo); `corrective` es naranja, y existe para
// "enviar con observaciones" — señala que hay que corregir, no que se destruye.
export function DangerButton({
  children,
  type = 'button',
  disabled,
  onClick,
  className,
  variant = 'danger'
}: ButtonProps & { variant?: 'danger' | 'corrective' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        BASE,
        variant === 'danger' ? 'bg-danger text-white' : 'bg-pending text-white',
        className
      )}
    >
      {children}
    </button>
  )
}
