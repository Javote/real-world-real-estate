import { ArrowLeft } from 'lucide-react'
import { cn } from '#/lib/cn'
import { PropNexusMark } from './PropNexusMark'

// M2-D3 §Foundation · GradientHeader — *"Use on every primary screen, every
// modal landing, every detail view"*.
//
// **Nunca omite el logo**: es el ancla agnóstica de rol. Y el slot derecho está
// reservado a utilidades globales —NotificationBell, LanguageToggle, acción
// primaria—, nunca a acciones contextuales.
//
// Las capturas del developer mezclan dos patrones de `back` en pantallas del
// mismo nivel (Documentación sin logo, Audit log con logo). No se unifican:
// `hideBrand` es su propio booleano. Con logo, el back va **entre** la marca
// y el título (capturas 37, 38, 39, 44b, 49) — nunca debajo del h1.

interface GradientHeaderProps {
  title: string
  subtitle?: string
  /** Línea de contexto bajo el título: "Welcome, Admin Alpine". */
  context?: string
  /** "← Back to <parent>" en pantallas de detalle. */
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
  /**
   * Patrón A: el back reemplaza al logo (capturas 35/36, 42, 45, 46, 48, 44).
   * Ausente, el logo queda y el back va entre la marca y el título (patrón B).
   */
  hideBrand?: boolean
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
  hideBrand,
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
      {/* El logo va SIEMPRE, salvo hideBrand: es el ancla agnóstica de rol. */}
      <div className="flex items-start justify-between gap-s3">
        <div className="flex items-center gap-s3">
          {hideBrand && backLink ? (
            backLink
          ) : badge ? (
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
              {badge}
            </span>
          ) : (
            <PropNexusMark />
          )}
        </div>
        {right ? <div className="flex items-center gap-s2">{right}</div> : null}
      </div>

      {back && !hideBrand ? <div className="mt-s3">{backLink}</div> : null}

      <div className="mt-s4 flex items-center justify-between gap-s3">
        <div className="min-w-0">
          <h1 className="text-display font-bold leading-tight">{title}</h1>
          {subtitle ? <p className="text-body-sm text-white/80">{subtitle}</p> : null}
        </div>
        {titleAction ? <div className="shrink-0">{titleAction}</div> : null}
      </div>

      {context ? <p className="mt-s4 text-body text-white/80">{context}</p> : null}
    </header>
  )
}
