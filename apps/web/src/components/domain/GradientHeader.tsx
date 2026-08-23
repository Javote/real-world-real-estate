// Componente de dominio (M2-D3 §Foundation): header de página, presente en
// las 5 pantallas de SPEC-011. Nunca omite el logo (invariante 8).
import { Link } from '@tanstack/react-router'

interface GradientHeaderProps {
  title: string
  subtitle?: string
  back?: { label: string; onClick: () => void }
  right?: React.ReactNode
}

export function GradientHeader({ title, subtitle, back, right }: GradientHeaderProps) {
  return (
    <header
      className="rounded-b-2xl px-4 pb-5 pt-4 text-white"
      style={{ background: 'linear-gradient(135deg, #6D4AFF 0%, #5538DD 100%)' }}
    >
      <div className="flex items-center justify-between">
        <Link to="/" className="text-lg font-bold no-underline" style={{ color: '#FFFFFF' }}>
          Prop<span className="font-normal">Nexus</span>
        </Link>
        {right ? <div className="flex items-center gap-2">{right}</div> : null}
      </div>

      {back ? (
        <button type="button" onClick={back.onClick} className="mt-2 text-sm text-white/80">
          ← {back.label}
        </button>
      ) : null}

      <h1 className="mt-3 text-2xl font-bold">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-white/80">{subtitle}</p> : null}
    </header>
  )
}
