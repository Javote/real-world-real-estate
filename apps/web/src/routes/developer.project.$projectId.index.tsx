import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { DollarSign, FileText, Home, TrendingUp, Upload, Users } from 'lucide-react'
import { capitalQueries, proyectoQueries } from '#/api/queries'
import { ActionCard } from '#/components/domain/ActionCard'
import { StatCard } from '#/components/domain/StatCard'
import { StatusPill } from '#/components/domain/StatusPill'
import { PanelLayout } from '#/components/PanelLayout'
import { formatCurrencyCompact } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'
import { cn } from '#/lib/cn'
import { avanceDeStages, TONO_PROYECTO } from '#/lib/stageProgress'

export const Route = createFileRoute('/developer/project/$projectId/')({
  loader: ({ context: { queryClient }, params: { projectId } }) => {
    void queryClient.prefetchQuery(proyectoQueries.detalleDelDeveloper(projectId))
    void queryClient.prefetchQuery(capitalQueries.porProyecto())
  },
  component: DeveloperProjectDetail
})

function DeveloperProjectDetail() {
  const { projectId } = Route.useParams()
  const { t, locale } = useTranslation()
  const navigate = useNavigate()

  const { data: proyecto } = useQuery(proyectoQueries.detalleDelDeveloper(projectId))

  const { data: capitalPorProyecto } = useQuery(capitalQueries.porProyecto())

  const capital = capitalPorProyecto?.find((p) => p.projectId === projectId)
  const ubicacion = [proyecto?.city, proyecto?.country].filter(Boolean).join(', ')

  return (
    <PanelLayout
      title={proyecto?.name ?? t('developer.project.title')}
      context={proyecto ? ubicacion : null}
      back={{
        label: t('nav.back'),
        onClick: () => void navigate({ to: '/developer/projects' })
      }}
    >
      <section className="flex flex-col gap-s4" data-testid="DEV-PROJECT-DETAIL-001">
        {proyecto ? (
          <article className={cn('flex items-start justify-between gap-s3', CARD_SHELL)}>
            <div className="min-w-0">
              <h2 className="truncate text-h2 font-bold text-text-primary">{proyecto.name}</h2>
              {ubicacion ? (
                <p className="truncate text-body-sm text-text-muted">{ubicacion}</p>
              ) : null}
            </div>
            <StatusPill tone={TONO_PROYECTO[proyecto.status]}>
              {t(`project.status.${proyecto.status}`)}
            </StatusPill>
          </article>
        ) : null}

        <div className="grid grid-cols-2 gap-s3">
          <ActionCard
            compact
            title={t('developer.project.unitsAction')}
            icon={Home}
            onClick={() =>
              void navigate({
                to: '/developer/project/$projectId/units',
                params: { projectId }
              })
            }
          />
          <ActionCard
            compact
            title={t('developer.project.inviteAction')}
            icon={Users}
            onClick={() =>
              void navigate({
                to: '/developer/project/$projectId/invite',
                params: { projectId }
              })
            }
          />
          <ActionCard
            compact
            title={t('developer.project.uploadAction')}
            icon={Upload}
            onClick={() =>
              void navigate({
                to: '/developer/project/$projectId/upload',
                params: { projectId }
              })
            }
          />
          <ActionCard
            compact
            title={t('developer.project.contractsAction')}
            icon={FileText}
            onClick={() =>
              void navigate({
                to: '/developer/project/$projectId/contracts',
                params: { projectId }
              })
            }
          />
        </div>

        <div className="grid grid-cols-3 gap-s3">
          <StatCard
            value={`${avanceDeStages(proyecto?.stages ?? [])}%`}
            label={t('developer.project.progress')}
            icon={TrendingUp}
            tone="trend"
          />
          <StatCard
            value={
              capital?.currency
                ? formatCurrencyCompact(capital.raisedMinorUnits, capital.currency, locale)
                : t('panel.emptyValue')
            }
            label={t('developer.project.capital')}
            icon={DollarSign}
            tone="financial"
          />
          <StatCard
            value={String(capital?.investors ?? 0)}
            label={t('developer.project.investors')}
            icon={Users}
            tone="people"
          />
        </div>
      </section>
    </PanelLayout>
  )
}
