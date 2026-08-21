// Componente de dominio (M2-D3 §Foundation): tile atómico de KPI. En esta
// rebanada (SPEC-011) los 4 shells de panel lo usan vacío — placeholder de
// layout, nunca un valor inventado (trampa de M2-D2: lo normativo es la
// estructura, no el valor).
import type { LucideIcon } from 'lucide-react'

const ICON_TINTS: Record<string, string> = {
  financial: '#14B8A6',
  entity: '#6D4AFF',
  trend: '#F97316',
  portfolio: '#3B82F6',
  people: '#EC4899',
  verification: '#14B8A6',
}

interface StatCardProps {
  icon: LucideIcon
  tint: keyof typeof ICON_TINTS
  value: string
  label: string
  helper?: string
}

export function StatCard({ icon: Icon, tint, value, label, helper }: StatCardProps) {
  const color = ICON_TINTS[tint]
  return (
    <div className="rounded-2xl bg-white p-4" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
      <div
        className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}1A` }}
      >
        <Icon size={20} color={color} aria-hidden="true" />
      </div>
      <p className="text-2xl font-bold" style={{ color: '#111827' }}>
        {value}
      </p>
      <p className="text-sm" style={{ color: '#374151' }}>
        {label}
      </p>
      {helper ? (
        <p className="mt-0.5 text-xs" style={{ color: '#6B7280' }}>
          {helper}
        </p>
      ) : null}
    </div>
  )
}
