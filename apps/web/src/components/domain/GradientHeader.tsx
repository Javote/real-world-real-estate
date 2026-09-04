import { ArrowLeft } from 'lucide-react'
import { cn } from '#/lib/cn'
import { PropNexusMark } from './PropNexusMark'

// M2-D3 §Foundation · GradientHeader — *"Use on every primary screen, every
// modal landing, every detail view"*.
//
// El logo no se omite: es el ancla agnóstica de rol (M2-D3 y D-074). El slot
// derecho es de utilidades globales. Si hay `back`, va **entre** la marca y
// el título — nunca en el lugar del logo, nunca debajo del h1.

interface GradientHeaderProps {
  title: string
  subtitle?: string
  /** Línea de contexto bajo el título: "Welcome, Admin Alpine". */
  context?: string
  /** "← Back to <parent>" en pantallas que tienen padre. */
  back?: { label: string; onClick: () => void }
  /** Solo utilidades globales. */
  right?: React.ReactNode
  /**
   * Acción primaria de la pantalla, **a la altura del `h1`** — el "+ New" de
   * la captura 35-36.
   *
   * Va acá y no en `right` porque no es lo mismo: `right` son utilidades
   * globales (notificaciones, idioma, perfil) que se repiten en toda la app y
   * viven en la fila de arriba. Esta es la acción de ESTA pantalla, y la
   * captura la alinea con el título.
   */
  titleAction?: React.ReactNode
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
  titleAction,
  badge,
  className
}: GradientHeaderProps) {
  const backLink = back ? (
    <button
      type="button"
      onClick={back.onClick}
      className="flex items-center gap-s1 text-body-sm text-white/80"
    >
      <ArrowLeft size={16} aria-hidden="true" />
      {back.label}
    </button>
  ) : null

  return (
    <header
      className={cn(
        // Radio solo abajo: el header nace pegado al borde superior del viewport.
        'bg-linear-to-br from-primary to-primary-dark rounded-b-xl px-s4 pb-s5 pt-s4 text-white',
        className
      )}
    >
      <div className="mx-auto max-w-2xl">
        <div className="flex items-start justify-between gap-s3">
          <div className="flex items-center gap-s3">
            {badge ? (
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                {badge}
              </span>
            ) : (
              <PropNexusMark />
            )}
          </div>
          {right ? <div className="flex items-center gap-s2">{right}</div> : null}
        </div>

        {backLink ? <div className="mt-s3">{backLink}</div> : null}

        <div className="mt-s4 flex items-center justify-between gap-s3">
          <div className="min-w-0">
            <h1 className="text-display font-bold leading-tight">{title}</h1>
            {subtitle ? <p className="text-body-sm text-white/80">{subtitle}</p> : null}
          </div>
          {titleAction ? <div className="shrink-0">{titleAction}</div> : null}
        </div>

        {context ? <p className="mt-s4 text-body text-white/80">{context}</p> : null}
      </div>
    </header>
  )
}
