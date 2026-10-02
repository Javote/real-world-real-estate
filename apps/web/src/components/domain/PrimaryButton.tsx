import { Loader2 } from 'lucide-react'
import { cn } from '#/lib/cn'

interface ButtonProps {
  children: React.ReactNode
  type?: 'button' | 'submit'
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  className?: string
  testId?: string
}

const BASE =
  'flex items-center justify-center gap-s2 rounded-md px-s4 py-s3 font-medium transition-colors disabled:opacity-60'

export function PrimaryButton({
  children,
  type = 'button',
  disabled,
  loading,
  onClick,
  className,
  testId
}: ButtonProps) {
  return (
    <button
      type={type}
      data-testid={testId}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(BASE, 'bg-primary text-white active:bg-primary-dark', className)}
    >
      {loading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

export function SecondaryButton({
  children,
  type = 'button',
  disabled,
  loading,
  onClick,
  className,
  testId
}: ButtonProps) {
  return (
    <button
      type={type}
      data-testid={testId}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        BASE,
        'border border-border bg-card text-text-primary active:bg-surface-alt',
        className
      )}
    >
      {loading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

export function DangerButton({
  children,
  type = 'button',
  disabled,
  loading,
  onClick,
  className,
  testId,
  variant = 'danger'
}: ButtonProps & { variant?: 'danger' | 'corrective' }) {
  return (
    <button
      type={type}
      data-testid={testId}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        BASE,
        variant === 'danger' ? 'bg-danger text-white' : 'bg-pending text-white',
        className
      )}
    >
      {loading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}
