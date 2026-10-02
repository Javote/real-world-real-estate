import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { api, projectCoverUrl } from '#/api/port'
import { Loading } from '#/components/domain/Loading'
import { SecondaryButton } from '#/components/domain/PrimaryButton'
import { ProjectCard } from '#/components/domain/ProjectCard'
import { PanelLayout } from '#/components/PanelLayout'
import { formatCurrency, formatMonthYear } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL_EMPTY } from '#/lib/cardShell'
import { TONO_PROYECTO } from '#/lib/stageProgress'

export const Route = createFileRoute('/developer/projects')({ component: DeveloperProjects })

function DeveloperProjects() {
  const { t, locale } = useTranslation()
  const navigate = useNavigate()

  const { data: proyectos, isPending } = useQuery({
    queryKey: ['developer', 'projects'],
    queryFn: api.listDeveloperProjects
  })

  return (
    <PanelLayout
      title={t('developer.projects.title')}
      context={t('developer.projects.context', { count: String(proyectos?.length ?? 0) })}
      back={{
        label: t('developer.projects.backToPanel'),
        onClick: () => void navigate({ to: '/developer' })
      }}
      headerAction={
        <SecondaryButton onClick={() => void navigate({ to: '/developer/project/new' })}>
          <Plus size={16} aria-hidden="true" />
          {t('developer.projects.new')}
        </SecondaryButton>
      }
    >
      <section className="flex flex-col gap-s3" data-testid="DEV-PROJECTS-LIST-001">
        {isPending ? (
          <Loading />
        ) : proyectos?.length ? (
          proyectos.map((p) => {
            const entregado = p.status === 'completed'
            const dateLabel = p.estimatedDelivery
              ? entregado
                ? t('projectCard.deliveredIn', {
                    year: String(new Date(p.estimatedDelivery).getFullYear())
                  })
                : formatMonthYear(p.estimatedDelivery, locale)
              : null

            return (
              <ProjectCard
                key={p.id}
                variant="developer"
                name={p.name}
                imageUrl={projectCoverUrl(p.id, p.coverUpdatedAt)}
                location={[p.city, p.country].filter(Boolean).join(', ')}
                progress={entregado ? null : p.progress}
                status={{
                  tone: TONO_PROYECTO[p.status],
                  label: t(`projectStatus.${p.status}`)
                }}
                priceLabel={
                  p.priceFromMinorUnits != null && p.priceCurrency
                    ? formatCurrency(p.priceFromMinorUnits, p.priceCurrency, locale)
                    : null
                }
                unitsLabel={String(p.totalUnits)}
                dateLabel={dateLabel}
                labels={{
                  from: t('projectCard.from'),
                  units: t('projectCard.units'),
                  progress: t('projectCard.constructionProgress')
                }}
                onOpen={() =>
                  void navigate({
                    to: '/developer/project/$projectId',
                    params: { projectId: p.id }
                  })
                }
              />
            )
          })
        ) : (
          <p className={CARD_SHELL_EMPTY}>{t('developer.projects.empty')}</p>
        )}
      </section>
    </PanelLayout>
  )
}
