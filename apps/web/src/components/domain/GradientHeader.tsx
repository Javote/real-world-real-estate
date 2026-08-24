import { ArrowLeft } from 'lucide-react'
import { cn } from '#/lib/cn'

// M2-D3 §Foundation · GradientHeader — *"Use on every primary screen, every
// modal landing, every detail view"*.
//
// **Nunca omite el logo**: es el ancla agnóstica de rol. Y el slot derecho está
// reservado a utilidades globales —NotificationBell, LanguageToggle, acción
// primaria—, nunca a acciones contextuales.

interface GradientHeaderProps {
  title: string
  subtitle?: string
  /** Línea de contexto bajo el título: "Welcome, Admin Alpine". */
  context?: string
  /** "← Back to <parent>" en pantallas de detalle. */
  back?: { label: string; onClick: () => void }
  /** Solo utilidades globales. */
  right?: React.ReactNode
  /** Badge cuadrado a la izquierda del título (el logo del proyecto en el panel). */
  badge?: React.ReactNode
  className?: string
}

export function GradientHeader({
  title,
  subtitle,
  context,
  back,
  right,
  badge,
  className
}: GradientHeaderProps) {
  return (
    <header
      className={cn(
        // Radio solo abajo: el header nace pegado al borde superior del viewport.
        'bg-linear-to-br from-primary to-primary-dark rounded-b-xl px-s4 pb-s5 pt-s4 text-white',
        className
      )}
    >
      <div className="flex items-start justify-between gap-s3">
        <div className="flex items-center gap-s3">
          {badge ? (
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
              {badge}
            </span>
          ) : null}
          <div>
            <h1 className="text-h1 font-bold">{title}</h1>
            {subtitle ? <p className="text-body-sm text-white/80">{subtitle}</p> : null}
          </div>
        </div>
        {right ? <div className="flex items-center gap-s2">{right}</div> : null}
      </div>

      {back ? (
        <button
          type="button"
          onClick={back.onClick}
          className="mt-s3 flex items-center gap-s1 text-body-sm text-white/80"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {back.label}
        </button>
      ) : null}

      {context ? <p className="mt-s4 text-body text-white/80">{context}</p> : null}
    </header>
  )
}
