import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Home } from 'lucide-react'
import { proyectoQueries, unidadQueries } from '#/api/queries'
import type { DeveloperUnit } from '#/api/types'
import { Loading } from '#/components/domain/Loading'
import { ProgressBar } from '#/components/domain/ProgressBar'
import { StatCard } from '#/components/domain/StatCard'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL, CARD_SHELL_EMPTY } from '#/lib/cardShell'
import { cn } from '#/lib/cn'

export const Route = createFileRoute('/developer/units')({
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(unidadQueries.delDeveloper())
    void queryClient.prefetchQuery(proyectoQueries.delDeveloper())
  },
  component: DeveloperUnits
})

function DeveloperUnits() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: unidades, isPending } = useQuery(unidadQueries.delDeveloper())

  const { data: proyectos } = useQuery(proyectoQueries.delDeveloper())

  const vendidas =
    unidades?.filter((u) => u.status === 'sold' || u.status === 'delivered').length ?? 0
  const disponibles = unidades?.filter((u) => u.status === 'available').length ?? 0
  const porProyecto = agrupar(unidades ?? [])

  return (
    <PanelLayout
      title={t('developer.units.title')}
      context={t('developer.units.context', {
        sold: String(vendidas),
        total: String(unidades?.length ?? 0)
      })}
      back={{
        label: t('nav.backToPanel'),
        onClick: () => void navigate({ to: '/developer' })
      }}
    >
      <section className="grid grid-cols-3 gap-s3">
        <StatCard
          value={String(unidades?.length ?? 0)}
          label={t('developer.projectUnits.countTotal')}
        />
        <StatCard value={String(vendidas)} label={t('developer.projectUnits.countSold')} />
        <StatCard value={String(disponibles)} label={t('developer.projectUnits.countAvailable')} />
      </section>

      <section className="flex flex-col gap-s3" data-testid="DEV-UNITS-INVENTORY-001">
        {isPending ? (
          <Loading />
        ) : porProyecto.length ? (
          porProyecto.map((grupo) => {
            const proyecto = proyectos?.find((p) => p.id === grupo.projectId)
            const ubicacion = [proyecto?.city, proyecto?.country].filter(Boolean).join(', ')
            const total = grupo.units.length
            const sold = grupo.units.filter(
              (u) => u.status === 'sold' || u.status === 'delivered'
            ).length
            const available = grupo.units.filter((u) => u.status === 'available').length
            const ocupacion = Math.round((sold / total) * 100)

            return (
              <article key={grupo.projectId} className={cn('flex flex-col gap-s3', CARD_SHELL)}>
                <div className="flex items-center gap-s3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info text-white">
                    <Home className="size-icon-stat" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-body font-bold text-text-primary">
                      {grupo.projectName}
                    </h2>
                    {ubicacion ? (
                      <p className="truncate text-caption text-text-muted">{ubicacion}</p>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-s2">
                  <Conteo value={String(total)} label={t('developer.projectUnits.countTotal')} />
                  <Conteo value={String(sold)} label={t('developer.projectUnits.countSold')} />
                  <Conteo
                    value={String(available)}
                    label={t('developer.projectUnits.countAvailable')}
                  />
                </div>

                <div className="flex flex-col gap-s1">
                  <span className="text-body-sm text-text-muted">
                    {t('developer.units.occupancy')}
                  </span>
                  <ProgressBar percent={ocupacion} label={grupo.projectName} showValue />
                </div>
              </article>
            )
          })
        ) : (
          <p className={CARD_SHELL_EMPTY}>{t('developer.units.empty')}</p>
        )}
      </section>
    </PanelLayout>
  )
}

function agrupar(unidades: DeveloperUnit[]) {
  const mapa = new Map<string, { projectId: string; projectName: string; units: DeveloperUnit[] }>()
  for (const u of unidades) {
    const actual = mapa.get(u.projectId) ?? {
      projectId: u.projectId,
      projectName: u.projectName,
      units: []
    }
    actual.units.push(u)
    mapa.set(u.projectId, actual)
  }
  return [...mapa.values()]
}

function Conteo({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-surface-alt p-s2">
      <span className="text-body font-bold text-text-primary">{value}</span>
      <span className="text-caption text-text-muted">{label}</span>
    </div>
  )
}
