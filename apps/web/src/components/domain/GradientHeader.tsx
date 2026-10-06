import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { cn } from '#/lib/cn'
import { PropNexusMark } from './PropNexusMark'

interface GradientHeaderProps {
  title: string
  subtitle?: string
  context?: string | null
  back?: { label: string; onClick: () => void }
  right?: React.ReactNode
  titleAction?: React.ReactNode
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
  useEffect(() => {
    document.title = title === 'PropNexus' ? title : `${title} · PropNexus`
  }, [title])

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

        {/* `null`: la pantalla tiene contexto y todavía no llegó. Reservar la línea evita que todo
            el contenido baje cuando llega el dato (CLS). */}
        {context === null ? (
          <p className="mt-s4 text-body text-white/80" aria-hidden="true">
            {'\u00a0'}
          </p>
        ) : context ? (
          <p className="mt-s4 text-body text-white/80">{context}</p>
        ) : null}
      </div>
    </header>
  )
}
